"""Testes de contrato do mapa de pinos (Q-5 da spec 001).

Nao testam a implementacao da *glue* -- isso cabe a test_esp32.py, que
exercita a compilacao real dentro do container. Este arquivo trava a CLASSE
de erro que motivou a revisao de 2026-09-15 (%IX0.1: GPIO5 -> GPIO18): pino de
entrada em posicao perigosa do ESP32, e divergencia entre o cabecalho C e a
tabela publicada na spec. Nao precisa de container: roda em
`pytest -m "not slow"`.

Contrato adicional (ressalva R-3 do plano da spec 002, `docs/specs/
002-editor-ladder/plan.md` §10): este arquivo tambem trava o acoplamento
entre `plc_io_map.h` e `frontend/src/ladder/enderecos.ts`, o espelho que o
editor Ladder usa para so oferecer enderecos localizados que o firmware de
fato mapeia. Ver o comentario junto de `_comparar_enderecos` mais abaixo para
o motivo detalhado. A partir da revisao 2026-09-17 (Q-5: pinagem 8/8), o
mesmo acoplamento e travado tambem para `GPIO_DO_ENDERECO` -- nao so que o
endereco existe dos dois lados, mas que aponta para o MESMO GPIO -- ver
`_comparar_mapas_gpio` mais abaixo.
"""

import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HEADER_PATH = REPO_ROOT / "backend/firmware/esp32-template/main/plc_io_map.h"
SPEC_PATH = REPO_ROOT / "docs/specs/001-fatia-vertical-minima/spec.md"
FRONTEND_ENDERECOS_PATH = REPO_ROOT / "frontend/src/ladder/enderecos.ts"

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
        m.group("address"): int(m.group("gpio")) for m in _SPEC_TABLE_ROW_RE.finditer(table_text)
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
    header_map = {_symbol_to_address(entry.variable): entry.gpio for entry in _parse_header()}
    spec_map = _parse_spec_consolidated_table()

    assert header_map == spec_map, (
        "plc_io_map.h divergiu da tabela consolidada de Q-5 em "
        f"{SPEC_PATH}: header={header_map} spec={spec_map}"
    )


# Casa as duas listas exportadas por enderecos.ts, capturando o conteudo
# entre colchetes para depois extrair os literais de string dentro delas --
# em vez de varrer o arquivo inteiro, o que pegaria qualquer '%IX...' perdido
# num comentario.
_TS_ENDERECOS_ARRAY_RE = re.compile(
    r"export const (?:ENTRADAS_LOCALIZADAS|SAIDAS_LOCALIZADAS)\s*=\s*\[(?P<itens>[^\]]*)\]"
)
_TS_ENDERECO_LITERAL_RE = re.compile(r"'(%[IQ]X\d+\.\d+)'")


def _parse_frontend_enderecos() -> frozenset[str]:
    """Extrai os enderecos localizados de ENTRADAS_LOCALIZADAS e
    SAIDAS_LOCALIZADAS em frontend/src/ladder/enderecos.ts (D-9)."""
    text = FRONTEND_ENDERECOS_PATH.read_text(encoding="utf-8")
    enderecos: set[str] = set()
    for array in _TS_ENDERECOS_ARRAY_RE.finditer(text):
        enderecos.update(_TS_ENDERECO_LITERAL_RE.findall(array.group("itens")))

    # Nao deixar passar em silencio: se o parser nao achou nada, isso quase
    # certo significa que o arquivo mudou de formato e o teste ficou cego, e
    # um teste cego que passa vazio e pior do que nenhum teste (Regra 1 do
    # CLAUDE.md do projeto vale tambem para os testes que sustentam o R-3).
    assert enderecos, (
        "nenhum endereco encontrado em ENTRADAS_LOCALIZADAS/SAIDAS_LOCALIZADAS "
        f"de {FRONTEND_ENDERECOS_PATH}: o parser deste teste provavelmente "
        "ficou incompativel com o formato do arquivo -- corrija o parser ou "
        "confira se as listas nao ficaram vazias por engano"
    )
    return frozenset(enderecos)


