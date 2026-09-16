"""Script de verificacao do experimento BLINK do spike S4 (NAO e teste do
projeto -- fica em spikes/modelo/, nao em backend/tests/, para nao misturar
artefato de spike com a suite real).

Roda blink_ladder.st (e, para comparacao, o blink.st original) contra o
`plc_host_runner` real (mesmo executor que backend/tests/test_diferencial.py
usa) e reporta:

  1. blink.st contra fixtures/blink.toml (deve bater -- sanity check do
     proprio arcabouco, nao inventamos nada nele);
  2. blink_ladder.st contra o MESMO gabarito (blink_ladder.toml, copia local
     do blink.toml) -- a pergunta que interessa ao spike;
  3. comparacao completa ciclo a ciclo (nao so o gabarito esparso) entre
     blink.st e blink_ladder.st;
  4. a tentativa alternativa (mesmo desenho, PV=12 em vez de 13), citada em
     NOTAS.md como o segundo ponto medido da secao "Experimento BLINK".

Uso (dentro do container, unico lugar com iec2c/gcc no PATH esperado):

    docker run --rm -v "$(pwd):/repo" -w /repo/backend ladderflow-backend:dev \\
      python /repo/spikes/modelo/verificar_blink_ladder.py
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_TESTS = REPO_ROOT / "backend" / "tests"
SPIKE_DIR = Path(__file__).resolve().parent

# `diferencial` so e importavel com backend/tests no sys.path (mesmo
# mecanismo que o pytest faz sozinho via rootdir -- aqui e manual, porque
# este script roda fora do pytest, de proposito, para nao virar teste do
# projeto).
sys.path.insert(0, str(BACKEND_TESTS))

from diferencial.comparador import comparar_execucoes, comparar_fixture, formatar_relatorio  # noqa: E402
from diferencial.executores import HostRunnerExecutor  # noqa: E402
from diferencial.fixtures import carregar_fixture  # noqa: E402
from diferencial.runner import rodar_fixture  # noqa: E402


def main() -> int:
    executor = HostRunnerExecutor()
    print(f"plc_host_runner disponivel: {executor.disponivel()} (caminho={executor.caminho})")
    if not executor.disponivel():
        print("ERRO: plc_host_runner nao disponivel -- ver docs/validacao/contrato-runtime-host.md")
        return 1

    print("\n=== 1. blink.st (original) contra backend/tests/diferencial/fixtures/blink.toml ===")
    fixture_original = carregar_fixture(
        BACKEND_TESTS / "diferencial" / "fixtures" / "blink.toml", BACKEND_TESTS / "fixtures"
    )
    divergencias_original = rodar_fixture(fixture_original, executor)
    print(formatar_relatorio(divergencias_original))

    print("\n=== 2. blink_ladder.st contra o mesmo gabarito (blink_ladder.toml) ===")
    fixture_ladder = carregar_fixture(SPIKE_DIR / "blink_ladder.toml", SPIKE_DIR)
    divergencias_ladder = rodar_fixture(fixture_ladder, executor)
    print(formatar_relatorio(divergencias_ladder))

    print("\n=== 3. comparacao ciclo a ciclo, execucao completa (blink.st vs blink_ladder.st) ===")
    resultado_original = executor.executar(
        fixture_original.st_path, fixture_original.entradas_por_ciclo()
    )
    resultado_ladder = executor.executar(fixture_ladder.st_path, fixture_ladder.entradas_por_ciclo())
    # So compara %QX0.0 -- blink_ladder.st tem variaveis internas extras
    # (pulso/atingiu/reset_ctu) que nao sao localizadas e portanto nao
    # aparecem na saida do plc_host_runner (so imprime enderecos IEC).
    divergencias_completas = comparar_execucoes(resultado_original.ciclos, resultado_ladder.ciclos)
    print(formatar_relatorio(divergencias_completas))

    print("\n=== 4. tentativa alternativa: mesmo desenho, PV=12 (blink_ladder_pv12.toml) ===")
    fixture_pv12 = carregar_fixture(SPIKE_DIR / "blink_ladder_pv12.toml", SPIKE_DIR)
    divergencias_pv12 = rodar_fixture(fixture_pv12, executor)
    print(formatar_relatorio(divergencias_pv12))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
