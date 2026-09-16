"""Medicao do preset25 (investigacao "erro de fase, nao limite intrinseco?"
para o experimento BLINK-com-CTU de spikes/modelo/NOTAS.md).

NAO e teste do projeto (fica em spikes/modelo/preset25/, fora de
backend/tests/, mesma razao de spikes/modelo/verificar_blink_ladder.py: nao
misturar artefato de spike com a suite real). Reaproveita
backend/tests/diferencial/{executores,comparador,fixtures}.py POR IMPORT
(mesmo mecanismo de sys.path que verificar_blink_ladder.py ja usa) -- nenhum
codigo de la e copiado para aqui.

Roda `blink.st` (gabarito forte) e cada variante de preset25/*.st, ambos
pelo MESMO `plc_host_runner`, com 200 ciclos e tres padroes de %IX0.0:

  (a) sempre 0
  (b) um pulso de 1 ciclo no ciclo 60
  (c) pressionado dos ciclos 45 a 55 (atravessa a transicao do ciclo 50)

e compara ciclo a ciclo com `comparador.comparar_execucoes` (comparacao
COMPLETA, nao o gabarito esparso de um .toml).

Uso (dentro do container, Regra 5 do CLAUDE.md):

    docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \\
      -v "$(pwd):/repo" -w /repo/backend ladderflow-backend:dev \\
      python /repo/spikes/modelo/preset25/medir.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_TESTS = REPO_ROOT / "backend" / "tests"
SPIKE_DIR = Path(__file__).resolve().parent

sys.path.insert(0, str(BACKEND_TESTS))

from diferencial.comparador import comparar_execucoes, formatar_relatorio  # noqa: E402
from diferencial.executores import ExecutorIndisponivel, HostRunnerExecutor  # noqa: E402

BLINK_ST = BACKEND_TESTS / "fixtures" / "blink.st"
CICLOS = 200


def padrao_a() -> list[dict[str, bool]]:
    """(a) %IX0.0 sempre 0."""
    return [{"%IX0.0": False} for _ in range(CICLOS)]


def padrao_b() -> list[dict[str, bool]]:
    """(b) um pulso de 1 ciclo no ciclo 60."""
    entradas = [{"%IX0.0": False} for _ in range(CICLOS)]
    entradas[60 - 1] = {"%IX0.0": True}
    return entradas


def padrao_c() -> list[dict[str, bool]]:
    """(c) pressionado dos ciclos 45 a 55 (atravessa a transicao do ciclo 50)."""
    entradas = [{"%IX0.0": False} for _ in range(CICLOS)]
    for indice in range(45 - 1, 55):
        entradas[indice] = {"%IX0.0": True}
    return entradas


PADROES: dict[str, list[dict[str, bool]]] = {
    "(a) sempre 0": padrao_a(),
    "(b) pulso ciclo 60": padrao_b(),
    "(c) pressionado 45-55": padrao_c(),
}

VARIANTES: list[Path] = sorted(SPIKE_DIR.glob("variante_*.st"))


def main() -> int:
    executor = HostRunnerExecutor()
    print(f"plc_host_runner disponivel: {executor.disponivel()} (caminho={executor.caminho})")
    if not executor.disponivel():
        print("ERRO: plc_host_runner nao disponivel -- ver docs/validacao/contrato-runtime-host.md")
        return 1

    if not VARIANTES:
        print(f"ERRO: nenhuma variante encontrada em {SPIKE_DIR}")
        return 1

    print(f"\n{len(VARIANTES)} variante(s) encontrada(s): {[v.name for v in VARIANTES]}")

    # Gabarito forte: blink.st real, um resultado por padrao (200 ciclos).
    referencias: dict[str, list[dict[str, bool]]] = {}
    print("\n=== Gabarito: blink.st, 200 ciclos, 3 padroes de %IX0.0 ===")
    for nome_padrao, entradas in PADROES.items():
        resultado = executor.executar(BLINK_ST, entradas)
        referencias[nome_padrao] = resultado.ciclos
        print(f"  {nome_padrao}: {len(resultado.ciclos)} ciclo(s) obtidos de blink.st, ok")

    linhas_tabela: list[tuple[str, str, str, str]] = []

    for variante_path in VARIANTES:
        nome_variante = variante_path.stem
        print(f"\n=== Variante: {nome_variante} ===")
        for nome_padrao, entradas in PADROES.items():
            try:
                resultado = executor.executar(variante_path, entradas)
            except ExecutorIndisponivel as erro:
                mensagem = str(erro).strip().splitlines()
                resumo = mensagem[-1] if mensagem else str(erro)
                print(f"  {nome_padrao}: NAO COMPILA -- {resumo[:200]}")
                linhas_tabela.append((nome_variante, nome_padrao, "nao compila", "-"))
                continue

            if len(resultado.ciclos) != CICLOS:
                print(
                    f"  {nome_padrao}: ERRO -- esperava {CICLOS} ciclos, "
                    f"recebeu {len(resultado.ciclos)} (stderr={resultado.stderr!r})"
                )
                linhas_tabela.append((nome_variante, nome_padrao, "erro de execucao", "-"))
                continue

            divergencias = comparar_execucoes(referencias[nome_padrao], resultado.ciclos)
            if not divergencias:
                print(f"  {nome_padrao}: 0 divergencias (equivalente nos 200 ciclos)")
                linhas_tabela.append((nome_variante, nome_padrao, "0", "-"))
            else:
                primeiro = divergencias[0].ciclo
                print(f"  {nome_padrao}: {len(divergencias)} divergencia(s), primeira no ciclo {primeiro}")
                print(f"    {formatar_relatorio(divergencias[:5])}")
                if len(divergencias) > 5:
                    print(f"    ... (+{len(divergencias) - 5} divergencia(s) omitida(s))")
                linhas_tabela.append(
                    (nome_variante, nome_padrao, str(len(divergencias)), str(primeiro))
                )

    print("\n=== Tabela resumida (variante, padrao, divergencias, primeiro ciclo) ===")
    for linha in linhas_tabela:
        print("  " + " | ".join(linha))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