def _comparar_enderecos(
    do_header: frozenset[str], do_editor: frozenset[str]
) -> tuple[frozenset[str], frozenset[str]]:
    """Compara dois conjuntos de enderecos localizados e devolve
    `(sobrando_no_header, sobrando_no_editor)`: o que existe so de um lado.

    Funcao pura -- nao le arquivo nenhum -- para que o teste negativo abaixo
    possa provar que o comparador morde nos dois sentidos sem depender do
    conteudo real do repositorio.
    """
    return do_header - do_editor, do_editor - do_header


def _mensagem_divergencia(
    sobrando_no_header: frozenset[str], sobrando_no_editor: frozenset[str]
) -> str:
    partes = []
    if sobrando_no_header:
        partes.append(
            "no header (plc_io_map.h) mas ausente(s) de enderecos.ts -- "
            "atualize ENTRADAS_LOCALIZADAS/SAIDAS_LOCALIZADAS: "
            f"{sorted(sobrando_no_header)}"
        )
    if sobrando_no_editor:
        partes.append(
            "em enderecos.ts mas ausente(s) do header (plc_io_map.h) -- "
            "atualize o firmware ou remova do editor: "
            f"{sorted(sobrando_no_editor)}"
        )
    return "; ".join(partes)


# Ressalva R-3 do plano (docs/specs/002-editor-ladder/plan.md §10): o editor
# Ladder so pode oferecer, no PainelVariaveis, enderecos localizados que o
# firmware de fato mapeia para um GPIO -- oferecer um endereco a mais aceita
# um diagrama que so vai falhar na hora de compilar/gravar no ESP32, longe do
# erro. O inverso tambem importa: um pino novo acrescentado ao firmware (por
# exemplo, uma terceira entrada) nao pode ficar de fora do editor em silencio,
# porque isso e regressao de funcionalidade sem nenhum teste acusando. Como
# nao ha teste hoje ligando front-end e header (a spec 001 so cobre o
# header x a tabela da propria spec, acima), este teste fecha essa lacuna
# comparando os dois conjuntos nos dois sentidos.
def test_enderecos_do_editor_batem_com_plc_io_map() -> None:
    do_header = frozenset(_symbol_to_address(entry.variable) for entry in _parse_header())
    do_editor = _parse_frontend_enderecos()

    sobrando_no_header, sobrando_no_editor = _comparar_enderecos(do_header, do_editor)

    assert not sobrando_no_header and not sobrando_no_editor, (
        "frontend/src/ladder/enderecos.ts divergiu de plc_io_map.h: "
        f"{_mensagem_divergencia(sobrando_no_header, sobrando_no_editor)}"
    )


def test_comparador_de_enderecos_morde_com_pino_a_mais_no_header() -> None:
    do_header = frozenset({"%IX0.0", "%IX0.1", "%QX0.0", "%QX0.1", "%IX0.2"})
    do_editor = frozenset({"%IX0.0", "%IX0.1", "%QX0.0", "%QX0.1"})

    sobrando_no_header, sobrando_no_editor = _comparar_enderecos(do_header, do_editor)

    assert sobrando_no_header == frozenset({"%IX0.2"})
    assert sobrando_no_editor == frozenset()


def test_comparador_de_enderecos_morde_com_pino_a_mais_no_editor() -> None:
    do_header = frozenset({"%IX0.0", "%IX0.1", "%QX0.0", "%QX0.1"})
    do_editor = frozenset({"%IX0.0", "%IX0.1", "%QX0.0", "%QX0.1", "%QX0.2"})

    sobrando_no_header, sobrando_no_editor = _comparar_enderecos(do_header, do_editor)

    assert sobrando_no_header == frozenset()
    assert sobrando_no_editor == frozenset({"%QX0.2"})


# Casa o mapa exportado por `GPIO_DO_ENDERECO` em enderecos.ts: captura o
# conteudo entre chaves do objeto, depois extrai os pares 'endereco': gpio
# dentro dele -- mesma estrategia de duas fases usada acima para as listas,
# pelo mesmo motivo (nao varrer o arquivo inteiro por acidente).
_TS_GPIO_MAP_RE = re.compile(r"export const GPIO_DO_ENDERECO[^=]*=\s*\{(?P<itens>[^}]*)\}")
_TS_GPIO_PAR_RE = re.compile(r"'(%[IQ]X\d+\.\d+)'\s*:\s*(\d+)")


