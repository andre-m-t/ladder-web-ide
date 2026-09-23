"""Teste diferencial do serializador Ladder -> ST (spec 003).

Mede CA-1 a CA-4 da spec 003 executando, no `plc_host_runner`, o texto ST que
o serializador (`frontend/src/ladder/serializador.ts`) REALMENTE produz --
nao um ST escrito a mao que apenas se pretende equivalente. Os arquivos
dourados em `backend/tests/fixtures/serializados/*.st` sao gravados pelo
vitest (`frontend/src/ladder/serializador.dourados.test.ts`, via
`toMatchFileSnapshot`) a partir dos diagramas de referencia (`IO_ESPELHO`,
`MINIMAL`, `RAMO_OU`, `SET_RESET`, `SELO`, `BLINK`); este arquivo so os LE e
executa. Ver `docs/specs/003-serializador-ladder-st/plan.md`, D-11.

Isto quita a ressalva R-1 do plano 002: ali, a equivalencia entre o diagrama
editado na IDE e o ST que seria gerado era ASSUMIDA (nenhum serializador
existia ainda). Agora ela e MEDIDA: cada `.st` dourado compila no `iec2c` (o
proprio `plc_host_runner` o compila) e roda contra o gabarito esparso do
TOML correspondente:

- `io_espelho` e `minimal`: o gabarito ja existe em
  `diferencial/fixtures/{io_espelho,minimal}.toml` (fixtures reusadas sem
  mudanca -- plan.md, secao 2). Alem do gabarito, `comparar_execucoes` roda
  o dourado e o ST de referencia da spec 001
  (`backend/tests/fixtures/{io_espelho,minimal}.st`) com as MESMAS entradas
  e exige 0 divergencias -- prova de que o serializador nao so bate o
  gabarito, mas reproduz o comportamento do ST de referencia ponto a ponto.
- `ramo_ou`, `set_reset`, `selo`: cenarios novos da spec 003 (ramo/OR,
  SET/RESET com ordem de degrau, selo com realimentacao). Nao tem ST de
  referencia da spec 001 -- so o gabarito denso em
  `diferencial/fixtures/serializador/*.toml` (tarefa #3).
- `blink`: revisao aditiva com o contador `CTU` (`fixtures.ts`/`BLINK`,
  variante K de `spikes/modelo/preset25/RESULTADO.md`). Usa o MESMO gabarito
  de `diferencial/fixtures/blink.toml` (ja existente para o `blink.st` da
  spec 001 -- ver `test_diferencial.py`), porque a variante K foi desenhada
  para reproduzir exatamente o mesmo padrao de piscar. Alem do gabarito
  esparso (50 ciclos), `test_blink_ctu_sem_divergencia_200_ciclos` roda o
  dourado e o `blink.st` de referencia com 200 ciclos e 3 padroes de entrada
  (o mesmo trio medido no spike) e exige 0 divergencias nos tres -- a prova
  de execucao completa, nao so nos 5 pontos esparsos do TOML.

Pula de forma limpa, com motivo, em duas situacoes independentes:
1. `plc_host_runner` indisponivel neste ambiente (mesmo marcador de
   `test_diferencial.py` -- ver `diferencial/executores.py`);
2. o `.st` dourado do cenario ainda nao foi gerado (a Frente N gera via
   `npx vitest run -u` em `frontend/`, em paralelo a este arquivo).

Nunca falha por ausencia -- so por divergencia real contra o gabarito ou
contra a execucao de referencia.
"""

from __future__ import annotations

import tomllib
from pathlib import Path

import pytest
from diferencial.comparador import comparar_execucoes, formatar_relatorio
from diferencial.executores import HostRunnerExecutor
from diferencial.fixtures import carregar_fixture
from diferencial.runner import rodar_fixture

FIXTURES_ST_REFERENCIA_DIR = Path(__file__).parent / "fixtures"
FIXTURES_ST_SERIALIZADOS_DIR = FIXTURES_ST_REFERENCIA_DIR / "serializados"
FIXTURES_DIFERENCIAL_DIR = Path(__file__).parent / "diferencial" / "fixtures"
FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR = FIXTURES_DIFERENCIAL_DIR / "serializador"

