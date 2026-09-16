"""Contrato de boot saudável no QEMU, compartilhado entre `test_qemu.py`
(boot direto de um build) e `test_gravacao_qemu.py` (boot depois de gravar
via esptool/socket) — spec 001, S2.

As duas provas têm que concordar sobre o que é "saudável": nenhum marcador de
pânico, exatamente um boot na janela de observação (sem bootloop) e o
heartbeat do laço de varredura (`ladderflow: scan ciclo=<N>`) estritamente
crescente, em pelo menos três ocorrências. Manter isso num só lugar evita que
as duas provas divirjam em silêncio.
"""

from __future__ import annotations

import re
import shutil

import pytest

from app.services import esp32

# Marcadores de falha de firmware que o handler de pânico do ESP-IDF imprime.
# Ausência de ambos é a prova de "não houve panic".
PANIC_MARKERS = ("Guru Meditation Error", "abort() was called")

# Banner que o ROM bootloader imprime a cada reset (POWERON, SW_CPU_RESET
# etc.). Mais de uma ocorrência na janela de observação é bootloop.
RESET_BANNER_RE = re.compile(r"^rst:0x[0-9a-fA-F]+ \(", re.MULTILINE)

# Heartbeat do laço de varredura (`app_main.c`): uma linha a cada 50 ciclos.
HEARTBEAT_RE = re.compile(r"ladderflow: scan ciclo=(\d+)")

toolchain_disponivel = pytest.mark.skipif(
    not esp32.status().available,
    reason="idf.py nao disponivel neste ambiente (rode dentro do container)",
)

qemu_disponivel = pytest.mark.skipif(
    shutil.which("qemu-system-xtensa") is None,
    reason="qemu-system-xtensa nao disponivel neste ambiente (rode dentro do container)",
)


def verificar_boot_saudavel(log: str, *, minimo_ciclos: int = 3) -> list[int]:
    """Confere o contrato de boot saudável sobre `log` e devolve os ciclos lidos.

    Levanta `AssertionError` (com o log completo anexado) quando algum dos
    três critérios falha: nenhum marcador de pânico, exatamente um banner de
    reset (boot único, sem bootloop) e pelo menos `minimo_ciclos` heartbeats
    com contagem estritamente crescente.
    """
    for marker in PANIC_MARKERS:
        assert marker not in log, f"firmware sinalizou falha ({marker!r}) no log:\n{log}"

    reset_banners = RESET_BANNER_RE.findall(log)
    assert len(reset_banners) == 1, (
        f"esperava exatamente 1 boot na janela de observacao, houve {len(reset_banners)} "
        f"(bootloop se > 1, firmware nunca chegou a dar boot se 0):\n{log}"
    )

    ciclos = [int(n) for n in HEARTBEAT_RE.findall(log)]
    assert len(ciclos) >= minimo_ciclos, (
        f"esperava pelo menos {minimo_ciclos} linhas de heartbeat "
        f"('ladderflow: scan ciclo=<N>'), encontrei {len(ciclos)}. Se o formato do "
        "heartbeat ainda nao foi acrescentado a app_main.c, este teste falha por "
        f"contrato ainda nao cumprido, nao por bug aqui.\nLog capturado:\n{log}"
    )
    assert all(a < b for a, b in zip(ciclos, ciclos[1:], strict=False)), (
        f"contagem de ciclos nao e estritamente crescente: {ciclos}\nLog capturado:\n{log}"
    )
    return ciclos
