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

**Adendo (spec 004, 2026-09-20):** o "amanhã" do segundo parágrafo chegou.
`SimuladorExecutor`, abaixo, é a segunda implementação real de `Executor` --
o motor de simulação em TypeScript (`frontend/src/ladder/simulacao-cli.ts`),
rodando fora do navegador. `Executor`, `ResultadoExecucao`,
`ExecutorIndisponivel`, `HostRunnerExecutor` e as funções de formato do
contrato (`_formatar_linha_entrada`, `_parsear_linha_saida`) acima não
mudaram uma linha para recebê-la -- a promessa registrada no `README.md`
("Ponto de extensão para F9") se cumpriu.
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


# ─────────────────────────────────────────────────────────────────────────────
# Segundo executor (spec 004, RF-19/RF-20; plano D-10/D-11) -- o simulador em
# TypeScript (`frontend/src/ladder/simulacao-cli.ts`), empacotado sob demanda
# e executado por `node`. Fala o mesmo contrato de processo que
# `HostRunnerExecutor` (`docs/validacao/contrato-runtime-host.md`, modo
# padrao), reusando `_formatar_linha_entrada` e `_parsear_linha_saida`
# acima -- e por isso `runner.py`, `comparador.py` e as fixtures TOML nao
# mudam uma linha (RF-20; README.md, "Ponto de extensao para F9").
#
# Diferenca em relacao a `HostRunnerExecutor`: o `Executor.executar` recebe
# `st_path`, mas o simulador consome o DIAGRAMA (JSON), nao o `.st` -- o
# simulador nao le texto ST, nem o compilador, nem o servidor (RF-7). O
# diagrama irmao e resolvido pelo NOME do arquivo (D-11): qualquer
# `.../<nome>.st` mapeia para `backend/tests/fixtures/diagramas/<nome>.json`,
# gerado pela frente do motor de simulacao via `toMatchFileSnapshot`.
# ─────────────────────────────────────────────────────────────────────────────

# Variavel de ambiente que, se definida, aponta para um `.mjs` ja empacotado
# (primeira via de resolucao) -- util para depurar sem esperar o esbuild
# rodar a cada sessao de pytest.
VAR_AMBIENTE_SIMULADOR = "LADDERFLOW_SIMULADOR"

# Nome do interprete buscado no PATH -- necessario nas tres vias de
# resolucao, porque mesmo um `.mjs` ja pronto (via VAR_AMBIENTE_SIMULADOR)
# precisa de `node` para rodar.
NOME_NODE = "node"

# Nome do executavel do simulador, so para mensagem de erro (mesmo papel de
# NOME_BINARIO acima).
NOME_SIMULADOR = "simulador-ts"

# Raiz do repositorio: backend/tests/diferencial/executores.py -> parents[3].
_REPO_ROOT = Path(__file__).resolve().parents[3]

# Binario NATIVO do esbuild que ja vive em frontend/node_modules (instalado
# pelo `npm install` do front-end, sem nenhuma dependencia nova no projeto).
# Este binario, ao contrario do pacote .mjs que ele produz, NAO precisa de
# `node` para rodar -- e por isso o empacotamento sob demanda funciona mesmo
# antes de `node` ter sido resolvido (ver `_resolver_simulador`).
_ESBUILD_BIN = (
    _REPO_ROOT / "frontend" / "node_modules" / "@esbuild" / "linux-x64" / "bin" / "esbuild"
)

# Entrada do empacotamento: o shim de linha de comando publicado no
# contrato (plano 004, §5.2), autoral, implementado pela frente N.
_ENTRADA_SIMULADOR_CLI = _REPO_ROOT / "frontend" / "src" / "ladder" / "simulacao-cli.ts"

# Diretorio fixo dos diagramas de referencia (D-11) -- backend/tests/fixtures/diagramas.
_FIXTURES_DIAGRAMAS_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "diagramas"

# Memoiza o empacotamento sob demanda: uma sessao de pytest empacota uma vez so.
_mjs_construido: Path | None = None


