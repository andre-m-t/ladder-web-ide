"""Prova que a integracao com o MATIEC funciona de ponta a ponta.

Os testes que exigem o binario sao pulados fora do container, onde o `iec2c`
nao existe.
"""

from pathlib import Path

import pytest

from app.services import matiec

iec2c_disponivel = pytest.mark.skipif(
    not matiec.status().available,
    reason="iec2c nao disponivel neste ambiente (rode dentro do container)",
)


def test_status_reporta_caminhos() -> None:
    state = matiec.status()

    assert state.path
    assert state.lib_dir
    assert isinstance(state.available, bool)


@iec2c_disponivel
def test_status_traz_versao() -> None:
    version = matiec.status().version

    assert version
    assert "matiec" in version.lower()


@iec2c_disponivel
def test_compila_st_minimo_para_c(minimal_st: str, tmp_path: Path) -> None:
    result = matiec.compile_st_to_c(minimal_st, out_dir=tmp_path)

    assert result.ok, f"iec2c falhou:\n{result.stdout}\n{result.stderr}"
    assert any(name.endswith(".c") for name in result.files), result.files


@iec2c_disponivel
def test_st_invalido_nao_levanta_excecao(tmp_path: Path) -> None:
    result = matiec.compile_st_to_c("isto nao e Structured Text", out_dir=tmp_path)

    assert not result.ok
    assert result.returncode != 0


def test_compilar_sem_binario_levanta(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(matiec, "_paths", lambda: (tmp_path / "ausente", tmp_path / "lib"))

    with pytest.raises(matiec.MatiecNotAvailable):
        matiec.compile_st_to_c("qualquer coisa", out_dir=tmp_path)
