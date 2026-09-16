"""Encadeia as duas fronteiras de subprocesso em um único pipeline de compilação.

`matiec.py` (ST → C) e `esp32.py` (C → `.bin`) já são as únicas duas fronteiras
que falam com processos externos (constitution §10). Este módulo **não chama
`subprocess`** — só orquestra os dois adaptadores e traduz o resultado (ou a
exceção) para o envelope de erro estável da spec 001 (Q-3), que `api/compile.py`
serializa.

O diretório de trabalho do ESP-IDF é compartilhado e reaproveitado entre
compilações (Q-6) — é o que sustenta o build incremental. Por isso
`compilar()` serializa o acesso com um `threading.Lock` de módulo: como o
endpoint roda em *threadpool* (FastAPI síncrono), duas requisições concorrentes
disputariam o mesmo diretório sem essa trava. Não é uma fila — é apenas
"uma compilação de cada vez", suficiente para o contrato síncrono (consequência
(a) registrada em Q-6). Uma fila real, se necessário, é decisão para depois da
fatia mínima.

A trava não pode ser liberada antes de os artefatos do sucesso serem lidos: o
`.bin` da aplicação e o `flasher_args.json` (via `esp32.flash_manifest`) vivem
no diretório de build COMPARTILHADO, e uma compilação concorrente que entrasse
na trava assim que ela fosse liberada poderia sobrescrever esses arquivos no
meio da leitura de quem chamou `compilar()`. Por isso `compilar()` lê os bytes
do binário e monta o manifesto de gravação AINDA DENTRO da trava, e devolve os
dois já prontos em `ResultadoCompilacao` — os endpoints (`api/compile.py`)
nunca leem arquivo nenhum do `build_dir` compartilhado por conta própria.
"""

import tempfile
import threading
from dataclasses import dataclass, replace
from pathlib import Path

from app.config import get_settings
from app.services import esp32, matiec

# Serializa o acesso ao diretório de trabalho compartilhado do ESP-IDF
# (esp32.default_work_dir()). Uma compilação de cada vez.
_lock = threading.Lock()


@dataclass(frozen=True)
class ResultadoCompilacao:
    """Compilação bem-sucedida: ST válido, C válido, firmware gerado.

    `binary_bytes` e `flash_manifest` já vêm lidos do diretório de build
    compartilhado — lidos AINDA DENTRO da trava de `compilar()` (ver
    docstring do módulo), nunca depois. Quem chama não tem (nem deveria
    precisar) acesso a um `Path` de build para ler por conta própria.
    """

    binary_bytes: bytes
    flash_manifest: esp32.FlashManifest
    matiec_result: matiec.CompileResult
    esp32_result: esp32.BuildResult


@dataclass(frozen=True)
class FalhaCompilacao:
    """Falha em qualquer etapa, já no formato do envelope Q-3.

    `diagnostics` é *best-effort* (pode vir vazia) e `raw` sempre carrega a
    saída bruta e íntegra da etapa que falhou, mesmo quando `diagnostics` não
    reconhece nenhuma linha.
    """

    stage: str  # "matiec" | "esp32"
    code: str  # "compile_error" | "toolchain_error" | "timeout"
    message: str
    diagnostics: list[matiec.Diagnostic]
    raw_stdout: str
    raw_stderr: str


def compilar(source: str) -> ResultadoCompilacao | FalhaCompilacao:
    """Compila `source` (Structured Text) até o firmware do ESP32.

    Encadeia `matiec.compile_st_to_c` (num `TemporaryDirectory` próprio desta
    chamada — não precisa ser compartilhado, só o projeto ESP-IDF precisa) e
    `esp32.build_firmware` (no diretório de trabalho compartilhado). Nunca
    levanta exceção: falhas do ambiente (toolchain ausente, timeout) e falhas
    de compilação do código do usuário chegam todas como `FalhaCompilacao`.
    """
    settings = get_settings()

    with _lock:
        with tempfile.TemporaryDirectory(prefix="ladderflow-matiec-") as tmp:
            generated_dir = Path(tmp)
            try:
                matiec_result = matiec.compile_st_to_c(
                    source,
                    out_dir=generated_dir,
                    timeout=settings.compile_timeout_matiec_s,
                )
            except matiec.MatiecTimeout as exc:
                return _falha("matiec", "timeout", str(exc))
            except matiec.MatiecNotAvailable as exc:
                return _falha("matiec", "toolchain_error", str(exc))
            except matiec.MatiecError as exc:
                return _falha("matiec", "toolchain_error", str(exc))

            if not matiec_result.ok:
                # O iec2c cita o caminho absoluto do diretório temporário; o cliente
                # só precisa do nome do arquivo (e o caminho interno não deve vazar).
                # `raw` continua íntegro, com a saída original.
                diagnostics = [
                    replace(d, file=Path(d.file).name)
                    for d in matiec.parse_diagnostics(matiec_result.stdout, matiec_result.stderr)
                ]
                return FalhaCompilacao(
                    stage="matiec",
                    code="compile_error",
                    message="o iec2c rejeitou o código ST enviado",
                    diagnostics=diagnostics,
                    raw_stdout=matiec_result.stdout,
                    raw_stderr=matiec_result.stderr,
                )

            try:
                esp32_result = esp32.build_firmware(
                    generated_dir,
                    work_dir=esp32.default_work_dir(),
                    timeout=settings.compile_timeout_esp32_s,
                )
            except esp32.Esp32Timeout as exc:
                return _falha("esp32", "timeout", str(exc))
            except esp32.Esp32NotAvailable as exc:
                return _falha("esp32", "toolchain_error", str(exc))
            except esp32.Esp32Error as exc:
                return _falha("esp32", "toolchain_error", str(exc))

            if not esp32_result.ok or esp32_result.binary is None:
                return FalhaCompilacao(
                    stage="esp32",
                    code="compile_error",
                    message="o idf.py build falhou sobre o C gerado",
                    diagnostics=[],
                    raw_stdout=esp32_result.stdout,
                    raw_stderr=esp32_result.stderr,
                )

            # Leitura dos artefatos AINDA DENTRO da trava (ver docstring do
            # módulo): é o que impede uma compilação concorrente de
            # sobrescrever o build no meio desta leitura.
            try:
                binary_bytes = esp32_result.binary.read_bytes()
                manifesto = esp32.flash_manifest(esp32_result.work_dir / "build")
            except OSError as exc:
                return _falha("esp32", "toolchain_error", f"falha ao ler artefatos do build: {exc}")
            except esp32.Esp32Error as exc:
                return _falha("esp32", "toolchain_error", str(exc))

            return ResultadoCompilacao(
                binary_bytes=binary_bytes,
                flash_manifest=manifesto,
                matiec_result=matiec_result,
                esp32_result=esp32_result,
            )


def _falha(stage: str, code: str, message: str) -> FalhaCompilacao:
    """Monta uma `FalhaCompilacao` de ambiente (sem saída de compilador)."""
    return FalhaCompilacao(
        stage=stage,
        code=code,
        message=message,
        diagnostics=[],
        raw_stdout="",
        raw_stderr="",
    )
