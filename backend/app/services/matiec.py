"""Fronteira única com o MATIEC (`iec2c`).

Este é o **único** módulo do backend que fala com o compilador. O MATIEC é
software de terceiros sob GPL-3.0 e é executado como **processo separado**,
nunca incorporado ao código deste projeto (constitution §10). Todo o resto do
backend deve passar por aqui — não chame `subprocess` em outro lugar.

Invocação usada:

    iec2c -f -I <lib_dir> -T <out_dir> <out_dir>/plc.st

`-f` faz o compilador incluir a localização completa do token nas mensagens de
erro, o que preserva a informação necessária para a resposta estruturada que a
spec 001 vier a definir.
"""

import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings

# Nome do arquivo em que o código ST é gravado dentro do diretório de trabalho.
ST_FILENAME = "plc.st"

# Extensões geradas pelo iec2c que interessam ao chamador.
GENERATED_SUFFIXES = (".c", ".h")

# Formato observado da mensagem de erro do iec2c com `-f` (localização
# completa do token), capturado em `backend/tests/fixtures/iec2c_saidas/`:
#
#   <arquivo>:<linha_ini>-<col_ini>..<linha_fim>-<col_fim>: <severidade>: <mensagem>
#
# Ex.: "/in/plc.st:5-3..5-3: error: invalid variable before ':=' ...". O
# `file` é não-guloso porque a mensagem pode conter ':' (ex.: "':='"); só a
# âncora numérica fixa o fim do nome do arquivo. Linha e coluna reportadas são
# as de início do token — o fim não tem campo próprio no envelope Q-3.
_DIAG_RE = re.compile(
    r"^(?P<file>.+?):(?P<line>\d+)-(?P<column>\d+)\.\.\d+-\d+:\s*"
    r"(?P<severity>error|warning)\s*:\s*(?P<message>.+)$"
)


class MatiecError(RuntimeError):
    """Falha ao operar o MATIEC (não é erro de compilação do usuário)."""


class MatiecNotAvailable(MatiecError):
    """O binário `iec2c` não foi encontrado ou não é executável."""


class MatiecTimeout(MatiecError):
    """A compilação excedeu o tempo limite."""


@dataclass(frozen=True)
class Iec2cStatus:
    """Disponibilidade do compilador no ambiente atual."""

    available: bool
    path: str
    lib_dir: str
    # Saída de `iec2c -v`, ex.: "matiec version 0.1".
    version: str | None


@dataclass(frozen=True)
class Diagnostic:
    """Um diagnóstico extraído da saída do `iec2c` (envelope Q-3 da spec 001).

    `line`/`column` podem ser `None` quando a mensagem não casa com o formato
    reconhecido — o diagnóstico ainda assim é reportado, só sem localização.
    """

    file: str
    line: int | None
    column: int | None
    severity: str
    message: str


@dataclass(frozen=True)
class CompileResult:
    """Resultado bruto de uma execução do `iec2c`.

    `ok` indica apenas que o compilador terminou com código 0; a interpretação
    das mensagens fica a cargo de quem chama.
    """

    ok: bool
    returncode: int
    stdout: str
    stderr: str
    output_dir: Path
    files: list[str]


def _paths() -> tuple[Path, Path]:
    settings = get_settings()
    return Path(settings.matiec_iec2c_path), Path(settings.matiec_lib_dir)


def _is_executable(path: Path) -> bool:
    return path.is_file() and os.access(path, os.X_OK)


def status() -> Iec2cStatus:
    """Verifica se o `iec2c` está presente e utilizável."""
    iec2c, lib_dir = _paths()
    if not _is_executable(iec2c):
        return Iec2cStatus(available=False, path=str(iec2c), lib_dir=str(lib_dir), version=None)
    return Iec2cStatus(
        available=True,
        path=str(iec2c),
        lib_dir=str(lib_dir),
        version=_read_version(iec2c),
    )


def _read_version(iec2c: Path) -> str | None:
    """Lê a versão do compilador (`iec2c -v`)."""
    try:
        completed = subprocess.run(
            [str(iec2c), "-v"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None

    for line in (completed.stdout + completed.stderr).splitlines():
        stripped = line.strip()
        if stripped:
            return stripped
    return None


def compile_st_to_c(source: str, *, out_dir: Path, timeout: float = 30.0) -> CompileResult:
    """Compila código Structured Text para C ANSI no diretório informado.

    Grava `source` em `<out_dir>/plc.st` e executa o `iec2c`. Não levanta
    exceção quando o ST é inválido — nesse caso devolve `ok=False` com a saída
    do compilador. Levanta `MatiecNotAvailable` ou `MatiecTimeout` quando o
    problema é do ambiente, não do código do usuário.
    """
    iec2c, lib_dir = _paths()
    if not _is_executable(iec2c):
        raise MatiecNotAvailable(f"iec2c não encontrado ou não executável em {iec2c}")

    out_dir.mkdir(parents=True, exist_ok=True)
    st_path = out_dir / ST_FILENAME
    st_path.write_text(source, encoding="utf-8")

    command = [str(iec2c), "-f", "-I", str(lib_dir), "-T", str(out_dir), str(st_path)]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            cwd=out_dir,
        )
    except subprocess.TimeoutExpired as exc:
        raise MatiecTimeout(f"iec2c excedeu {timeout}s") from exc
    except OSError as exc:
        raise MatiecError(f"falha ao executar iec2c: {exc}") from exc

    return CompileResult(
        ok=completed.returncode == 0,
        returncode=completed.returncode,
        stdout=completed.stdout,
        stderr=completed.stderr,
        output_dir=out_dir,
        files=_generated_files(out_dir),
    )


def parse_diagnostics(stdout: str, stderr: str) -> list[Diagnostic]:
    """Extrai diagnósticos estruturados da saída do `iec2c` (best-effort).

    Best-effort quer dizer: nunca levanta exceção e uma lista vazia é um
    resultado aceitável. O `iec2c` escreve os erros em `stderr` (confirmado
    nas fixtures de `backend/tests/fixtures/iec2c_saidas/`), mas `stdout`
    também é varrido pelo mesmo motivo — não custa e não depende de premissa
    sobre qual descritor a ferramenta usa em toda versão. Linha que não casa
    com o formato reconhecido é ignorada; o texto integral continua disponível
    em `raw`, então nada se perde.
    """
    diagnostics: list[Diagnostic] = []
    for stream in (stdout, stderr):
        for line in stream.splitlines():
            match = _DIAG_RE.match(line.strip())
            if match is None:
                continue
            diagnostics.append(
                Diagnostic(
                    file=match.group("file"),
                    line=int(match.group("line")),
                    column=int(match.group("column")),
                    severity=match.group("severity"),
                    message=match.group("message").strip(),
                )
            )
    return diagnostics


def _generated_files(out_dir: Path) -> list[str]:
    return sorted(
        entry.name
        for entry in out_dir.iterdir()
        if entry.is_file() and entry.suffix in GENERATED_SUFFIXES
    )