executor_host = HostRunnerExecutor()

host_runner_disponivel = pytest.mark.skipif(
    not executor_host.disponivel(),
    reason=(
        "plc_host_runner nao disponivel neste ambiente -- defina PLC_HOST_RUNNER "
        "ou aguarde o binario no PATH (ver contrato-runtime-host.md)"
    ),
)

# (nome do cenario, diretorio do TOML de gabarito) -- os 6 cenarios de D-11
# (5 originais + `blink`, revisao aditiva do contador CTU).
_CENARIOS = [
    ("io_espelho", FIXTURES_DIFERENCIAL_DIR),
    ("minimal", FIXTURES_DIFERENCIAL_DIR),
    ("ramo_ou", FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR),
    ("set_reset", FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR),
    ("selo", FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR),
    ("blink", FIXTURES_DIFERENCIAL_DIR),
    ("portao", FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR),
    ("saidas_paralelas", FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR),
]

# Cenarios com ST de referencia da spec 001 (comparar_execucoes, alem do gabarito).
# `blink` nao entra aqui: o teste generico usaria so as entradas do TOML (50
# ciclos, padrao "sempre 0") -- `test_blink_ctu_sem_divergencia_200_ciclos`,
# abaixo, cobre o mesmo par de STs com 200 ciclos e os 3 padroes do spike.
_CENARIOS_COM_REFERENCIA = ("io_espelho", "minimal")


def _pular_se_dourado_ausente(nome: str) -> None:
    """Skip limpo, com motivo, se a Frente N ainda nao gerou o .st dourado."""
    caminho = FIXTURES_ST_SERIALIZADOS_DIR / f"{nome}.st"
    if not caminho.is_file():
        pytest.skip(
            f"{caminho.name} ainda nao foi gerado -- gerar com "
            "'npx vitest run -u' em frontend/ "
            "(frontend/src/ladder/serializador.dourados.test.ts)"
        )


@host_runner_disponivel
@pytest.mark.parametrize("nome,diretorio_toml", _CENARIOS)
def test_dourado_sem_divergencia_contra_gabarito(nome: str, diretorio_toml: Path) -> None:
    """O .st dourado do serializador bate o gabarito esparso do TOML (CA-1 a CA-4)."""
    _pular_se_dourado_ausente(nome)

    fixture = carregar_fixture(diretorio_toml / f"{nome}.toml", FIXTURES_ST_SERIALIZADOS_DIR)

    divergencias = rodar_fixture(fixture, executor_host)

    assert not divergencias, formatar_relatorio(divergencias)


@host_runner_disponivel
@pytest.mark.parametrize("nome", _CENARIOS_COM_REFERENCIA)
def test_dourado_sem_divergencia_contra_st_de_referencia(nome: str) -> None:
    """O .st dourado se comporta igual ao ST de referencia da spec 001, ciclo a
    ciclo, com as MESMAS entradas -- quita a R-1 do plano 002: a equivalencia
    diagrama <-> ST deixa de ser assumida e passa a ser medida.
    """
    _pular_se_dourado_ausente(nome)

    fixture_referencia = carregar_fixture(
        FIXTURES_DIFERENCIAL_DIR / f"{nome}.toml", FIXTURES_ST_REFERENCIA_DIR
    )
    fixture_dourada = carregar_fixture(
        FIXTURES_DIFERENCIAL_DIR / f"{nome}.toml", FIXTURES_ST_SERIALIZADOS_DIR
    )
    entradas = fixture_referencia.entradas_por_ciclo()

    saida_referencia = executor_host.executar(fixture_referencia.st_path, entradas).ciclos
    saida_dourada = executor_host.executar(fixture_dourada.st_path, entradas).ciclos

    divergencias = comparar_execucoes(saida_referencia, saida_dourada)

    assert not divergencias, formatar_relatorio(divergencias)


# Trio de padroes de %IX0.0 do spike (spikes/modelo/preset25/medir.py e
# RESULTADO.md): o mesmo usado para medir que a variante K fecha em 0
# divergencias contra o blink.st real, 200 ciclos.
_CICLOS_BLINK_CTU = 200


