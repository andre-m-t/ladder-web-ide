"""Fronteira única com a toolchain do ESP32 (`idf.py`, do ESP-IDF).

Segunda metade do pipeline de compilação: recebe o C ANSI que o MATIEC gerou
(ver `app/services/matiec.py`) e devolve o firmware do ESP32. Assim como o
`iec2c`, o ESP-IDF é **ferramenta externa executada como processo separado**,
nunca importada como código (constitution §10) — e este é o **único** módulo do
backend que o invoca.

O projeto ESP-IDF em si é autoral e vive em `backend/firmware/esp32-template`:
`app_main.c` + `plc_glue.c` são a cola entre a lógica gerada e os GPIOs. Uma
compilação copia esse template para um diretório de trabalho, deposita os
arquivos gerados em `main/generated/` e chama:

    idf.py -C <work_dir> -B <work_dir>/build build

O diretório de trabalho é **reaproveitado** entre compilações de propósito: só
os arquivos gerados mudam, então o ESP-IDF recompila apenas o que precisa. É
esse build incremental que sustenta a decisão de compilação síncrona (Q-6 da
spec 001).
"""

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings

# Onde, dentro do projeto, entram os arquivos produzidos pelo iec2c.
GENERATED_SUBDIR = Path("main") / "generated"

# Extensões copiadas do diretório do MATIEC para o projeto.
GENERATED_SUFFIXES = (".c", ".h")

# Nome do projeto em `firmware/esp32-template/CMakeLists.txt`.
PROJECT_NAME = "ladderflow_plc"

# Binários que o ESP-IDF gera junto e que não são o firmware da aplicação.
_NOT_APP_BINARIES = frozenset({"bootloader.bin", "partition-table.bin"})


class Esp32Error(RuntimeError):
    """Falha ao operar a toolchain (não é erro no código do usuário)."""


class Esp32NotAvailable(Esp32Error):
    """O `idf.py` ou o template do projeto não foram encontrados."""


class Esp32Timeout(Esp32Error):
    """A geração do firmware excedeu o tempo limite."""


@dataclass(frozen=True)
class IdfStatus:
    """Disponibilidade da toolchain no ambiente atual."""

    available: bool
    path: str
    template: str
    # Saída de `idf.py --version`, ex.: "ESP-IDF v5.4.1".
    version: str | None


@dataclass(frozen=True)
class BuildResult:
    """Resultado bruto de uma execução do `idf.py build`.

    `ok` indica apenas que o comando terminou com código 0 e que o binário
    apareceu; a interpretação das mensagens fica a cargo de quem chama.
    """

    ok: bool
    returncode: int
    stdout: str
    stderr: str
    work_dir: Path
    binary: Path | None


def _paths() -> tuple[Path | None, Path]:
    """Devolve (`idf.py` resolvido ou `None`, diretório do template)."""
    settings = get_settings()
    return _resolve_idf_py(settings.esp_idf_py_path), Path(settings.esp_project_template)


def _resolve_idf_py(configured: str) -> Path | None:
    """Aceita tanto um caminho absoluto quanto um nome no `PATH`."""
    candidate = Path(configured)
    if candidate.is_absolute():
        return candidate if _is_executable(candidate) else None
    found = shutil.which(configured)
    return Path(found) if found else None


def _is_executable(path: Path) -> bool:
    return path.is_file() and os.access(path, os.X_OK)


def default_work_dir() -> Path:
    """Diretório de trabalho padrão, dentro do cache de builds.

    Um único diretório reaproveitado — o que dá o build incremental, mas também
    significa que duas compilações simultâneas se atropelariam. Serializar o
    acesso é responsabilidade de quem expõe a compilação (endpoint da spec 001).
    """
    return Path(get_settings().esp_build_root) / "current"


def status() -> IdfStatus:
    """Verifica se a toolchain e o template do projeto estão utilizáveis."""
    idf_py, template = _paths()
    if idf_py is None or not (template / "CMakeLists.txt").is_file():
        return IdfStatus(
            available=False,
            path=str(idf_py) if idf_py else get_settings().esp_idf_py_path,
            template=str(template),
            version=None,
        )
    return IdfStatus(
        available=True,
        path=str(idf_py),
        template=str(template),
        version=_read_version(idf_py),
    )


def _read_version(idf_py: Path) -> str | None:
    """Lê a versão da toolchain (`idf.py --version`)."""
    try:
        completed = subprocess.run(
            [str(idf_py), "--version"],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None

    for line in (completed.stdout + completed.stderr).splitlines():
        stripped = line.strip()
        if stripped:
            return stripped
    return None


def build_firmware(
    generated_dir: Path,
    *,
    work_dir: Path | None = None,
    timeout: float = 900.0,
) -> BuildResult:
    """Gera o firmware a partir do C produzido pelo MATIEC.

    `generated_dir` é o diretório de saída do `iec2c`. Não levanta exceção
    quando o C não compila — nesse caso devolve `ok=False` com a saída da
    toolchain. Levanta `Esp32NotAvailable` ou `Esp32Timeout` quando o problema é
    do ambiente, não do código do usuário.
    """
    idf_py, template = _paths()
    if idf_py is None:
        raise Esp32NotAvailable(
            f"idf.py não encontrado ({get_settings().esp_idf_py_path}); "
            "a imagem do backend provê a toolchain do ESP-IDF"
        )
    if not (template / "CMakeLists.txt").is_file():
        raise Esp32NotAvailable(f"template de projeto ESP-IDF ausente em {template}")

    work_dir = work_dir or default_work_dir()
    _prepare_project(generated_dir, template=template, work_dir=work_dir)

    build_dir = work_dir / "build"
    command = [str(idf_py), "-C", str(work_dir), "-B", str(build_dir), "build"]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            cwd=work_dir,
        )
    except subprocess.TimeoutExpired as exc:
        raise Esp32Timeout(f"idf.py build excedeu {timeout}s") from exc
    except OSError as exc:
        raise Esp32Error(f"falha ao executar idf.py: {exc}") from exc

    binary = _find_binary(build_dir) if completed.returncode == 0 else None
    return BuildResult(
        ok=completed.returncode == 0 and binary is not None,
        returncode=completed.returncode,
        stdout=completed.stdout,
        stderr=completed.stderr,
        work_dir=work_dir,
        binary=binary,
    )


def _prepare_project(generated_dir: Path, *, template: Path, work_dir: Path) -> None:
    """Copia o template para o diretório de trabalho e injeta o C gerado.

    O diretório `build/` do trabalho anterior é preservado (é o cache); apenas
    `main/generated/` é recriado, para que restos de uma compilação anterior não
    sejam ligados ao firmware desta.
    """
    sources = sorted(
        entry
        for entry in generated_dir.iterdir()
        if entry.is_file() and entry.suffix in GENERATED_SUFFIXES
    )
    if not sources:
        raise Esp32Error(f"nenhum arquivo C gerado em {generated_dir}")

    work_dir.mkdir(parents=True, exist_ok=True)
    shutil.copytree(template, work_dir, dirs_exist_ok=True)

    target = work_dir / GENERATED_SUBDIR
    shutil.rmtree(target, ignore_errors=True)
    target.mkdir(parents=True)
    for source in sources:
        shutil.copy2(source, target / source.name)


def _find_binary(build_dir: Path) -> Path | None:
    """Localiza o binário da aplicação entre os artefatos do build."""
    expected = build_dir / f"{PROJECT_NAME}.bin"
    if expected.is_file():
        return expected
    for candidate in sorted(build_dir.glob("*.bin")):
        if candidate.name not in _NOT_APP_BINARIES:
            return candidate
    return None
