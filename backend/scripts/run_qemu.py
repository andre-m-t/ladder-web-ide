"""Dá boot no firmware do ESP32 dentro do QEMU da Espressif, sem hardware.

Ferramenta de VALIDAÇÃO, não de produção: nenhum módulo de `app/` importa
este script. Ele existe para `tests/test_qemu.py` provar, de forma
automatizada, que o `.bin` produzido por `app/services/esp32.py` dá boot e
roda o laço de varredura — sem depender de um ESP32 físico na bancada.

Como o MATIEC e o ESP-IDF (constitution §10), o QEMU entra como FERRAMENTA
EXTERNA, executada como processo separado (`qemu-system-xtensa`). Nada do
QEMU é copiado para dentro deste repositório; a imagem do backend o instala
via `idf_tools.py` (ver `backend/Dockerfile`).

## Por que `qemu-system-xtensa` direto, e não `idf.py qemu`

O ESP-IDF 5.4 tem `idf.py qemu`, mas em primeiro plano (sem `--gdb`/monitor
em segundo plano) ele funde a UART da aplicação com o monitor do próprio QEMU
num único fluxo (`-serial mon:stdio`) — ruído que atrapalha casar regex no
log de varredura, e que não dá para separar de fora sem reimplementar o
comando. Por isso este script chama `qemu-system-xtensa` diretamente, com
`-serial file:<log>`, que isola a UART da aplicação num arquivo limpo.

Os demais argumentos (máquina, imagem de eFuse padrão, desabilitar o
watchdog do timer) replicam o que `idf.py qemu` geraria para o alvo `esp32`.
A imagem de eFuse é um valor fixo de calibração da placa virtual (não lógica
de negócio) e está transcrita, com a fonte citada, em `_DEFAULT_EFUSE_ESP32`
abaixo — ela sai do próprio `idf.py qemu` (`tools/idf_py_actions/qemu_ext.py`
do ESP-IDF v5.4.1, `QEMU_TARGETS['esp32'].default_efuse`), para que o boot no
QEMU aconteça nas mesmas condições que o comando oficial produziria.

## O que este script NÃO prova

Só cobre CPU, memória e os periféricos que o QEMU emula. O estado elétrico
dos pinos (nível de tensão real, `active_low`, resistor de pull-up) não é
verificado aqui — ver limite documentado em `docs/validacao/` e o teste em
`tests/test_qemu.py`.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# eFuse do ESP32 (revisão v3.0 do chip) nas mesmas condições em que o
# `idf.py qemu` sobe a placa virtual quando ninguém passa `--efuse-file`.
#
# Descrito, e não transcrito. O ESP-IDF carrega esse valor como um blob de 124
# bytes; copiá-lo para cá poria um artefato de terceiro dentro da árvore
# autoral, que é justamente o que a Regra 4 do CLAUDE.md e a auditoria de
# `scripts/build-deposito.sh` existem para impedir. O blob é zerado em tudo
# menos dois bytes de revisão de chip, então o que ele *significa* cabe em duas
# linhas nossas -- e `tests/test_qemu.py` confere byte a byte contra o valor do
# próprio ESP-IDF, de modo que uma divergência futura falha o teste em vez de
# passar despercebida.
_EFUSE_ESP32_TAMANHO = 124
_EFUSE_ESP32_BYTES_SETADOS = {13: 0x80, 22: 0x10}

# Argumentos da placa virtual do alvo esp32, os mesmos que o `idf.py qemu`
# monta: máquina, RAM, e os nomes dos dispositivos de eFuse e do timer.
_QEMU_MACHINE_ARGS = ["-M", "esp32", "-m", "4M"]
_QEMU_EFUSE_DEVICE = "nvram.esp32.efuse"
_QEMU_TIMG_DEVICE = "timer.esp32.timg"

_SUPPORTED_TARGET = "esp32"


class QemuError(RuntimeError):
    """Falha ao operar o QEMU (não é erro no código do usuário)."""


class QemuNotAvailable(QemuError):
    """`qemu-system-xtensa` não foi encontrado no PATH."""


@dataclass(frozen=True)
class QemuBootResult:
    """Resultado bruto de uma sessão de observação do boot no QEMU.

    `timed_out=True` é o desfecho ESPERADO de um firmware saudável: o QEMU
    não sai sozinho (fica "rodando" o laço de varredura para sempre), então a
    janela de observação estourar é como se confirma que ele não travou nem
    caiu antes disso. `timed_out=False` com `returncode != 0` é que indica
    problema — o próprio processo do QEMU morreu.
    """

    log_path: Path
    log_text: str
    timed_out: bool
    returncode: int | None


def _require_tool(name: str) -> str:
    found = shutil.which(name)
    if not found:
        raise QemuNotAvailable(
            f"{name} não encontrado no PATH; a imagem do backend instala o QEMU da "
            "Espressif via `idf_tools.py install qemu-xtensa` (ver backend/Dockerfile)"
        )
    return found


def _read_build_metadata(build_dir: Path) -> tuple[str, str]:
    """Lê alvo do chip e tamanho de flash configurados no projeto compilado."""
    desc_path = build_dir / "project_description.json"
    flasher_args_path = build_dir / "flasher_args.json"
    if not desc_path.is_file() or not flasher_args_path.is_file():
        raise QemuError(
            f"{build_dir} não parece um diretório de build do ESP-IDF "
            "(faltam project_description.json / flasher_args.json); rode "
            "`esp32.build_firmware` antes de chamar este script"
        )

    target = json.loads(desc_path.read_text(encoding="utf-8"))["target"]
    flash_size = json.loads(flasher_args_path.read_text(encoding="utf-8"))["flash_settings"][
        "flash_size"
    ]
    return target, flash_size


def build_qemu_flash_image(build_dir: Path, *, force: bool = False) -> Path:
    """Mescla bootloader + tabela de partições + app num único `.bin` de flash.

    É o mesmo `esptool merge_bin` que `idf.py qemu` roda por baixo dos panos
    (mesmos argumentos, a partir do `@flash_args` que o build já gerou).
    """
    target, flash_size = _read_build_metadata(build_dir)
    if target != _SUPPORTED_TARGET:
        raise QemuError(
            f"alvo do build é {target!r}; este script só sabe dar boot em {_SUPPORTED_TARGET!r}"
        )

    output = build_dir / "qemu_flash.bin"
    if output.is_file() and not force:
        return output

    command = [
        sys.executable,
        "-m",
        "esptool",
        f"--chip={target}",
        "merge_bin",
        f"--output={output.name}",
        f"--fill-flash-size={flash_size}",
        "@flash_args",
    ]
    completed = subprocess.run(
        command, cwd=build_dir, capture_output=True, text=True, timeout=120, check=False
    )
    if completed.returncode != 0 or not output.is_file():
        raise QemuError(f"esptool merge_bin falhou:\n{completed.stdout}\n{completed.stderr}")
    return output


def efuse_padrao_esp32() -> bytes:
    """Imagem de eFuse com que o QEMU sobe o ESP32 clássico."""
    imagem = bytearray(_EFUSE_ESP32_TAMANHO)
    for posicao, valor in _EFUSE_ESP32_BYTES_SETADOS.items():
        imagem[posicao] = valor
    return bytes(imagem)


def write_default_efuse_image(path: Path) -> Path:
    """Grava a imagem de eFuse padrão no caminho informado."""
    path.write_bytes(efuse_padrao_esp32())
    return path


def run_qemu(
    build_dir: Path,
    *,
    log_path: Path,
    timeout: float = 30.0,
) -> QemuBootResult:
    """Roda o firmware no QEMU, capturando a UART em `log_path`, até `timeout`.

    Não interativo: nenhuma entrada é aguardada, sem monitor, sem gráfico.
    Levanta `QemuNotAvailable`/`QemuError` para problemas de ambiente; nunca
    para o que o firmware fizer (ou deixar de fazer) depois de dar boot —
    isso é responsabilidade de quem lê `log_text`.
    """
    qemu_bin = _require_tool("qemu-system-xtensa")

    flash_image = build_qemu_flash_image(build_dir)
    efuse_image = write_default_efuse_image(build_dir / "qemu_efuse.bin")

    log_path.parent.mkdir(parents=True, exist_ok=True)
    if log_path.exists():
        log_path.unlink()

    command = [
        qemu_bin,
        *_QEMU_MACHINE_ARGS,
        "-drive",
        f"file={flash_image},if=mtd,format=raw",
        "-drive",
        f"file={efuse_image},if=none,format=raw,id=efuse",
        "-global",
        f"driver={_QEMU_EFUSE_DEVICE},property=drive,value=efuse",
        "-global",
        f"driver={_QEMU_TIMG_DEVICE},property=wdt_disable,value=true",
        # Sem rede: o firmware desta fatia não usa Wi-Fi/Ethernet, e
        # desligar a emulação de NIC evita atraso de inicialização do slirp
        # que não tem nenhuma relação com o laço de varredura.
        "-nic",
        "none",
        "-serial",
        f"file:{log_path}",
        "-nographic",
        "-monitor",
        "none",
    ]

    process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    timed_out = False
    try:
        _, stderr = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)
        stderr = process.stderr.read() if process.stderr else b""

    if not timed_out and process.returncode != 0:
        raise QemuError(
            f"qemu-system-xtensa terminou sozinho com código {process.returncode}:\n"
            f"{stderr.decode('utf-8', errors='replace')}"
        )

    log_text = log_path.read_text(encoding="utf-8", errors="replace") if log_path.exists() else ""
    return QemuBootResult(
        log_path=log_path,
        log_text=log_text,
        timed_out=timed_out,
        returncode=None if timed_out else process.returncode,
    )


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("build_dir", type=Path, help="diretório de build do idf.py (com o .bin)")
    parser.add_argument(
        "--log",
        type=Path,
        default=None,
        help="onde salvar a UART (default: <build_dir>/qemu_serial.log)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="janela de observação, em segundos (default: 30)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    log_path = args.log or (args.build_dir / "qemu_serial.log")
    result = run_qemu(args.build_dir, log_path=log_path, timeout=args.timeout)
    print(result.log_text)
    print(f"--- timed_out={result.timed_out} returncode={result.returncode} ---", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
