"""Contrato de `POST /compile` (spec 001, S1) e do parser de diagnósticos.

Testes de contrato usam `monkeypatch` nos **adaptadores** (`matiec.py`,
`esp32.py`), nunca no pipeline em si — assim a suíte rápida também exercita o
mapeamento de exceções que `pipeline.compilar` faz. Os testes que exigem o
`iec2c`/`idf.py` de verdade pulam fora do container.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.services import esp32, matiec

FIXTURES_DIR = Path(__file__).parent / "fixtures"
IEC2C_SAIDAS_DIR = FIXTURES_DIR / "iec2c_saidas"

iec2c_disponivel = pytest.mark.skipif(
    not matiec.status().available,
    reason="iec2c nao disponivel neste ambiente (rode dentro do container)",
)
toolchain_completa_disponivel = pytest.mark.skipif(
    not (matiec.status().available and esp32.status().available),
    reason="iec2c/idf.py nao disponiveis neste ambiente (rode dentro do container)",
)


def _fake_compile_result(*, ok: bool, stdout: str = "", stderr: str = "") -> matiec.CompileResult:
    return matiec.CompileResult(
        ok=ok,
        returncode=0 if ok else 1,
        stdout=stdout,
        stderr=stderr,
        output_dir=Path("/tmp/nao-usado"),
        files=["POUS.c"] if ok else [],
    )


def _fake_build_result(
    *, ok: bool, binary: Path | None, stdout: str = "", stderr: str = ""
) -> esp32.BuildResult:
    return esp32.BuildResult(
        ok=ok,
        returncode=0 if ok else 1,
        stdout=stdout,
        stderr=stderr,
        work_dir=Path("/tmp/nao-usado"),
        binary=binary,
    )


def _nao_deveria_ser_chamado(*args: object, **kwargs: object) -> None:
    raise AssertionError("iec2c não deveria ter sido invocado")


# --- Contrato rápido (monkeypatch nos adaptadores) --------------------------


def test_compile_sucesso_devolve_binario(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    binario = tmp_path / "ladderflow_plc.bin"
    binario.write_bytes(b"FIRMWARE-DE-TESTE")

    monkeypatch.setattr(
        matiec, "compile_st_to_c", lambda source, *, out_dir, timeout: _fake_compile_result(ok=True)
    )
    monkeypatch.setattr(
        esp32,
        "build_firmware",
        lambda generated_dir, *, work_dir=None, timeout=900.0: _fake_build_result(
            ok=True, binary=binario
        ),
    )

    response = client.post("/compile", json={"source": "PROGRAM prog0 END_PROGRAM"})

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/octet-stream"
    assert response.headers["content-disposition"] == 'attachment; filename="ladderflow_plc.bin"'
    assert response.content == b"FIRMWARE-DE-TESTE"
    assert len(response.content) > 0


def test_compile_st_invalido_devolve_422_com_diagnostics(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    stderr = (IEC2C_SAIDAS_DIR / "variavel_nao_declarada.stderr.txt").read_text(encoding="utf-8")

    monkeypatch.setattr(
        matiec,
        "compile_st_to_c",
        lambda source, *, out_dir, timeout: _fake_compile_result(ok=False, stderr=stderr),
    )
    monkeypatch.setattr(esp32, "build_firmware", _nao_deveria_ser_chamado)

    response = client.post("/compile", json={"source": "isto nao compila"})

    assert response.status_code == 422
    body = response.json()
    assert body["stage"] == "matiec"
    assert body["code"] == "compile_error"
    assert body["diagnostics"], "diagnostics deveria vir populado para este caso"
    assert body["raw"]["stderr"] == stderr


def test_compile_esp32_falha_devolve_500(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        matiec, "compile_st_to_c", lambda source, *, out_dir, timeout: _fake_compile_result(ok=True)
    )
    monkeypatch.setattr(
        esp32,
        "build_firmware",
        lambda generated_dir, *, work_dir=None, timeout=900.0: _fake_build_result(
            ok=False, binary=None, stderr="erro de link"
        ),
    )

    response = client.post("/compile", json={"source": "PROGRAM prog0 END_PROGRAM"})

    assert response.status_code == 500
    body = response.json()
    assert body["stage"] == "esp32"
    assert body["code"] == "compile_error"


def test_compile_payload_acima_do_limite_nao_chama_iec2c(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(matiec, "compile_st_to_c", _nao_deveria_ser_chamado)
    monkeypatch.setattr(esp32, "build_firmware", _nao_deveria_ser_chamado)

    fonte_grande = "X" * 300_000  # acima dos 262 144 bytes de Q-2
    response = client.post("/compile", json={"source": fonte_grande})

    assert response.status_code == 413
    body = response.json()
    assert body["stage"] == "request"
    assert body["code"] == "payload_too_large"


def test_compile_timeout_matiec_devolve_504(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _levanta_timeout(source: str, *, out_dir: Path, timeout: float) -> matiec.CompileResult:
        raise matiec.MatiecTimeout("iec2c excedeu o tempo limite")

    monkeypatch.setattr(matiec, "compile_st_to_c", _levanta_timeout)
    monkeypatch.setattr(esp32, "build_firmware", _nao_deveria_ser_chamado)

    response = client.post("/compile", json={"source": "PROGRAM prog0 END_PROGRAM"})

    assert response.status_code == 504
    body = response.json()
    assert body["stage"] == "matiec"
    assert body["code"] == "timeout"


def test_compile_timeout_esp32_devolve_504(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        matiec, "compile_st_to_c", lambda source, *, out_dir, timeout: _fake_compile_result(ok=True)
    )

    def _levanta_timeout(
        generated_dir: Path, *, work_dir: Path | None = None, timeout: float = 900.0
    ) -> esp32.BuildResult:
        raise esp32.Esp32Timeout("idf.py build excedeu o tempo limite")

    monkeypatch.setattr(esp32, "build_firmware", _levanta_timeout)

    response = client.post("/compile", json={"source": "PROGRAM prog0 END_PROGRAM"})

    assert response.status_code == 504
    body = response.json()
    assert body["stage"] == "esp32"
    assert body["code"] == "timeout"


def test_compile_toolchain_ausente_devolve_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _levanta_indisponivel(
        source: str, *, out_dir: Path, timeout: float
    ) -> matiec.CompileResult:
        raise matiec.MatiecNotAvailable("iec2c nao encontrado")

    monkeypatch.setattr(matiec, "compile_st_to_c", _levanta_indisponivel)
    monkeypatch.setattr(esp32, "build_firmware", _nao_deveria_ser_chamado)

    response = client.post("/compile", json={"source": "PROGRAM prog0 END_PROGRAM"})

    assert response.status_code == 503
    body = response.json()
    assert body["stage"] == "matiec"
    assert body["code"] == "toolchain_error"


# --- iec2c real (pula fora do container) ------------------------------------


@iec2c_disponivel
def test_compile_st_invalido_real_iec2c(client: TestClient) -> None:
    response = client.post("/compile", json={"source": "isto definitivamente nao e ST valido"})

    assert response.status_code == 422
    body = response.json()
    assert body["stage"] == "matiec"
    assert body["code"] == "compile_error"
    assert body["raw"]["stderr"] or body["raw"]["stdout"]


# --- Ponta a ponta com blink.st (lento) --------------------------------------


@pytest.mark.slow
@toolchain_completa_disponivel
def test_compile_ponta_a_ponta_blink(client: TestClient, blink_st: str) -> None:
    response = client.post("/compile", json={"source": blink_st})

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/octet-stream"
    assert len(response.content) > 0


# --- Parser de diagnósticos, sobre as fixtures capturadas do iec2c ----------


def _ler_fixture(nome: str) -> tuple[str, str]:
    stdout = (IEC2C_SAIDAS_DIR / f"{nome}.stdout.txt").read_text(encoding="utf-8")
    stderr = (IEC2C_SAIDAS_DIR / f"{nome}.stderr.txt").read_text(encoding="utf-8")
    return stdout, stderr


@pytest.mark.parametrize(
    ("fixture", "linha", "coluna", "trecho_mensagem"),
    [
        ("erro_sintaxe", 3, 5, "variable(s) declaration"),
        ("variavel_nao_declarada", 5, 3, "invalid variable before ':='"),
        ("tipo_incompativel", 6, 3, "Incompatible data types"),
    ],
)
def test_parse_diagnostics_sobre_fixtures_reais(
    fixture: str, linha: int, coluna: int, trecho_mensagem: str
) -> None:
    stdout, stderr = _ler_fixture(fixture)

    diagnostics = matiec.parse_diagnostics(stdout, stderr)

    assert len(diagnostics) == 1
    diagnostico = diagnostics[0]
    assert diagnostico.line == linha
    assert diagnostico.column == coluna
    assert diagnostico.severity == "error"
    assert trecho_mensagem in diagnostico.message
    # "N error(s) found. Bailing out!" nao casa com o formato reconhecido e e
    # ignorada silenciosamente -- o comportamento best-effort esperado.
    assert "Bailing out" not in diagnostico.message


def test_parse_diagnostics_saida_vazia_devolve_lista_vazia() -> None:
    assert matiec.parse_diagnostics("", "") == []


def test_parse_diagnostics_linha_nao_reconhecida_e_ignorada() -> None:
    diagnostics = matiec.parse_diagnostics("", "algo que nao segue o formato esperado\n")

    assert diagnostics == []
