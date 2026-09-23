"""Teste diferencial do simulador Ladder (spec 004): motor em TypeScript x
runtime em C.

Mede CA-1 a CA-3 da spec 004, executando o `SimuladorExecutor` -- o motor de
simulação (`frontend/src/ladder/simulacao.ts`) exposto sem interface via
`frontend/src/ladder/simulacao-cli.ts` (RF-19) -- e comparando a saída contra
o gabarito já registrado (CA-1) ou contra o `plc_host_runner` real (CA-2). É
a segunda metade da métrica central do trabalho: até esta spec, o arcabouço
diferencial (`backend/tests/diferencial/`, pronto desde 2026-09-15) só tinha
um lado -- `test_diferencial.py` mede o gabarito escrito à mão,
`test_serializador_diferencial.py` mede o ST que o serializador realmente
produz. Nenhum dos dois roda o simulador. Este arquivo é o primeiro que roda.

Este arquivo espelha `test_serializador_diferencial.py` de propósito: mesma
estrutura de cenários, mesmo trio de padrões de entrada do `blink`, mesmo uso
de `formatar_relatorio` na mensagem de falha. A diferença está no que cada um
mede: aquele mede "o ST que a IDE serializou é equivalente ao ST de
referência"; este mede "o simulador que roda no navegador concorda com o
runtime em C que vai rodar no ESP32" -- a pergunta que RF-7/RF-8 da spec 004
exigem que seja respondida por **duas leituras independentes**, nunca por uma
leitura compartilhada.

**O que este teste prova, e o que não prova (RF-7, RF-8):**

- Prova que, nos cenários medidos, a energização calculada por propagação de
  fluxo (`simulacao.ts`, D-1 do plano 004) e a energização implícita no texto
  ST compilado e executado pelo `iec2c`/runtime em C concordam ciclo a ciclo,
  ponto a ponto.
- NÃO prova que as duas leituras de topologia são a mesma leitura -- ao
  contrário: RF-7 PROÍBE que sejam. O simulador nunca importa
  `serializador.ts`, nunca lê o `.st`, nunca fala com o compilador ou com o
  servidor. Se um dia esta proibição for violada "para simplificar", este
  teste continuaria passando e pararia de medir qualquer coisa -- exatamente
  o modo de falha que a tensão registrada no §10 da spec 004 e no §9 do plano
  existem para impedir.
- NÃO ajusta o simulador para bater com o runtime (nem o inverso). Uma
  divergência real, se aparecer, é resultado a isolar (ciclo, ponto,
  esperado, obtido -- CA-3) e reportar, nunca a acomodar editando um dos
  lados até a métrica zerar. Nenhum código de `frontend/src/ladder/` é
  alterado por esta frente de trabalho (propriedade de arquivo do plano,
  §8) -- uma divergência encontrada aqui é reportada ao orquestrador, não
  corrigida por quem escreveu este arquivo.

**Regra de pulo -- duas situações, tratamento diferente (RF-8, D-10):**

1. `plc_host_runner` indisponível neste ambiente: pula limpo (mesmo
   marcador de `test_serializador_diferencial.py`) -- é uma dependência
   externa (`make`/`gcc`) que pode faltar sem que isso seja uma falha deste
   arcabouço.
2. `node`/empacotamento do simulador não funcionam, OU o diagrama JSON
   irmão (`backend/tests/fixtures/diagramas/<nome>.json`, D-11) ainda não
   foi gerado pela frente do motor: **falha, nunca pula**. Um arcabouço de
   medição que passa sem medir nada é pior que um que falha -- é lido como
   evidência (`diferencial/executores.py`, docstring de
   `_empacotar_sob_demanda`). `SimuladorExecutor.executar` levanta
   `ExecutorIndisponivel` com o arquivo exato que falta nesses casos; este
   módulo converte isso em falha de teste explícita (`pytest.fail`), não em
   skip.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from diferencial.comparador import comparar_execucoes, formatar_relatorio
from diferencial.executores import ExecutorIndisponivel, HostRunnerExecutor, SimuladorExecutor
from diferencial.fixtures import carregar_fixture
from diferencial.runner import rodar_fixture

FIXTURES_ST_REFERENCIA_DIR = Path(__file__).parent / "fixtures"
FIXTURES_ST_SERIALIZADOS_DIR = FIXTURES_ST_REFERENCIA_DIR / "serializados"
FIXTURES_DIFERENCIAL_DIR = Path(__file__).parent / "diferencial" / "fixtures"
FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR = FIXTURES_DIFERENCIAL_DIR / "serializador"

executor_simulador = SimuladorExecutor()
executor_host = HostRunnerExecutor()

host_runner_disponivel = pytest.mark.skipif(
    not executor_host.disponivel(),
    reason=(
        "plc_host_runner nao disponivel neste ambiente -- defina PLC_HOST_RUNNER "
        "ou aguarde o binario no PATH (ver contrato-runtime-host.md)"
    ),
)


# (nome do cenario, diretorio do TOML de gabarito) -- os 5 cenarios de CA-1,
# sem contador (o `blink`, com contador, entra so na CA-2, abaixo, porque
# exige 200 ciclos e os 3 padroes de entrada do spike, nao o gabarito
# esparso de 50 pontos usado aqui).
_CENARIOS_SEM_CONTADOR = [
    ("io_espelho", FIXTURES_DIFERENCIAL_DIR),
    ("minimal", FIXTURES_DIFERENCIAL_DIR),
    ("ramo_ou", FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR),
    ("set_reset", FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR),
    ("selo", FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR),
    ("portao", FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR),
    ("saidas_paralelas", FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR),
    # Fixture de bancada (revisao aditiva 2026-09-21): espelha os 16 pinos
    # localizados de uma vez (frontend/src/ladder/fixtures.ts, IO_ESPELHO_8).
    ("io_espelho_8", FIXTURES_DIFERENCIAL_SERIALIZADOR_DIR),
]


@pytest.mark.parametrize("nome,diretorio_toml", _CENARIOS_SEM_CONTADOR)
def test_simulador_sem_divergencia_contra_gabarito(nome: str, diretorio_toml: Path) -> None:
    """CA-1 (RF-1, RF-2, RF-3, RF-19, RF-20): os 5 cenarios de referencia sem
    contador, executados no SimuladorExecutor, batem o gabarito ja registrado
    em `diferencial/fixtures/*.toml` -- as MESMAS fixtures que
    `test_diferencial.py` (gabarito escrito a mao) e
    `test_serializador_diferencial.py` (ST do serializador) ja usam, sem
    alterar nenhuma delas (RF-20).

    O `.st` referenciado pelo TOML vem de `fixtures/serializados/` (o
    dourado do serializador, ja gerado -- spec 003); o SimuladorExecutor
    resolve o diagrama irmao dele em `fixtures/diagramas/` pelo nome
    (D-11). Se esse diagrama ainda nao existir, o teste FALHA (nao pula) --
    ver o docstring do modulo.
    """
    fixture = carregar_fixture(diretorio_toml / f"{nome}.toml", FIXTURES_ST_SERIALIZADOS_DIR)

    motivo_indisponivel: str | None = None
    divergencias: list = []
    try:
        divergencias = rodar_fixture(fixture, executor_simulador)
    except ExecutorIndisponivel as erro:
        motivo_indisponivel = str(erro)

    if motivo_indisponivel is not None:
        # RF-8: falha explicita, nunca skip -- um arcabouco que passa sem
        # medir nada e pior que um que falha.
        pytest.fail(motivo_indisponivel, pytrace=False)

    assert not divergencias, formatar_relatorio(divergencias)


# Trio de padroes de %IX0.0 do spike (spikes/modelo/preset25/medir.py e
# RESULTADO.md) -- o MESMO trio usado por
# test_serializador_diferencial.py::test_blink_ctu_sem_divergencia_200_ciclos,
# para que a comparacao simulador x runtime rode exatamente sobre os mesmos
# cenarios ja medidos do lado ST x ST.
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
def test_blink_simulador_sem_divergencia_200_ciclos(
    nome_padrao: str, entradas: list[dict[str, bool]]
) -> None:
    """CA-2 (RF-4, RF-8): o simulador roda `blink` (contador CTU) 200 ciclos
    contra o `plc_host_runner` executando `backend/tests/fixtures/blink.st`
    -- o ST de referencia da spec 001, nao o dourado do serializador -- nos 3
    padroes de entrada ja medidos no spike e no teste irmao. Exige 0
    divergencias.

    `blink.st` fica direto em `fixtures/`, nao em `fixtures/serializados/`;
    o SimuladorExecutor resolve o mesmo jeito (pelo NOME do arquivo -- D-11),
    achando `fixtures/diagramas/blink.json`, gerado a partir do MESMO
    diagrama `BLINK` (`frontend/src/ladder/fixtures.ts`) que gera o
    `blink.st` dourado, ja provado equivalente ao `blink.st` de referencia
    por `test_blink_ctu_sem_divergencia_200_ciclos`.
    """
    blink_st = FIXTURES_ST_REFERENCIA_DIR / "blink.st"

    saida_host = executor_host.executar(blink_st, entradas).ciclos

    motivo_indisponivel: str | None = None
    saida_simulador: list = []
    try:
        saida_simulador = executor_simulador.executar(blink_st, entradas).ciclos
    except ExecutorIndisponivel as erro:
        motivo_indisponivel = str(erro)

    if motivo_indisponivel is not None:
        # RF-8: falha explicita, nunca skip.
        pytest.fail(motivo_indisponivel, pytrace=False)

    divergencias = comparar_execucoes(saida_host, saida_simulador)

    assert not divergencias, f"{nome_padrao}: {formatar_relatorio(divergencias)}"


def test_relatorio_de_divergencia_traz_ciclo_ponto_esperado_obtido() -> None:
    """CA-3 (RF-21): fumaca do formato de mensagem no contexto deste executor --
    a logica de comparacao em si ja e testada isoladamente em
    `test_diferencial.py::test_comparar_execucoes_*`. Roda sempre, sem
    depender de `node` nem de `plc_host_runner`: e teste da MENSAGEM, nao do
    processo.
    """
    divergencias = comparar_execucoes(
        [{"%QX0.0": True}, {"%QX0.0": True}],
        [{"%QX0.0": True}, {"%QX0.0": False}],
    )

    mensagem = formatar_relatorio(divergencias)

    assert "ciclo=2" in mensagem
    assert "%QX0.0" in mensagem
    assert "esperado=True" in mensagem
    assert "obtido=False" in mensagem
