"""Prova, sem hardware, que o protocolo de gravação do `esptool` funciona
contra o bootloader ROM emulado do QEMU, e que as imagens e os offsets que
`POST /compile/pacote` entrega ao cliente produzem, de fato, uma flash que dá
boot e roda o laço de varredura (spec 001, S2, tarefa #13).

Fluxo: `POST /compile/pacote` com `blink.st` → decodifica o pacote (base64) →
grava cada imagem, NO OFFSET DO PRÓPRIO PACOTE, numa flash vazia via
`esptool` sobre o socket do QEMU em modo download → reinicia o QEMU em boot
normal sobre essa MESMA flash → confere o mesmo contrato de boot saudável de
`test_qemu.py` (`qemu_boot_contrato.verificar_boot_saudavel`).

## O que este teste PROVA a mais que `test_qemu.py`

Que o protocolo de gravação do `esptool` — *sync*, *handshake*,
`write_flash` — funciona sobre o bootloader ROM que o QEMU emula, e que os
offsets e os bytes publicados por `POST /compile/pacote` (nunca `@flash_args`,
nunca constante deste repositório) bastam para reconstruir uma flash
funcional. `test_qemu.py` já provava o boot a partir de um `.bin` mesclado
pelo próprio `idf.py`; este teste prova que o CAMINHO DE GRAVAÇÃO em si
também funciona.

## O que NÃO prova (ver `docs/validacao/gravacao-qemu-esptool.md`)

Nada sobre o transporte real: Web Serial no navegador, USB-UART físico,
auto-reset por DTR/RTS, tempo de gravação real, nem o *strapping* físico de
pinos. O bootloader ROM que fala com o `esptool` aqui é emulado, não o de um
chip de verdade — e o modo download é forçado por `-global
driver=esp32.gpio,property=strap_mode`, não por hardware.
"""

import base64
import hashlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from qemu_boot_contrato import qemu_disponivel, verificar_boot_saudavel

from app.services import esp32, matiec
from scripts import run_qemu

OBSERVATION_TIMEOUT_S = 30.0

# As mesmas três chaves que `esp32.flash_manifest` lê do flasher_args.json.
_NOMES_IMAGEM = ("bootloader", "partition-table", "app")

toolchain_completa_disponivel = pytest.mark.skipif(
    not (matiec.status().available and esp32.status().available),
    reason="iec2c/idf.py nao disponiveis neste ambiente (rode dentro do container)",
)


@pytest.fixture
def pacote_blink(client: TestClient, blink_st: str) -> dict:
    """Compila `blink.st` via `POST /compile/pacote` (pipeline real) e devolve o JSON."""
    response = client.post("/compile/pacote", json={"source": blink_st})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.slow
@toolchain_completa_disponivel
@qemu_disponivel
def test_gravacao_via_esptool_socket_da_boot_e_roda_o_laco(
    pacote_blink: dict, tmp_path: Path
) -> None:
    imagens_em_disco: list[tuple[int, Path]] = []
    for imagem in pacote_blink["images"]:
        dados = base64.b64decode(imagem["data_base64"])
        assert len(dados) == imagem["size"]
        assert hashlib.sha256(dados).hexdigest() == imagem["sha256"]

        caminho = tmp_path / f"{imagem['name']}.bin"
        caminho.write_bytes(dados)
        imagens_em_disco.append((imagem["offset"], caminho))

    boot = run_qemu.flash_via_socket_and_boot(
        imagens_em_disco,
        flash_image_path=tmp_path / "flash_gravada.bin",
        log_path=tmp_path / "qemu_serial.log",
        boot_timeout=OBSERVATION_TIMEOUT_S,
    )

    assert boot.timed_out, (
        "qemu-system-xtensa encerrou sozinho antes do fim da janela de observacao "
        f"(returncode={boot.returncode}) apos a gravacao via esptool/socket; um "
        "firmware saudavel roda o laco para sempre.\nLog capturado:\n"
        f"{boot.log_text}"
    )
    verificar_boot_saudavel(boot.log_text)


@pytest.mark.slow
@toolchain_completa_disponivel
def test_offsets_do_pacote_casam_com_flasher_args_do_build(pacote_blink: dict) -> None:
    """Confere, lendo o `flasher_args.json` real do build, que os offsets do
    pacote não divergem — nunca por suposição."""
    build_dir = esp32.default_work_dir() / "build"
    flasher_args = json.loads((build_dir / "flasher_args.json").read_text(encoding="utf-8"))

    esperado = {nome: int(flasher_args[nome]["offset"], 16) for nome in _NOMES_IMAGEM}
    obtido = {imagem["name"]: imagem["offset"] for imagem in pacote_blink["images"]}

    assert obtido == esperado


@pytest.mark.slow
@toolchain_completa_disponivel
def test_sha256_e_bytes_do_pacote_casam_com_os_arquivos_do_build(pacote_blink: dict) -> None:
    build_dir = esp32.default_work_dir() / "build"
    flasher_args = json.loads((build_dir / "flasher_args.json").read_text(encoding="utf-8"))

    assert len(pacote_blink["images"]) == len(_NOMES_IMAGEM)
    for imagem in pacote_blink["images"]:
        arquivo_do_build = build_dir / flasher_args[imagem["name"]]["file"]
        dados_do_build = arquivo_do_build.read_bytes()
        dados_do_pacote = base64.b64decode(imagem["data_base64"])

        assert dados_do_pacote == dados_do_build
        assert imagem["size"] == len(dados_do_build)
        assert imagem["sha256"] == hashlib.sha256(dados_do_build).hexdigest()


@pytest.mark.slow
@toolchain_completa_disponivel
def test_imagens_do_pacote_vem_em_ordem_crescente_de_offset(pacote_blink: dict) -> None:
    offsets = [imagem["offset"] for imagem in pacote_blink["images"]]
    assert offsets == sorted(offsets)
    assert len(set(offsets)) == len(offsets)
