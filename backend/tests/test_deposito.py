"""Prova que `scripts/build-deposito.sh` audita o pacote de depósito no INPI
antes de empacotar, e não só "monta e imprime para conferência manual".

O risco que este teste trava: a allowlist do script é uma lista de
*diretórios*; se um arquivo autoral (ex.: `plc_glue.c`) for renomeado ou
movido, ou se um artefato de terceiro/gerado (saída do `iec2c`, `sdkconfig`
gerado pelo ESP-IDF) vazar para dentro da árvore autoral, o pacote sai
silenciosamente errado. Os testes negativos provam que o guarda de fato barra
esses casos — não apenas que o `if` existe (cf. `backend/tests/test_esp32.py`
para o estilo de `skipif`/guarda usado aqui).

Os testes negativos usam uma cópia da árvore do repositório em `tmp_path`
porque o script precisa rodar de dentro de um checkout real (ele calcula
`ROOT` a partir do próprio caminho do script) — não dá para simular só com
arquivos soltos.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

# backend/tests/test_deposito.py -> backend/tests -> backend -> raiz do repo.
# Calculado a partir de __file__, não de os.getcwd(): os testes rodam a partir
# de backend/ (ver testpaths em backend/pyproject.toml).
REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_REL = Path("scripts/build-deposito.sh")

ferramentas_disponiveis = pytest.mark.skipif(
    shutil.which("rsync") is None or shutil.which("zip") is None,
    reason="rsync ou zip nao disponiveis neste ambiente",
)

_IGNORAR = shutil.ignore_patterns(
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "dist",
    "__pycache__",
    "*.pyc",
    ".pytest_cache",
    ".ruff_cache",
    ".vite",
)


def _clonar_repo(destino: Path) -> Path:
    """Copia a árvore do repositório para `destino`, sem os diretórios pesados
    ou irrelevantes para a auditoria (git, caches, dependências instaladas).
    """
    alvo = destino / "repo"
    shutil.copytree(REPO_ROOT, alvo, ignore=_IGNORAR)
    return alvo


@ferramentas_disponiveis
def test_verificar_passa_no_repositorio_real() -> None:
    """O caminho feliz: `--verificar` monta o staging, audita e sai 0 sem
    gerar `.zip` — é o que o CI (e a tarefa 1 do plano) exige antes de
    qualquer depósito."""
    resultado = subprocess.run(
        ["bash", str(SCRIPT_REL), "--verificar"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert resultado.returncode == 0, f"stdout:\n{resultado.stdout}\nstderr:\n{resultado.stderr}"


@ferramentas_disponiveis
def test_falha_se_arquivo_autoral_obrigatorio_sumir(tmp_path: Path) -> None:
    """Remove um arquivo do manifesto (plc_glue.c) de uma cópia do repo e
    exige que o script aborte citando o arquivo ausente — prova que o
    REQUIRED_FILES realmente barra, não só existe no script."""
    repo = _clonar_repo(tmp_path)
    alvo = repo / "backend/firmware/esp32-template/main/plc_glue.c"
    assert alvo.is_file(), "fixture inválida: plc_glue.c deveria existir na cópia"
    alvo.unlink()

    resultado = subprocess.run(
        ["bash", str(SCRIPT_REL), "--verificar"],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=60,
    )

    saida = resultado.stdout + resultado.stderr
    assert resultado.returncode != 0, f"deveria ter falhado:\n{saida}"
    assert "plc_glue.c" in saida


@ferramentas_disponiveis
def test_falha_se_artefato_gerado_vazar_para_o_pacote(tmp_path: Path) -> None:
    """Planta um `POUS.c` (saída do iec2c, GPL, nunca deve ir ao depósito)
    dentro da árvore autoral e exige que o script aborte citando o arquivo.

    Plantado como `main/POUS.c`, fora de um subdiretório `generated/`: este
    caminho atravessa o rsync e é pego pela auditoria do staging
    (FORBIDDEN_NAMES). O caso simétrico — dentro de `generated/`, que o rsync
    remove antes de a auditoria olhar — é coberto pelo teste seguinte."""
    repo = _clonar_repo(tmp_path)
    alvo = repo / "backend/firmware/esp32-template/main/POUS.c"
    alvo.write_text("/* saida do iec2c, nao deveria estar aqui */\n", encoding="utf-8")

    resultado = subprocess.run(
        ["bash", str(SCRIPT_REL), "--verificar"],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=60,
    )

    saida = resultado.stdout + resultado.stderr
    assert resultado.returncode != 0, f"deveria ter falhado:\n{saida}"
    assert "POUS.c" in saida


@ferramentas_disponiveis
def test_falha_se_arvore_autoral_estiver_contaminada(tmp_path: Path) -> None:
    """Planta a saída do iec2c dentro de `main/generated/` e exige falha.

    Este é o caso que a auditoria do staging sozinha NÃO pega: os EXCLUDES do
    rsync removem `generated` antes de o staging existir, então o pacote sairia
    limpo e ninguém saberia que havia código de terceiro convivendo com o
    autoral no repositório. Para um depósito no INPI, limpar em silêncio é pior
    que falhar alto — daí a auditoria `verificar_origem`, que olha a árvore de
    origem e não o staging. Se este teste passar a falhar, é porque alguém
    retirou essa segunda rede."""
    repo = _clonar_repo(tmp_path)
    gerado = repo / "backend/firmware/esp32-template/main/generated"
    gerado.mkdir(parents=True, exist_ok=True)
    (gerado / "POUS.c").write_text("/* saida do iec2c */\n", encoding="utf-8")

    resultado = subprocess.run(
        ["bash", str(SCRIPT_REL), "--verificar"],
        cwd=repo,
        capture_output=True,
        text=True,
        timeout=60,
    )

    saida = resultado.stdout + resultado.stderr
    assert resultado.returncode != 0, f"deveria ter falhado:\n{saida}"
    assert "contaminada" in saida
    assert "generated" in saida
