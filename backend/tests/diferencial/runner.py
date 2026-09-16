"""Amarra fixture + executor + comparador numa única chamada.

É o "runner" citado no nome deste arcabouço: dado um `Executor` qualquer (hoje
só `HostRunnerExecutor` existe) e uma `Fixture` carregada, roda os ciclos e
devolve as divergências contra o gabarito — lista vazia é sucesso.
"""

from __future__ import annotations

from .comparador import Divergencia, comparar_fixture
from .executores import Executor
from .fixtures import Fixture


def rodar_fixture(fixture: Fixture, executor: Executor) -> list[Divergencia]:
    """Executa `fixture` em `executor` e devolve as divergências contra o gabarito."""
    resultado = executor.executar(fixture.st_path, fixture.entradas_por_ciclo())
    if len(resultado.ciclos) != fixture.ciclos:
        raise ValueError(
            f"{executor.nome}: esperava {fixture.ciclos} ciclo(s) de saida para "
            f"'{fixture.nome}', recebeu {len(resultado.ciclos)} (stderr: {resultado.stderr!r})"
        )
    return comparar_fixture(fixture, resultado.ciclos)
