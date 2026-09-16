"""Prova que o firmware do ESP32 dá boot e roda o laço de varredura — sem
hardware físico, dentro do QEMU da Espressif (`qemu-system-xtensa`, instalado
na imagem via `idf_tools.py`, ver `backend/Dockerfile`).

Encadeia o pipeline inteiro: ST -> `iec2c` -> `idf.py build` -> `.bin` ->
`qemu-system-xtensa` (via `backend/scripts/run_qemu.py`). É o primeiro teste
automatizado deste projeto que observa o firmware **rodando**, não apenas
compilando — mas continua sem ESP32 físico, então marcado `slow` e pulado
fora do container, no mesmo padrão de `test_esp32.py`.

## O que este teste PROVA

- O firmware dá boot: nenhum "Guru Meditation Error", nenhum `abort()`.
- O boot acontece uma única vez na janela de observação — sem bootloop
  (reset repetido).
- O laço de varredura roda de verdade: a tag `ladderflow` emite
  `scan ciclo=<N>` a cada 50 ciclos (heartbeat acrescentado por outra frente
  de trabalho em `app_main.c`), com `<N>` estritamente crescente em pelo
  menos três ocorrências.

## O que este teste NÃO PROVA (limite deliberado)

O QEMU do ESP-IDF emula CPU, memória e um subconjunto de periféricos — não
emula o estado elétrico dos pinos. Este teste não afirma nada sobre nível de
tensão em GPIO, sobre o LED de fato acender/apagar, nem sobre a inversão de
`active_low`. Prova disso caberia à bancada real (ver
`docs/validacao/ca-4-gravacao-esp32.md`) ou ao runtime hospedeiro em modo
elétrico (ver `docs/validacao/contrato-runtime-host.md`).

Por isso, deliberadamente, este teste não verifica a alternância do LED do
`blink.st`. No QEMU os GPIOs não estão ligados a nada: `%IX0.0` é
`active_low` com pull-up e um GPIO0 flutuante é lido como nível baixo — ou
seja, o runtime conclui `botao = TRUE` o tempo todo, e a regra
`IF botao THEN led := TRUE` do `blink.st` mantém o LED sempre aceso. Isso é
esperado dentro do QEMU e não é o que este teste mede.
"""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from app.services import esp32, matiec
from scripts import run_qemu

toolchain_disponivel = pytest.mark.skipif(
    not esp32.status().available,
    reason="idf.py nao disponivel neste ambiente (rode dentro do container)",
)

qemu_disponivel = pytest.mark.skipif(
    shutil.which("qemu-system-xtensa") is None,
    reason="qemu-system-xtensa nao disponivel neste ambiente (rode dentro do container)",
)

# Cada linha de heartbeat sai a cada 50 ciclos de 20 ms (common_ticktime__ do
# blink.st) -- 1 s de tempo emulado por linha. A janela de observacao precisa
# cobrir o boot (~1.5 s de tempo emulado, rapido tambem em relogio real
# porque o QEMU nao usa -icount aqui) mais pelo menos 3 heartbeats, com folga
# generosa para uma maquina de CI mais lenta.
OBSERVATION_TIMEOUT_S = 30.0

# Contrato do log (fixado entre as duas frentes de trabalho antes da
# implementacao -- nao inventar outro formato aqui).
_HEARTBEAT_RE = re.compile(r"ladderflow: scan ciclo=(\d+)")

# Marcadores de falha de firmware que o handler de panico do ESP-IDF imprime.
# Ausencia de ambos e a prova de "nao houve panic" que a rodada pediu.
_PANIC_MARKERS = ("Guru Meditation Error", "abort() was called")

# Banner que o ROM bootloader imprime a cada reset (POWERON, SW_CPU_RESET
# etc.). Mais de uma ocorrencia na janela de observacao e bootloop.
_RESET_BANNER_RE = re.compile(r"^rst:0x[0-9a-fA-F]+ \(", re.MULTILINE)


