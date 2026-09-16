"""Teste diferencial: roda fixtures contra o `plc_host_runner` real e reporta
divergencias CICLO/PONTO/ESPERADO/OBTIDO.

Este e o arcabouco que vai, no futuro, produzir a metrica "divergencia
simulacao <-> hardware" do TCC (F10) -- comparando o simulador TypeScript de
F9 contra o mesmo `plc_host_runner` usado aqui. F9 ainda nao existe; este
arquivo NAO o implementa e NAO finge que ele existe. Ver
`diferencial/README.md` para o formato de fixture, a abstracao `Executor` e o
ponto de extensao para o segundo executor.

Os testes que dependem do `plc_host_runner` sao pulados de forma limpa
enquanto o binario nao estiver disponivel (contrato publicado em
docs/validacao/contrato-runtime-host.md, implementado pela Frente A em
paralelo a este arcabouco) -- defina a variavel de ambiente
PLC_HOST_RUNNER ou instale o binario no PATH do container para rodar de
verdade. Os testes do comparador (`test_comparar_*`) nao dependem do
binario: sao logica pura, sempre rodam.
"""

from pathlib import Path

import pytest
from diferencial.comparador import (
    Divergencia,
    comparar_execucoes,
    comparar_fixture,
    formatar_relatorio,
)
from diferencial.executores import HostRunnerExecutor
from diferencial.fixtures import carregar_fixture
from diferencial.runner import rodar_fixture

FIXTURES_ST_DIR = Path(__file__).parent / "fixtures"
FIXTURES_DIFERENCIAL_DIR = Path(__file__).parent / "diferencial" / "fixtures"

executor_host = HostRunnerExecutor()

host_runner_disponivel = pytest.mark.skipif(
    not executor_host.disponivel(),
    reason=(
        "plc_host_runner nao disponivel neste ambiente -- defina PLC_HOST_RUNNER "
        "ou aguarde a Frente A publicar o binario (ver contrato-runtime-host.md)"
    ),
)


def _nomes_das_fixtures() -> list[str]:
    return sorted(caminho.stem for caminho in FIXTURES_DIFERENCIAL_DIR.glob("*.toml"))


@host_runner_disponivel
@pytest.mark.parametrize("nome", _nomes_das_fixtures())
def test_fixture_sem_divergencia_no_runtime_host(nome: str) -> None:
    """As tres fixtures (blink, io_espelho, minimal) batem com o runtime real."""
    fixture = carregar_fixture(FIXTURES_DIFERENCIAL_DIR / f"{nome}.toml", FIXTURES_ST_DIR)

    divergencias = rodar_fixture(fixture, executor_host)

    assert not divergencias, formatar_relatorio(divergencias)


def test_carrega_as_tres_fixtures_minimas() -> None:
    """Garante que as 3 fixtures exigidas existem e carregam, mesmo sem o runtime."""
    nomes = _nomes_das_fixtures()

    assert {"blink", "io_espelho", "minimal"} <= set(nomes)
    for nome in nomes:
        fixture = carregar_fixture(FIXTURES_DIFERENCIAL_DIR / f"{nome}.toml", FIXTURES_ST_DIR)
        assert fixture.st_path.is_file()
        assert fixture.ciclos == len(fixture.entradas_por_ciclo())


def test_comparar_fixture_relata_ciclo_ponto_esperado_obtido() -> None:
    """A mensagem de falha e o produto do arcabouco: precisa apontar onde exatamente
    a divergencia ocorreu, nao so dizer 'falhou'. Usa dados sinteticos -- nao
    depende do runtime host.
    """
    fixture = carregar_fixture(FIXTURES_DIFERENCIAL_DIR / "blink.toml", FIXTURES_ST_DIR)
    # Led nunca liga -- diverge exatamente nos ciclos 25, 26 e 49.
    saida_errada = [{"%QX0.0": False}] * fixture.ciclos

    divergencias = comparar_fixture(fixture, saida_errada)

    assert divergencias == [
        Divergencia(ciclo=25, ponto="%QX0.0", esperado=True, obtido=False),
        Divergencia(ciclo=26, ponto="%QX0.0", esperado=True, obtido=False),
        Divergencia(ciclo=49, ponto="%QX0.0", esperado=True, obtido=False),
    ]
    relatorio = formatar_relatorio(divergencias)
    assert "ciclo=25" in relatorio
    assert "ponto=%QX0.0" in relatorio
    assert "esperado=True" in relatorio
    assert "obtido=False" in relatorio


def test_comparar_fixture_saida_exata_reprova_endereco_inesperado() -> None:
    """Caso de borda de minimal.st: um endereco fantasma na saida tem que reprovar,
    nao passar por vacuidade so porque o gabarito daquele ciclo esta vazio.
    """
    fixture = carregar_fixture(FIXTURES_DIFERENCIAL_DIR / "minimal.toml", FIXTURES_ST_DIR)
    saida_com_fantasma = [{}, {"%QX9.9": True}]

    divergencias = comparar_fixture(fixture, saida_com_fantasma)

    assert divergencias == [Divergencia(ciclo=2, ponto="%QX9.9", esperado=None, obtido=True)]


def test_comparar_execucoes_iguais_nao_diverge() -> None:
    """Sanidade do comparador generico de duas execucoes completas -- e a funcao
    que vai comparar host x simulador (F9) quando os dois executores existirem
    (ver diferencial/README.md, 'Ponto de extensao'). Nao depende do runtime host.
    """
    execucao = [{"%QX0.0": False}, {"%QX0.0": True}]

    assert comparar_execucoes(execucao, execucao) == []


def test_comparar_execucoes_detecta_divergencia_entre_dois_executores() -> None:
    """Mesmo cenario de test_comparar_fixture_relata_..., mas na forma
    executor-contra-executor que F9 vai usar: sem gabarito escrito a mao, um
    lado e o 'esperado' do outro.
    """
    saida_executor_a = [{"%QX0.0": False}, {"%QX0.0": True}]
    saida_executor_b = [{"%QX0.0": False}, {"%QX0.0": False}]

    divergencias = comparar_execucoes(saida_executor_a, saida_executor_b)

    assert divergencias == [Divergencia(ciclo=2, ponto="%QX0.0", esperado=True, obtido=False)]