def _parse_frontend_gpio_do_endereco() -> dict[str, int]:
    """Extrai o mapa `GPIO_DO_ENDERECO` de enderecos.ts (rodape do
    PainelVariaveis, contrato fixado no plano da spec 002)."""
    text = FRONTEND_ENDERECOS_PATH.read_text(encoding="utf-8")
    match = _TS_GPIO_MAP_RE.search(text)
    assert match, (
        "GPIO_DO_ENDERECO nao encontrado em "
        f"{FRONTEND_ENDERECOS_PATH}: o parser deste teste provavelmente "
        "ficou incompativel com o formato do arquivo -- corrija o parser ou "
        "confira se a constante nao foi removida por engano"
    )
    pares = {
        endereco: int(gpio) for endereco, gpio in _TS_GPIO_PAR_RE.findall(match.group("itens"))
    }
    assert pares, (
        f"GPIO_DO_ENDERECO encontrado vazio em {FRONTEND_ENDERECOS_PATH}: "
        "o parser deste teste provavelmente ficou incompativel com o "
        "formato do arquivo"
    )
    return pares


def _comparar_mapas_gpio(
    do_header: dict[str, int], do_editor: dict[str, int]
) -> tuple[frozenset[str], frozenset[str], frozenset[str]]:
    """Compara dois mapas endereco -> GPIO e devolve `(sobrando_no_header,
    sobrando_no_editor, gpio_diferente)`: chaves que existem so de um lado, e
    chaves presentes nos dois lados mas com GPIO diferente.

    Funcao pura -- nao le arquivo nenhum --, no mesmo espirito de
    `_comparar_enderecos`, para que o teste negativo abaixo prove o
    comparador nos tres jeitos de morder sem depender do conteudo real do
    repositorio.
    """
    chaves_header = frozenset(do_header)
    chaves_editor = frozenset(do_editor)
    comuns = chaves_header & chaves_editor
    gpio_diferente = frozenset(
        endereco for endereco in comuns if do_header[endereco] != do_editor[endereco]
    )
    return chaves_header - chaves_editor, chaves_editor - chaves_header, gpio_diferente


# Ressalva R-3 do plano, mesma motivacao de test_enderecos_do_editor_bate_com_
# plc_io_map acima, mas conferindo tambem o NUMERO do GPIO, nao so a
# presenca do endereco: um editor que oferecesse '%IX0.2' apontando para o
# GPIO errado no rodape do painel enganaria quem le o mapa antes de gravar,
# sem que o teste anterior (que so compara conjuntos de enderecos) acusasse
# nada.
def test_gpio_do_endereco_bate_com_plc_io_map() -> None:
    do_header = {_symbol_to_address(entry.variable): entry.gpio for entry in _parse_header()}
    do_editor = _parse_frontend_gpio_do_endereco()

    sobrando_no_header, sobrando_no_editor, gpio_diferente = _comparar_mapas_gpio(
        do_header, do_editor
    )

    assert not sobrando_no_header and not sobrando_no_editor and not gpio_diferente, (
        "GPIO_DO_ENDERECO (frontend/src/ladder/enderecos.ts) divergiu de "
        f"plc_io_map.h: sobrando_no_header={sorted(sobrando_no_header)} "
        f"sobrando_no_editor={sorted(sobrando_no_editor)} "
        f"gpio_diferente={sorted(gpio_diferente)}"
    )


def test_comparador_de_mapas_gpio_morde_com_endereco_a_mais() -> None:
    do_header = {"%IX0.0": 0, "%QX0.0": 2, "%IX0.2": 19}
    do_editor = {"%IX0.0": 0, "%QX0.0": 2}

    sobrando_no_header, sobrando_no_editor, gpio_diferente = _comparar_mapas_gpio(
        do_header, do_editor
    )

    assert sobrando_no_header == frozenset({"%IX0.2"})
    assert sobrando_no_editor == frozenset()
    assert gpio_diferente == frozenset()


def test_comparador_de_mapas_gpio_morde_com_gpio_diferente() -> None:
    do_header = {"%IX0.0": 0, "%QX0.0": 2}
    do_editor = {"%IX0.0": 0, "%QX0.0": 99}

    sobrando_no_header, sobrando_no_editor, gpio_diferente = _comparar_mapas_gpio(
        do_header, do_editor
    )

    assert sobrando_no_header == frozenset()
    assert sobrando_no_editor == frozenset()
    assert gpio_diferente == frozenset({"%QX0.0"})