def _empacotar_sob_demanda() -> Path | None:
    """Empacota `simulacao-cli.ts` num `.mjs` unico, fora da arvore do repositorio.

    Mesmo padrao e mesma razao de `_construir_sob_demanda`, acima: sem esta
    via, uma suite que nao exporta `LADDERFLOW_SIMULADOR` e nao tem `node`
    no PATH pularia (ou, pior, silenciaria) todos os testes contra o
    simulador. Um arcabouco de medicao que passa sem medir nada e pior que
    um que falha -- e o motivo pelo qual a Regra 5 do `CLAUDE.md` existe.

    O `.mjs` gerado fica em diretorio temporario do sistema, nunca dentro do
    repo: `scripts/build-deposito.sh` trata artefato de build sob a arvore
    como contaminacao do pacote de deposito do INPI (mesma restricao do
    `OUT_DIR` do runtime em C).
    """
    global _mjs_construido
    if _mjs_construido is not None and _mjs_construido.is_file():
        return _mjs_construido

    if not _ESBUILD_BIN.is_file() or not _ENTRADA_SIMULADOR_CLI.is_file():
        return None

    out_dir = Path(tempfile.gettempdir()) / "ladderflow-simulador-ts"
    out_file = out_dir / "simulador.mjs"
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
        concluido = subprocess.run(
            [
                str(_ESBUILD_BIN),
                str(_ENTRADA_SIMULADOR_CLI),
                "--bundle",
                "--format=esm",
                "--platform=node",
                f"--outfile={out_file}",
            ],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if concluido.returncode != 0 or not out_file.is_file():
        return None
    _mjs_construido = out_file
    return out_file


def _resolver_simulador() -> Path | None:
    """Resolve o `.mjs` do simulador, em tres vias, nesta ordem (plano D-10):

    1. `LADDERFLOW_SIMULADOR` (caminho de um `.mjs` ja pronto);
    2. `node` no PATH + empacotamento sob demanda via esbuild;
    3. indisponivel.
    """
    caminho_env = os.environ.get(VAR_AMBIENTE_SIMULADOR)
    if caminho_env:
        caminho = Path(caminho_env)
        return caminho if caminho.is_file() else None
    if shutil.which(NOME_NODE) is None:
        return None
    return _empacotar_sob_demanda()


def _resolver_node() -> Path | None:
    encontrado = shutil.which(NOME_NODE)
    return Path(encontrado) if encontrado else None


def _resolver_diagrama_irmao(st_path: Path) -> Path:
    """Acha o diagrama JSON irmao de `st_path`, pelo nome (D-11).

    Falha com motivo claro -- nunca em silencio (RF-8) -- se o irmao ainda
    nao existir: diz exatamente qual arquivo falta e o comando que o gera.
    """
    diagrama = _FIXTURES_DIAGRAMAS_DIR / f"{st_path.stem}.json"
    if not diagrama.is_file():
        raise ExecutorIndisponivel(
            f"{NOME_SIMULADOR}: diagrama irmao ausente para '{st_path.name}' -- "
            f"esperado em {diagrama}. E gerado por "
            "'npx vitest run -u src/ladder/simulacao.dourados.test.ts' em frontend/ "
            "(plano 004, D-11)."
        )
    return diagrama


@dataclass
class SimuladorExecutor:
    """Executa o motor de simulacao em TypeScript (spec 004), fora do navegador.

    Resolucao do `.mjs`, nesta ordem (`_resolver_simulador`):
    1. variavel de ambiente `LADDERFLOW_SIMULADOR` (caminho absoluto de um
       `.mjs` ja empacotado);
    2. `node` no PATH + empacotamento sob demanda do esbuild nativo, fora do
       repositorio, memoizado por sessao de pytest.

    `disponivel()` devolve False se `node` nao existe no PATH mesmo quando
    a via 1 resolveu um `.mjs` -- interpretar o pacote sempre exige `node`.
    """

    nome: str = "simulador-ts"
    caminho_mjs: Path | None = field(default_factory=_resolver_simulador)
    caminho_node: Path | None = field(default_factory=_resolver_node)
    timeout_segundos: float = 30.0

    def disponivel(self) -> bool:
        return (
            self.caminho_mjs is not None
            and self.caminho_mjs.is_file()
            and self.caminho_node is not None
        )

    def executar(self, st_path: Path, entradas: list[dict[str, bool]]) -> ResultadoExecucao:
        if not self.disponivel():
            raise ExecutorIndisponivel(
                f"{NOME_SIMULADOR} nao disponivel -- defina {VAR_AMBIENTE_SIMULADOR} com o "
                "caminho de um .mjs pronto, ou instale 'node' no PATH para o empacotamento "
                "sob demanda via esbuild (frontend/node_modules/@esbuild/linux-x64/bin/esbuild)"
            )
        diagrama_path = _resolver_diagrama_irmao(st_path)

        entrada_stdin = "\n".join(_formatar_linha_entrada(v) for v in entradas) + "\n"
        processo = subprocess.run(
            [str(self.caminho_node), str(self.caminho_mjs), str(diagrama_path)],
            input=entrada_stdin,
            capture_output=True,
            text=True,
            timeout=self.timeout_segundos,
            check=False,
        )
        if processo.returncode != 0:
            # Mesmo espirito de HostRunnerExecutor.executar: codigo != 0
            # repassa a mensagem integra de stderr, sem reinterpretar.
            raise ExecutorIndisponivel(
                f"{NOME_SIMULADOR} falhou (codigo {processo.returncode}):\n{processo.stderr}"
            )

        linhas = [linha for linha in processo.stdout.splitlines() if linha.strip()]
        ciclos = [_parsear_linha_saida(linha, indice + 1) for indice, linha in enumerate(linhas)]
        return ResultadoExecucao(
            ciclos=ciclos, stderr=processo.stderr, returncode=processo.returncode
        )
