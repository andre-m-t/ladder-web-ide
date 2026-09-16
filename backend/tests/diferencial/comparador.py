"""Compara saídas de execução e reporta divergências CICLO/PONTO/ESPERADO/OBTIDO.

Duas formas de comparação, mesmo tipo de resultado (`Divergencia`) nas duas:

- `comparar_fixture`: hoje. Um executor contra o gabarito **esparso** de uma
  fixture (só os ciclos citados na fixture são checados).
- `comparar_execucoes`: pensada para quando F9 existir. Duas execuções
  **completas** (uma por executor), comparadas ciclo a ciclo, endereço a
  endereço, sem depender de gabarito nenhum escrito à mão — o "gabarito" de
  um lado passa a ser a saída do outro executor. Já testada isoladamente em
  `test_diferencial.py` com dados sintéticos, para não haver lógica de
  comparação nova para escrever quando o segundo executor chegar: só
  instanciá-lo e chamar esta função com as duas saídas.
"""

from __future__ import annotations

from dataclasses import dataclass

from .fixtures import Fixture


@dataclass(frozen=True)
class Divergencia:
    """Um ponto onde esperado e obtido não batem. `None` = endereço ausente daquele lado."""

    ciclo: int
    ponto: str
    esperado: bool | None
    obtido: bool | None

    def __str__(self) -> str:
        esperado = "(ausente)" if self.esperado is None else str(self.esperado)
        obtido = "(ausente)" if self.obtido is None else str(self.obtido)
        return f"ciclo={self.ciclo} ponto={self.ponto} esperado={esperado} obtido={obtido}"


def formatar_relatorio(divergencias: list[Divergencia]) -> str:
    """Mensagem de falha do pytest: uma linha por divergência, CICLO/PONTO/ESPERADO/OBTIDO."""
    if not divergencias:
        return "nenhuma divergencia"
    linhas = "\n".join(str(divergencia) for divergencia in divergencias)
    return f"{len(divergencias)} divergencia(s):\n{linhas}"


def comparar_fixture(fixture: Fixture, saidas_obtidas: list[dict[str, bool]]) -> list[Divergencia]:
    """Compara a saída de um executor contra o gabarito esparso de `fixture`.

    Só os ciclos citados em `fixture.saidas_esperadas` são verificados. Por
    padrão, só as chaves citadas em cada ponto são comparadas (a saída pode
    ter outros endereços que a fixture não quis checar naquele ciclo); com
    `fixture.saida_exata=True`, um endereço que aparece na saída mas não no
    gabarito daquele ciclo também é reportado como divergência — usado para
    provar que um programa sem variáveis localizadas (`minimal.st`) não
    inventa endereço nenhum.
    """
    divergencias: list[Divergencia] = []
    for ponto in fixture.saidas_esperadas:
        indice = ponto.ciclo - 1
        if not (0 <= indice < len(saidas_obtidas)):
            raise ValueError(
                f"{fixture.nome}: gabarito pede o ciclo {ponto.ciclo}, mas o executor "
                f"devolveu apenas {len(saidas_obtidas)} ciclo(s)"
            )
        obtido = saidas_obtidas[indice]
        chaves = set(ponto.valores) | (set(obtido) if fixture.saida_exata else set())
        for chave in sorted(chaves):
            esperado = ponto.valores.get(chave)
            valor_obtido = obtido.get(chave)
            if esperado != valor_obtido:
                divergencias.append(Divergencia(ponto.ciclo, chave, esperado, valor_obtido))
    return divergencias


def comparar_execucoes(
    esperado: list[dict[str, bool]], obtido: list[dict[str, bool]]
) -> list[Divergencia]:
    """Compara ciclo a ciclo, endereço a endereço, duas execuções completas.

    Uso pretendido (ver `README.md`, "Ponto de extensão para F9"): as duas
    listas vêm direto de `Executor.executar(...).ciclos` de dois executores
    diferentes rodando a mesma fixture — nenhuma adaptação entre elas e esta
    função. Comparação é exata dos dois lados: um endereço que só um dos
    executores relatou também é divergência.
    """
    divergencias: list[Divergencia] = []
    total_ciclos = max(len(esperado), len(obtido))
    for indice in range(total_ciclos):
        ciclo = indice + 1
        saida_esperada = esperado[indice] if indice < len(esperado) else {}
        saida_obtida = obtido[indice] if indice < len(obtido) else {}
        for chave in sorted(set(saida_esperada) | set(saida_obtida)):
            valor_esperado = saida_esperada.get(chave)
            valor_obtido = saida_obtida.get(chave)
            if valor_esperado != valor_obtido:
                divergencias.append(Divergencia(ciclo, chave, valor_esperado, valor_obtido))
    return divergencias
