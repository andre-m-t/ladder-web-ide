"""Executores: rodam um programa ST contra uma sequência de ciclos de entrada.

`Executor` é a abstração central do arcabouço diferencial (ver `README.md`,
seção "Ponto de extensão para F9"). Qualquer objeto que a implemente pode ter
sua saída comparada — hoje contra o gabarito de uma fixture (`comparador.
comparar_fixture`), amanhã contra a saída de um segundo executor
(`comparador.comparar_execucoes`), quando o simulador TypeScript de F9
existir. O runner e o comparador não sabem, e não precisam saber, se do outro
lado da interface há um processo em C ou um simulador rodando em outro
ambiente.

`HostRunnerExecutor` é a única implementação real hoje: fala com o
`plc_host_runner`, contrato publicado em
`docs/validacao/contrato-runtime-host.md`, implementado pela Frente A em
paralelo a este arcabouço. Só o modo padrão (endereço IEC) é usado aqui — o
modo `--eletrico` responde a outra pergunta (ver o contrato) e não interessa
à comparação com o simulador.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

# Variável de ambiente que, se definida, tem prioridade sobre a busca no PATH
# (mesmo padrão de override usado por MATIEC_IEC2C_PATH/ESP_IDF_PY_PATH em
# app/config.py, mas isolado aqui: este arcabouço de teste não lê
# app.config, de propósito, para não acoplar o teste à configuração do
# serviço HTTP).
VAR_AMBIENTE_CAMINHO = "PLC_HOST_RUNNER"

# Nome do binário buscado no PATH quando a variável de ambiente não é usada.
# Instalar `plc_host_runner` no PATH da imagem (ex.: `/usr/local/bin`, mesmo
# diretório de `iec2c`) é o jeito mais simples de fazer este teste enxergá-lo.
NOME_BINARIO = "plc_host_runner"


class ExecutorIndisponivel(RuntimeError):
    """O executor não está disponível neste ambiente (binário ausente, processo falhou)."""


@dataclass(frozen=True)
class ResultadoExecucao:
    """Saída bruta de um executor: uma lista de dicts, um por ciclo, endereço -> nível."""

    ciclos: list[dict[str, bool]]
    stderr: str
    returncode: int


class Executor(Protocol):
    """Interface que qualquer executor de lógica IEC precisa cumprir.

    `entradas` é uma lista densa (uma entrada por ciclo, já expandida por
    `Fixture.entradas_por_ciclo`); o executor devolve uma lista igualmente
    densa de saídas, na mesma ordem.
    """

    nome: str

    def disponivel(self) -> bool:
        """True se este executor pode rodar neste ambiente agora."""
        ...

    def executar(self, st_path: Path, entradas: list[dict[str, bool]]) -> ResultadoExecucao:
        """Roda `st_path` pelos ciclos de `entradas` e devolve a saída por ciclo."""
        ...


# Diretório do alvo de build para host (`make` compila o driver a partir daqui).
_HOST_MAKEFILE_DIR = (
    Path(__file__).resolve().parents[2] / "firmware" / "esp32-template" / "host"
)

# Memoiza o build sob demanda: uma sessão de pytest compila o driver uma vez só.
_binario_construido: Path | None = None


def _construir_sob_demanda() -> Path | None:
    """Compila o driver com `make`, fora da árvore do repositório.

    Terceira e última via de resolução, e a razão de ela existir: sem ela, uma
    suíte que não exporta `PLC_HOST_RUNNER` pula **todos** os testes contra o
    runtime real e ainda assim termina verde. Um arcabouço de medição que passa
    sem medir nada é pior que um que falha -- é lido como evidência.

    O `OUT_DIR` fica em diretório temporário do sistema, nunca dentro do repo:
    `scripts/build-deposito.sh` trata `build`/`generated` sob `backend/firmware/`
    como contaminação do pacote de depósito.
    """
    global _binario_construido
    if _binario_construido is not None and _binario_construido.is_file():
        return _binario_construido

    if not (_HOST_MAKEFILE_DIR / "Makefile").is_file():
        return None
    if shutil.which("make") is None or shutil.which("gcc") is None:
        return None

    out_dir = Path(tempfile.gettempdir()) / "ladderflow-plc-host-runner"
    try:
        concluido = subprocess.run(
            ["make", "-C", str(_HOST_MAKEFILE_DIR), f"OUT_DIR={out_dir}"],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if concluido.returncode != 0:
        return None

    binario = out_dir / NOME_BINARIO
    if not binario.is_file():
        return None
    _binario_construido = binario
    return binario


def _resolver_binario() -> Path | None:
    """Resolve o executável do contrato, em três vias, nesta ordem."""
    caminho_env = os.environ.get(VAR_AMBIENTE_CAMINHO)
    if caminho_env:
        return Path(caminho_env)
    encontrado = shutil.which(NOME_BINARIO)
    if encontrado:
        return Path(encontrado)
    return _construir_sob_demanda()


def _formatar_linha_entrada(valores: dict[str, bool]) -> str:
    """Uma linha de stdin no formato do contrato: `%IX0.0=1 %IX0.1=0`."""
    itens = sorted(valores.items())
    return " ".join(f"{endereco}={1 if nivel else 0}" for endereco, nivel in itens)


def _parsear_linha_saida(linha: str, ciclo_esperado: int) -> dict[str, bool]:
    """Uma linha de stdout no formato do contrato: `ciclo=2 %QX0.0=1 %QX0.1=0`."""
    partes = linha.split()
    if not partes or not partes[0].startswith("ciclo="):
        raise ExecutorIndisponivel(
            f"{NOME_BINARIO}: linha de saida fora do contrato (sem prefixo 'ciclo='): {linha!r}"
        )
    ciclo = int(partes[0].removeprefix("ciclo="))
    if ciclo != ciclo_esperado:
        raise ExecutorIndisponivel(
            f"{NOME_BINARIO}: saida fora de ordem, esperava ciclo={ciclo_esperado}, veio {linha!r}"
        )
    saidas: dict[str, bool] = {}
    for par in partes[1:]:
        endereco, _, nivel = par.partition("=")
        saidas[endereco] = nivel == "1"
    return saidas


@dataclass
class HostRunnerExecutor:
    """Executa o `plc_host_runner` real, no modo padrão de endereço IEC.

    Resolução do binário, nesta ordem:
    1. variável de ambiente `PLC_HOST_RUNNER` (caminho absoluto);
    2. `plc_host_runner` no PATH do container.

    Enquanto a Frente A não publicar o binário, `disponivel()` devolve False
    e os testes que dependem dele pulam de forma limpa (ver
    `test_diferencial.py`) em vez de falhar.
    """

    nome: str = "runtime-host"
    caminho: Path | None = field(default_factory=_resolver_binario)
    timeout_segundos: float = 30.0

    def disponivel(self) -> bool:
        return (
            self.caminho is not None
            and self.caminho.is_file()
            and os.access(self.caminho, os.X_OK)
        )

    def executar(self, st_path: Path, entradas: list[dict[str, bool]]) -> ResultadoExecucao:
        if not self.disponivel():
            raise ExecutorIndisponivel(
                f"{NOME_BINARIO} nao encontrado (defina {VAR_AMBIENTE_CAMINHO} ou "
                f"instale-o no PATH)"
            )

        entrada_stdin = "\n".join(_formatar_linha_entrada(v) for v in entradas) + "\n"
        processo = subprocess.run(
            [str(self.caminho), str(st_path)],
            input=entrada_stdin,
            capture_output=True,
            text=True,
            timeout=self.timeout_segundos,
            check=False,
        )
        if processo.returncode != 0:
            # Codigo de saida != 0: a saida bruta da ferramenta foi para
            # stderr, integra (ver o contrato) -- repassa sem reinterpretar.
            raise ExecutorIndisponivel(
                f"{NOME_BINARIO} falhou (codigo {processo.returncode}):\n{processo.stderr}"
            )

        linhas = [linha for linha in processo.stdout.splitlines() if linha.strip()]
        ciclos = [
            _parsear_linha_saida(linha, indice + 1) for indice, linha in enumerate(linhas)
        ]
        return ResultadoExecucao(
            ciclos=ciclos, stderr=processo.stderr, returncode=processo.returncode
        )
