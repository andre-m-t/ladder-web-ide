"""Prova que a toolchain do ESP32 gera firmware a partir do C do MATIEC.

Os testes que exigem o `idf.py` sao pulados fora do container. O build completo
esta marcado como `slow`: o primeiro roda em minutos (build frio do ESP-IDF), os
seguintes reaproveitam o diretorio de trabalho.

Para rodar so o rapido:  pytest -m "not slow"
"""

import hashlib
import json
from pathlib import Path

import pytest

from app.services import esp32, matiec

# Exemplo de flasher_args.json capturado de um build real de blink.st (idf.py
# build, ESP-IDF v5.4.1, alvo esp32) — os testes de flash_manifest abaixo
# validam a leitura contra este formato, não contra suposição.
_FLASHER_ARGS_EXEMPLO = {
    "write_flash_args": ["--flash_mode", "dio", "--flash_size", "4MB", "--flash_freq", "40m"],
    "flash_settings": {"flash_mode": "dio", "flash_size": "4MB", "flash_freq": "40m"},
    "flash_files": {
        "0x1000": "bootloader/bootloader.bin",
        "0x10000": "ladderflow_plc.bin",
        "0x8000": "partition_table/partition-table.bin",
    },
    "bootloader": {"offset": "0x1000", "file": "bootloader/bootloader.bin", "encrypted": "false"},
    "app": {"offset": "0x10000", "file": "ladderflow_plc.bin", "encrypted": "false"},
    "partition-table": {
        "offset": "0x8000",
        "file": "partition_table/partition-table.bin",
        "encrypted": "false",
    },
    "extra_esptool_args": {
        "after": "hard_reset",
        "before": "default_reset",
        "stub": True,
        "chip": "esp32",
    },
}


def _escrever_build_exemplo(build_dir: Path) -> None:
    """Monta um `build_dir` de exemplo: o JSON acima mais os três arquivos que ele referencia."""
    build_dir.mkdir(parents=True, exist_ok=True)
    (build_dir / "flasher_args.json").write_text(
        json.dumps(_FLASHER_ARGS_EXEMPLO), encoding="utf-8"
    )
    (build_dir / "bootloader").mkdir()
    (build_dir / "bootloader" / "bootloader.bin").write_bytes(b"BOOTLOADER-FALSO")
    (build_dir / "partition_table").mkdir()
    (build_dir / "partition_table" / "partition-table.bin").write_bytes(b"TABELA-FALSA")
    (build_dir / "ladderflow_plc.bin").write_bytes(b"APP-FALSO-MAIOR-QUE-OS-OUTROS")


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


# --- flash_manifest (spec 001, S2) -------------------------------------------


def test_flash_manifest_le_offsets_bytes_e_sha256_do_flasher_args(tmp_path: Path) -> None:
    build_dir = tmp_path / "build"
    _escrever_build_exemplo(build_dir)

    manifesto = esp32.flash_manifest(build_dir)

    assert manifesto.chip == "esp32"
    assert manifesto.flash == esp32.FlashSettings(mode="dio", freq="40m", size="4MB")

    # Em ordem crescente de offset -- não na ordem em que aparecem no JSON.
    assert [imagem.name for imagem in manifesto.images] == [
        "bootloader",
        "partition-table",
        "app",
    ]
    assert [imagem.offset for imagem in manifesto.images] == [0x1000, 0x8000, 0x10000]

    por_nome = {imagem.name: imagem for imagem in manifesto.images}
    assert por_nome["bootloader"].data == b"BOOTLOADER-FALSO"
    assert por_nome["bootloader"].size == len(b"BOOTLOADER-FALSO")
    assert por_nome["app"].data == b"APP-FALSO-MAIOR-QUE-OS-OUTROS"
    assert por_nome["app"].sha256 == hashlib.sha256(b"APP-FALSO-MAIOR-QUE-OS-OUTROS").hexdigest()


def test_flash_manifest_arquivo_ausente_levanta(tmp_path: Path) -> None:
    with pytest.raises(esp32.FlashManifestError):
        esp32.flash_manifest(tmp_path / "build-inexistente")


def test_flash_manifest_json_invalido_levanta(tmp_path: Path) -> None:
    build_dir = tmp_path / "build"
    build_dir.mkdir()
    (build_dir / "flasher_args.json").write_text("isto nao e json", encoding="utf-8")

    with pytest.raises(esp32.FlashManifestError):
        esp32.flash_manifest(build_dir)


def test_flash_manifest_sem_chave_de_imagem_levanta(tmp_path: Path) -> None:
    build_dir = tmp_path / "build"
    _escrever_build_exemplo(build_dir)
    sem_app = dict(_FLASHER_ARGS_EXEMPLO)
    del sem_app["app"]
    (build_dir / "flasher_args.json").write_text(json.dumps(sem_app), encoding="utf-8")

    with pytest.raises(esp32.FlashManifestError):
        esp32.flash_manifest(build_dir)


def test_flash_manifest_imagem_referenciada_ausente_levanta(tmp_path: Path) -> None:
    build_dir = tmp_path / "build"
    build_dir.mkdir()
    (build_dir / "flasher_args.json").write_text(
        json.dumps(_FLASHER_ARGS_EXEMPLO), encoding="utf-8"
    )
    # Não cria os arquivos .bin referenciados pelo JSON.

    with pytest.raises(esp32.FlashManifestError):
        esp32.flash_manifest(build_dir)
