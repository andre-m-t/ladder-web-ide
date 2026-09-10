"""Prova que a toolchain do ESP32 gera firmware a partir do C do MATIEC.

Os testes que exigem o `idf.py` sao pulados fora do container. O build completo
esta marcado como `slow`: o primeiro roda em minutos (build frio do ESP-IDF), os
seguintes reaproveitam o diretorio de trabalho.

Para rodar so o rapido:  pytest -m "not slow"
"""

from pathlib import Path

import pytest

from app.services import esp32, matiec

toolchain_disponivel = pytest.mark.skipif(
    not esp32.status().available,
    reason="idf.py nao disponivel neste ambiente (rode dentro do container)",
)


def test_status_reporta_caminhos() -> None:
    state = esp32.status()

    assert state.path
    assert state.template
    assert isinstance(state.available, bool)


@toolchain_disponivel
def test_status_traz_versao() -> None:
    version = esp32.status().version

    assert version
    assert "esp-idf" in version.lower() or version.lower().startswith("v")


@pytest.mark.slow
@toolchain_disponivel
def test_gera_firmware_a_partir_do_st(blink_st: str, tmp_path: Path) -> None:
    """Metade servidor do pipeline completo: ST -> C -> .bin."""
    generated = tmp_path / "generated"
    compilation = matiec.compile_st_to_c(blink_st, out_dir=generated)
    assert compilation.ok, f"iec2c falhou:\n{compilation.stdout}\n{compilation.stderr}"

    # Diretorio de trabalho compartilhado (default_work_dir) de proposito: e o
    # cache que torna o build incremental, comportamento que o teste exercita.
    result = esp32.build_firmware(generated)

    assert result.ok, f"idf.py build falhou:\n{result.stdout}\n{result.stderr}"
    assert result.binary is not None
    assert result.binary.stat().st_size > 0


@toolchain_disponivel
def test_sem_arquivo_gerado_levanta(tmp_path: Path) -> None:
    vazio = tmp_path / "vazio"
    vazio.mkdir()

    with pytest.raises(esp32.Esp32Error):
        esp32.build_firmware(vazio, work_dir=tmp_path / "work")


def test_toolchain_ausente_levanta(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    generated = tmp_path / "generated"
    generated.mkdir()
    (generated / "Config0.c").write_text("int main(void) { return 0; }\n", encoding="utf-8")
    monkeypatch.setattr(esp32, "_paths", lambda: (None, tmp_path / "template"))

    with pytest.raises(esp32.Esp32NotAvailable):
        esp32.build_firmware(generated, work_dir=tmp_path / "work")


def test_template_ausente_levanta(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    generated = tmp_path / "generated"
    generated.mkdir()
    (generated / "Config0.c").write_text("int main(void) { return 0; }\n", encoding="utf-8")
    idf_py = tmp_path / "idf.py"
    idf_py.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    idf_py.chmod(0o755)
    monkeypatch.setattr(esp32, "_paths", lambda: (idf_py, tmp_path / "sem-template"))

    with pytest.raises(esp32.Esp32NotAvailable):
        esp32.build_firmware(generated, work_dir=tmp_path / "work")
