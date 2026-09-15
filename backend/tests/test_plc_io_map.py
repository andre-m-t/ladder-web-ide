"""Testes de contrato do mapa de pinos (Q-5 da spec 001).

Nao testam a implementacao da *glue* -- isso cabe a test_esp32.py, que
exercita a compilacao real dentro do container. Este arquivo trava a CLASSE
de erro que motivou a revisao de 2026-09-15 (%IX0.1: GPIO5 -> GPIO18): pino de
entrada em posicao perigosa do ESP32, e divergencia entre o cabecalho C e a
tabela publicada na spec. Nao precisa de container: roda em
`pytest -m "not slow"`.
"""

import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HEADER_PATH = REPO_ROOT / "backend/firmware/esp32-template/main/plc_io_map.h"
SPEC_PATH = REPO_ROOT / "docs/specs/001-fatia-vertical-minima/spec.md"

# Strapping pins cuja consequencia no reset e perigosa para uma entrada ligada
# a circuito externo: precisam de um nivel especifico no boot, e um programa
# do usuario nao tem como garanti-lo. GPIO0 e GPIO2 sao excecoes deliberadas
# (ver PERMITIDOS_COM_RESSALVA abaixo) e por isso nao entram aqui.
STRAPPING_PERIGOSOS = {5, 12, 15}

# GPIO6-11: pinos internos do flash SPI integrado do modulo WROOM-32, nao
# expostos no header e nunca utilizaveis como E/S de usuario.
FAIXA_FLASH = set(range(6, 12))

# GPIO34-39: input-only no ESP32 classico -- nao tem pull-up/pull-down
# interno, entao um pino ali com pull_up=true na tabela e um erro de mapa.
INPUT_ONLY_SEM_PULLUP = set(range(34, 40))

# Excecoes deliberadas e documentadas na Q-5 da spec 001 (revisao
# 2026-09-15): GPIO0 (%IX0.0, botao BOOT onboard, entrada) e GPIO2 (%QX0.0,
# LED onboard, saida) sao strapping pins usados de proposito -- a ressalva de
# contrato (nivel alto garantido no reset para GPIO0) esta registrada na
# spec, nao neste teste. Permitidos aqui explicitamente, em vez de
# simplesmente nao estarem nos conjuntos acima, para que a excecao fique
# visivel a quem le o teste.
PERMITIDOS_COM_RESSALVA = {0, 2}


@dataclass(frozen=True)
class PinEntry:
    variable: str
    gpio: int
    direction: str  # "PLC_IO_INPUT" ou "PLC_IO_OUTPUT"
    active_low: bool
    pull_up: bool


# Casa linhas como: {"__IX0_0", 0, PLC_IO_INPUT, true, true},
_ENTRY_RE = re.compile(
    r'\{"(?P<variable>__[A-Za-z0-9_]+)",\s*'
    r"(?P<gpio>\d+),\s*"
    r"(?P<direction>PLC_IO_INPUT|PLC_IO_OUTPUT),\s*"
    r"(?P<active_low>true|false),\s*"
    r"(?P<pull_up>true|false)\s*\},"
)


def _parse_header() -> list[PinEntry]:
    text = HEADER_PATH.read_text(encoding="ascii")
    entries = [
        PinEntry(
            variable=m.group("variable"),
            gpio=int(m.group("gpio")),
            direction=m.group("direction"),
            active_low=m.group("active_low") == "true",
            pull_up=m.group("pull_up") == "true",
        )
        for m in _ENTRY_RE.finditer(text)
    ]
    assert entries, f"nenhuma entrada de pino encontrada em {HEADER_PATH}"
    return entries


def _symbol_to_address(variable: str) -> str:
    """`__IX0_0` -> `%IX0.0`, `__QX0_1` -> `%QX0.1` (ver comentario no topo
    de plc_io_map.h: e o simbolo que o iec2c emite em LOCATED_VARIABLES.h)."""
    body = variable.removeprefix("__")
    kind, x, rest = body[0], body[1], body[2:]
    word, bit = rest.split("_")
    return f"%{kind}{x}{word}.{bit}"


_SPEC_TABLE_ROW_RE = re.compile(
    r"^\s*\|\s*`(?P<address>%[IQ]X\d+\.\d+)`\s*\|\s*(?P<gpio>\d+)\s*\|", re.MULTILINE
)


def _parse_spec_consolidated_table() -> dict[str, int]:
    """Extrai a tabela consolidada (vigente) da Q-5, nao a entrada historica
    de 2026-09-10 -- a revisao de 2026-09-15 acrescenta a tabela em vigor
    logo apos o bloco de revisao, sem apagar a decisao original."""
    text = SPEC_PATH.read_text(encoding="utf-8")
    marker = "Tabela consolidada, em vigor após esta revisão"
    start = text.index(marker)
    end = text.index("### Q-6", start)
    table_text = text[start:end]

    rows = {
        m.group("address"): int(m.group("gpio"))
        for m in _SPEC_TABLE_ROW_RE.finditer(table_text)
    }
    assert rows, "tabela consolidada da Q-5 nao encontrada ou vazia na spec"
    return rows


def test_nenhuma_entrada_em_strapping_perigoso_ou_faixa_de_flash() -> None:
    for entry in _parse_header():
        if entry.direction != "PLC_IO_INPUT":
            continue
        if entry.gpio in PERMITIDOS_COM_RESSALVA:
            continue  # excecao documentada na Q-5, revisao 2026-09-15
        assert entry.gpio not in STRAPPING_PERIGOSOS, (
            f"{entry.variable}: GPIO{entry.gpio} e strapping pin perigoso "
            "para entrada externa (pode travar o boot)"
        )
        assert entry.gpio not in FAIXA_FLASH, (
            f"{entry.variable}: GPIO{entry.gpio} pertence ao flash SPI interno"
        )


def test_nenhuma_saida_na_faixa_de_flash() -> None:
    for entry in _parse_header():
        if entry.direction != "PLC_IO_OUTPUT":
            continue
        assert entry.gpio not in FAIXA_FLASH, (
            f"{entry.variable}: GPIO{entry.gpio} pertence ao flash SPI interno"
        )


def test_entrada_com_pull_up_nao_esta_em_input_only() -> None:
    for entry in _parse_header():
        if entry.direction == "PLC_IO_INPUT" and entry.pull_up:
            assert entry.gpio not in INPUT_ONLY_SEM_PULLUP, (
                f"{entry.variable}: GPIO{entry.gpio} e input-only e nao tem "
                "pull-up interno no ESP32 classico"
            )


def test_mapa_do_header_bate_com_a_tabela_consolidada_da_spec() -> None:
    header_map = {
        _symbol_to_address(entry.variable): entry.gpio for entry in _parse_header()
    }
    spec_map = _parse_spec_consolidated_table()

    assert header_map == spec_map, (
        "plc_io_map.h divergiu da tabela consolidada de Q-5 em "
        f"{SPEC_PATH}: header={header_map} spec={spec_map}"
    )