def _padrao_blink_sempre_zero() -> list[dict[str, bool]]:
    return [{"%IX0.0": False} for _ in range(_CICLOS_BLINK_CTU)]


def _padrao_blink_pulso_ciclo_60() -> list[dict[str, bool]]:
    entradas = _padrao_blink_sempre_zero()
    entradas[60 - 1] = {"%IX0.0": True}
    return entradas


def _padrao_blink_pressionado_45_55() -> list[dict[str, bool]]:
    entradas = _padrao_blink_sempre_zero()
    for indice in range(45 - 1, 55):
        entradas[indice] = {"%IX0.0": True}
    return entradas


_PADROES_BLINK_CTU = {
    "sempre 0": _padrao_blink_sempre_zero(),
    "pulso no ciclo 60": _padrao_blink_pulso_ciclo_60(),
    "pressionado 45-55": _padrao_blink_pressionado_45_55(),
}


@host_runner_disponivel
@pytest.mark.parametrize("nome_padrao,entradas", _PADROES_BLINK_CTU.items())
def test_blink_ctu_sem_divergencia_200_ciclos(
    nome_padrao: str, entradas: list[dict[str, bool]]
) -> None:
    """O `blink` dourado (contador CTU, variante K) roda 200 ciclos contra o
    `blink.st` real da spec 001 nos 3 padroes de `%IX0.0` medidos no spike
    (`spikes/modelo/preset25/RESULTADO.md`) e fecha em 0 divergencias nos
    tres -- a mesma medicao do spike, agora como teste do projeto, contra o
    .st que o serializador realmente produz (nao a variante escrita a mao).
    """
    _pular_se_dourado_ausente("blink")

    referencia = FIXTURES_ST_REFERENCIA_DIR / "blink.st"
    dourado = FIXTURES_ST_SERIALIZADOS_DIR / "blink.st"

    saida_referencia = executor_host.executar(referencia, entradas).ciclos
    saida_dourada = executor_host.executar(dourado, entradas).ciclos

    divergencias = comparar_execucoes(saida_referencia, saida_dourada)

    assert not divergencias, f"{nome_padrao}: {formatar_relatorio(divergencias)}"


def test_toml_do_serializador_existem_e_tem_gabarito_denso() -> None:
    """As 3 fixtures da tarefa #3 existem e casam com o formato esperado --
    roda sempre, mesmo sem `plc_host_runner` e mesmo antes do .st dourado
    existir (nao usa `carregar_fixture`, que exigiria o .st no disco).
    """
    nomes = sorted(caminho.stem for caminho in FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR.glob("*.toml"))

    assert nomes == ["io_espelho_8", "portao", "ramo_ou", "saidas_paralelas", "selo", "set_reset"]
    _GABARITO_DENSO = frozenset({"io_espelho_8", "ramo_ou", "saidas_paralelas", "selo", "set_reset"})
    for nome in nomes:
        caminho = FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR / f"{nome}.toml"
        dados = tomllib.loads(caminho.read_text(encoding="utf-8"))
        assert dados["st"] == f"{nome}.st"
        # Gabarito denso: um ponto de verificacao por ciclo rodado (`portao` e esparso).
        if nome in _GABARITO_DENSO:
            assert len(dados.get("saidas_esperadas", [])) == dados["ciclos"]


def test_toml_do_serializador_nao_entram_no_glob_do_test_diferencial() -> None:
    """Ficam em subdiretorio de proposito (plan.md, componente 'Fixtures
    diferenciais'): `test_diferencial.py` parametriza por
    `diferencial/fixtures/*.toml` (glob nao recursivo) com o diretorio de ST
    antigo -- se os TOMLs novos estivessem no mesmo nivel, aquele teste os
    carregaria com `diretorio_st` errado.
    """
    nomes_no_glob_antigo = {caminho.stem for caminho in FIXTURES_DIFERENCIAL_DIR.glob("*.toml")}

    assert not {"ramo_ou", "set_reset", "selo"} & nomes_no_glob_antigo
