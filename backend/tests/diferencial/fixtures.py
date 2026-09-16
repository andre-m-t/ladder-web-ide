"""Carrega fixtures do teste diferencial a partir de arquivos `.toml`.

Formato escolhido: **TOML**. Justificativa (ver `README.md` para o texto
completo pensado para `docs/`): é biblioteca padrão em leitura (`tomllib`,
sem dependência nova em `requirements-dev.txt`, fora do escopo desta
frente), aceita comentário — o que uma fixture "legível por humano" pede e
JSON não oferece — e já é o formato que o próprio projeto usa
(`pyproject.toml`), então não introduz uma sintaxe nova no repositório.

Cada fixture descreve: o `.st` a compilar, quantos ciclos rodar, as entradas
por ciclo (em **faixas**, para não repetir a mesma linha dezenas de vezes) e
um gabarito **esparso** de saídas esperadas (só os ciclos que importam
entram — ver `PontoDeVerificacao`).
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path


class FixtureInvalida(ValueError):
    """A fixture não respeita o formato esperado (ver `README.md`)."""


@dataclass(frozen=True)
class FaixaDeEntrada:
    """Um intervalo fechado `[de, ate]` (1-based) com os mesmos valores de entrada.

    Existe para não repetir a mesma linha de entrada uma vez por ciclo quando
    ela não muda — caso comum (ex.: `%IX0.0` parado em 0 por 50 ciclos).
    """

    de: int
    ate: int
    valores: dict[str, bool]


@dataclass(frozen=True)
class PontoDeVerificacao:
    """Um ponto de verificação esparso da fixture.

    Só os ciclos citados explicitamente na fixture são comparados contra a
    saída do executor — o gabarito não precisa (nem deve) descrever todos os
    ciclos rodados, só os que provam o comportamento sob teste.
    """

    ciclo: int
    valores: dict[str, bool]


@dataclass(frozen=True)
class Fixture:
    """Uma fixture diferencial completa: ST + entradas por ciclo + gabarito esparso."""

    nome: str
    st_path: Path
    descricao: str
    ciclos: int
    entradas: list[FaixaDeEntrada]
    saidas_esperadas: list[PontoDeVerificacao]
    # Se True, um ponto de verificacao tambem reprova quando o executor
    # devolve um endereco NAO citado no gabarito daquele ciclo (usado no caso
    # de borda de minimal.st, que nao deveria emitir endereco nenhum).
    saida_exata: bool

    def entradas_por_ciclo(self) -> list[dict[str, bool]]:
        """Expande as faixas em uma lista densa, uma entrada por ciclo.

        Ciclos não cobertos por nenhuma faixa entram como `{}` — linha vazia
        no stdin do executor, "sem entradas ativas" nesse ciclo. Faixas
        declaradas depois sobrescrevem as anteriores onde há sobreposição.
        """
        densa: list[dict[str, bool]] = [{} for _ in range(self.ciclos)]
        for faixa in self.entradas:
            for indice in range(faixa.de - 1, faixa.ate):
                densa[indice] = dict(faixa.valores)
        return densa


def carregar_fixture(caminho_toml: Path, diretorio_st: Path) -> Fixture:
    """Lê e valida uma fixture `.toml`. `diretorio_st` resolve o campo `st`."""
    dados = tomllib.loads(caminho_toml.read_text(encoding="utf-8"))

    campos_obrigatorios = {"st", "ciclos"}
    faltando = campos_obrigatorios - dados.keys()
    if faltando:
        raise FixtureInvalida(
            f"{caminho_toml.name}: campo(s) obrigatorio(s) ausente(s): {sorted(faltando)}"
        )

    ciclos = dados["ciclos"]
    st_path = diretorio_st / dados["st"]
    if not st_path.is_file():
        raise FixtureInvalida(f"{caminho_toml.name}: arquivo ST nao encontrado: {st_path}")

    entradas = [
        FaixaDeEntrada(de=item["de"], ate=item["ate"], valores=item.get("valores", {}))
        for item in dados.get("entradas", [])
    ]
    saidas_esperadas = [
        PontoDeVerificacao(ciclo=item["ciclo"], valores=item.get("valores", {}))
        for item in dados.get("saidas_esperadas", [])
    ]

    for ponto in saidas_esperadas:
        if not (1 <= ponto.ciclo <= ciclos):
            raise FixtureInvalida(
                f"{caminho_toml.name}: ponto de verificacao no ciclo {ponto.ciclo}, "
                f"fora do intervalo [1, {ciclos}]"
            )

    return Fixture(
        nome=caminho_toml.stem,
        st_path=st_path,
        descricao=dados.get("descricao", ""),
        ciclos=ciclos,
        entradas=entradas,
        saidas_esperadas=saidas_esperadas,
        saida_exata=dados.get("saida_exata", False),
    )