@pytest.fixture
def firmware_build_dir(blink_st: str, tmp_path: Path) -> Path:
    """Compila `blink.st` ate o `.bin` e devolve o diretorio de build do IDF.

    Metade do pipeline compartilhada com `test_esp32.py`; a diferenca comeca
    depois do build, quando este arquivo bota o `.bin` para rodar no QEMU.
    """
    generated = tmp_path / "generated"
    compilation = matiec.compile_st_to_c(blink_st, out_dir=generated)
    assert compilation.ok, f"iec2c falhou:\n{compilation.stdout}\n{compilation.stderr}"

    result = esp32.build_firmware(generated, work_dir=tmp_path / "work")
    assert result.ok, f"idf.py build falhou:\n{result.stdout}\n{result.stderr}"
    assert result.binary is not None

    return result.binary.parent


@pytest.mark.slow
@toolchain_disponivel
@qemu_disponivel
def test_firmware_da_boot_e_roda_o_laco_de_varredura_no_qemu(
    firmware_build_dir: Path, tmp_path: Path
) -> None:
    boot = run_qemu.run_qemu(
        firmware_build_dir,
        log_path=tmp_path / "qemu_serial.log",
        timeout=OBSERVATION_TIMEOUT_S,
    )
    log = boot.log_text

    assert boot.timed_out, (
        "qemu-system-xtensa encerrou sozinho antes do fim da janela de observacao "
        f"(returncode={boot.returncode}); um firmware saudavel roda o laco para sempre "
        f"e so para porque este teste o mata no timeout.\nLog capturado:\n{log}"
    )

    for marker in _PANIC_MARKERS:
        assert marker not in log, f"firmware sinalizou falha ({marker!r}) no log:\n{log}"

    reset_banners = _RESET_BANNER_RE.findall(log)
    assert len(reset_banners) == 1, (
        f"esperava exatamente 1 boot na janela de observacao, houve {len(reset_banners)} "
        f"(bootloop se > 1, firmware nunca chegou a dar boot se 0):\n{log}"
    )

    ciclos = [int(n) for n in _HEARTBEAT_RE.findall(log)]
    assert len(ciclos) >= 3, (
        "esperava pelo menos 3 linhas de heartbeat "
        f"('ladderflow: scan ciclo=<N>'), encontrei {len(ciclos)}. Se o formato do "
        "heartbeat ainda nao foi acrescentado a app_main.c, este teste falha por "
        f"contrato ainda nao cumprido, nao por bug aqui.\nLog capturado:\n{log}"
    )
    assert all(a < b for a, b in zip(ciclos, ciclos[1:], strict=False)), (
        f"contagem de ciclos nao e estritamente crescente: {ciclos}\nLog capturado:\n{log}"
    )


def test_efuse_padrao_casa_com_o_do_esp_idf() -> None:
    """A imagem de eFuse descrita por nós bate com a que o ESP-IDF geraria.

    `run_qemu.py` **descreve** o eFuse padrão do ESP32 (124 bytes zerados, menos
    dois de revisão de chip) em vez de transcrever o blob do ESP-IDF para dentro
    da árvore autoral — o que poria artefato de terceiro onde a Regra 4 do
    `CLAUDE.md` e a auditoria de `scripts/build-deposito.sh` não admitem.

    O preço de descrever em vez de copiar é poder divergir em silêncio se o
    ESP-IDF mudar o valor. Este teste é o que cobra esse preço: lê o valor do
    próprio ESP-IDF, num subprocesso (a toolchain nunca é importada em
    processo — constitution §10), e compara byte a byte.
    """
    idf_path = os.environ.get("IDF_PATH")
    if not idf_path:
        pytest.skip("IDF_PATH nao definido (rode dentro do container)")

    extrai = (
        "import sys;"
        f"sys.path.insert(0, {idf_path + '/tools'!r});"
        "from idf_py_actions.qemu_ext import QEMU_TARGETS;"
        "sys.stdout.write(QEMU_TARGETS['esp32'].default_efuse.hex())"
    )
    completed = subprocess.run(
        [sys.executable, "-c", extrai],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    if completed.returncode != 0:
        pytest.skip(f"nao foi possivel ler o eFuse do ESP-IDF: {completed.stderr.strip()}")

    do_idf = bytes.fromhex(completed.stdout.strip())
    nosso = run_qemu.efuse_padrao_esp32()

    assert nosso == do_idf, (
        "a imagem de eFuse descrita em run_qemu.py divergiu da do ESP-IDF.\n"
        f"  nossa: {nosso.hex()}\n"
        f"  ESP-IDF: {do_idf.hex()}"
    )
