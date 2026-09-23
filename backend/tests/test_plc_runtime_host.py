"""Prova que o runtime PLC autoral RODA no host, sem ESP32 e sem toolchain
Xtensa -- o objetivo desta rodada (ver `docs/validacao/contrato-runtime-host.md`).

Compila `plc_host_runner` uma vez por sessao (via
`backend/firmware/esp32-template/host/Makefile`, que so precisa de `gcc` e
`iec2c`, ja presentes no container) e usa o binario resultante para exercitar
o runtime real: `plc_glue.c` + a HAL de host (`plc_hal_stub.c`) + o C que o
`iec2c` gera a partir das fixtures em `tests/fixtures/`.

Nao reimplementa o parsing do contrato feito por
`backend/tests/diferencial/executores.py` (que ja cobre as 3 fixtures contra
o gabarito, em `test_diferencial.py`): aqui o foco e provar as propriedades
estruturais do runtime em si -- ordem leitura/logica/escrita, uma leitura por
ciclo, alternancia do blink, e o mapeamento de variavel localizada -> pino.
"""

import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
FIRMWARE_DIR = REPO_ROOT / "backend" / "firmware" / "esp32-template"
HOST_MAKEFILE_DIR = FIRMWARE_DIR / "host"
FIXTURES_DIR = Path(__file__).parent / "fixtures"

BLINK_ST = FIXTURES_DIR / "blink.st"
IO_ESPELHO_ST = FIXTURES_DIR / "io_espelho.st"
MINIMAL_ST = FIXTURES_DIR / "minimal.st"


def _toolchain_disponivel() -> bool:
    import shutil

    return shutil.which("gcc") is not None and shutil.which("iec2c") is not None


toolchain_disponivel = pytest.mark.skipif(
    not _toolchain_disponivel(),
    reason="gcc/iec2c nao disponiveis neste ambiente (rode dentro do container)",
)


@pytest.fixture(scope="session")
def plc_host_runner(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Compila `plc_host_runner` uma unica vez para a sessao de testes.

    OUT_DIR fica no `tmp_path_factory` do pytest -- fora da arvore do
    repositorio, a mesma exigencia que o proprio `plc_host_runner` respeita
    em tempo de execucao (ver o comentario no topo dele): o pacote de
    deposito no INPI trata `generated/`/`build/` sob `backend/firmware/`
    como contaminacao de terceiro (`scripts/build-deposito.sh`).
    """
    out_dir = tmp_path_factory.mktemp("plc_host_runner_bin")
    resultado = subprocess.run(
        ["make", "-C", str(HOST_MAKEFILE_DIR), f"OUT_DIR={out_dir}"],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    assert resultado.returncode == 0, (
        f"make do host build falhou:\n{resultado.stdout}\n{resultado.stderr}"
    )
    binario = out_dir / "plc_host_runner"
    assert binario.is_file(), f"make nao produziu {binario}"
    return binario


def _rodar(
    binario: Path, args: list[str], entradas: list[str], tmp_path: Path
) -> subprocess.CompletedProcess[str]:
    """Roda `plc_host_runner` com uma linha de stdin por ciclo.

    TMPDIR aponta para `tmp_path` do teste: o proprio `plc_host_runner` cria
    um diretorio de trabalho temporario a cada chamada (copia do .st,
    C gerado pelo iec2c, binario interno recompilado) -- ver o comentario no
    topo dele. Sem isolar isso por teste, chamadas concorrentes ainda
    funcionariam (cada uma usa mkdtemp), mas isolar em tmp_path deixa a
    arvore de teste limpa e facil de inspecionar em caso de falha.
    """
    env = dict(os.environ)
    env["TMPDIR"] = str(tmp_path)
    entrada_stdin = "\n".join(entradas) + "\n" if entradas else ""
    return subprocess.run(
        [str(binario), *args],
        input=entrada_stdin,
        capture_output=True,
        text=True,
        timeout=30,
        env=env,
        check=False,
    )


def _linhas_saida(resultado: subprocess.CompletedProcess[str]) -> list[str]:
    return [linha for linha in resultado.stdout.splitlines() if linha.strip()]


def _parsear(linha: str) -> dict[str, str]:
    """`"ciclo=2 %QX0.0=1 %QX0.1=0"` -> `{"ciclo": "2", "%QX0.0": "1", "%QX0.1": "0"}`."""
    partes = linha.split()
    campos = {"ciclo": partes[0].removeprefix("ciclo=")}
    for par in partes[1:]:
        chave, _, valor = par.partition("=")
        campos[chave] = valor
    return campos


# --------------------------------------------------------------------------
# Ordem: le entradas -> resolve rungs -> escreve saidas, multi-ciclo.
# --------------------------------------------------------------------------


@toolchain_disponivel
def test_ordem_leitura_resolucao_escrita_multiciclo(plc_host_runner: Path, tmp_path: Path) -> None:
    """io_espelho.st e `saida := entrada;`: sem esse pipeline na ordem certa
    (ler ANTES de resolver, resolver ANTES de escrever, tudo no MESMO ciclo),
    a saida ficaria atrasada em um ciclo ou nunca mudaria. Sequencia
    alternada, para nao passar por coincidencia de um unico valor fixo."""
    resultado = _rodar(
        plc_host_runner,
        [str(IO_ESPELHO_ST)],
        ["%IX0.1=0", "%IX0.1=1", "%IX0.1=0", "%IX0.1=1", "%IX0.1=1", "%IX0.1=0"],
        tmp_path,
    )
    assert resultado.returncode == 0, resultado.stderr

    linhas = [_parsear(linha) for linha in _linhas_saida(resultado)]
    assert [linha["%QX0.1"] for linha in linhas] == ["0", "1", "0", "1", "1", "0"]
    assert [linha["ciclo"] for linha in linhas] == ["1", "2", "3", "4", "5", "6"]


# --------------------------------------------------------------------------
# Uma entrada mudada "no meio" do ciclo nao aparece na saida DESSE ciclo.
# --------------------------------------------------------------------------


@toolchain_disponivel
def test_saida_nao_reflete_leitura_fora_do_ciclo_agendado(
    plc_host_runner: Path, tmp_path: Path
) -> None:
    """Usa `plc_hal_stub_flip_on_read` (gancho de `--flip=<gpio>:<na_leitura>:<nivel>`,
    interno a este teste -- NAO faz parte do contrato publicado) para provar
    uma propriedade que um teste que so chama `plc_hal_stub_set_level` ENTRE
    ciclos nao consegue provar: `read_inputs()` roda uma unica vez por ciclo
    (no INICIO dele), e a saida de um ciclo e sempre funcao exata do valor
    capturado naquela unica leitura -- nunca de uma mudanca que "ja
    aconteceu no mundo" mas ainda nao foi lida.

    Cenario: %IX0.1 (GPIO18) comeca no nivel eletrico 0 (stub zerado por
    `plc_hal_stub_reset`) e NUNCA e ajustado via stdin/`plc_hal_stub_set_level`
    nesta chamada -- a UNICA fonte de mudanca e o agendamento
    `--flip=18:2:1`: "troque para 1 exatamente na 2a leitura do pino". Como
    io_espelho.st e puramente combinacional (`saida := entrada`, sem
    contador), qualquer atraso ou adiantamento na saida so pode vir de uma
    leitura extra, faltante ou fora de ordem -- nao de logica com estado.

        ciclo 1: 1a leitura de GPIO18 (contagem chega a 1, agendamento e
                 para a contagem 2) -> ve o nivel ainda em 0 -> %QX0.1=0
        ciclo 2: 2a leitura (contagem chega a 2, bate com o agendamento) ->
                 o nivel muda DURANTE esta leitura e ela ja devolve o novo
                 valor -> %QX0.1=1 NO MESMO ciclo, nao um ciclo depois
        ciclo 3: 3a leitura, sem agendamento pendente -> nivel permanece 1

    `leituras_gpio18` (a contagem de `plc_hal_stub_read_count`, anexada pelo
    gancho de diagnostico) confirma que cada ciclo fez EXATAMENTE uma leitura
    desse pino -- nunca zero, nunca duas -- o que descarta tanto uma leitura
    perdida quanto uma leitura extra no meio do ciclo (que faria a saida
    reagir a uma segunda mudanca dentro do mesmo scan).

    O que este teste NAO cobre, porque e estrutural e nao precisa de gancho
    nenhum para ser verdade: uma mudanca ocorrida estritamente DEPOIS de
    `read_inputs()` e ANTES de `write_outputs()`, dentro do MESMO ciclo, e
    impossivel de observar por construcao -- so existe um ponto de leitura
    por ciclo (aqui provado pela contagem) e `write_outputs()` nunca consulta
    a entrada. Um teste que tentasse forcar essa janela especifica estaria
    testando a inexistencia de um segundo ponto de leitura, nao um
    comportamento observavel a mais.
    """
    resultado = _rodar(
        plc_host_runner,
        ["--flip=18:2:1", "--eletrico", str(IO_ESPELHO_ST)],
        ["", "", ""],
        tmp_path,
    )
    assert resultado.returncode == 0, resultado.stderr

    linhas = [_parsear(linha) for linha in _linhas_saida(resultado)]
    assert len(linhas) == 3

    assert linhas[0]["gpio4"] == "0"
    assert linhas[0]["leituras_gpio18"] == "1"

    assert linhas[1]["gpio4"] == "1"
    assert linhas[1]["leituras_gpio18"] == "2"

    assert linhas[2]["gpio4"] == "1"
    assert linhas[2]["leituras_gpio18"] == "3"


# --------------------------------------------------------------------------
# blink.st alterna na contagem esperada.
# --------------------------------------------------------------------------


@toolchain_disponivel
def test_blink_alterna_na_contagem_esperada(plc_host_runner: Path, tmp_path: Path) -> None:
    """25 ciclos ligado, 25 desligado (common_ticktime__ = 20ms => 500ms cada
    faixa). Com o botao SOLTO (%IX0.0=0) os 50 ciclos: led=0 no ciclo 24,
    led=1 no 25, led=1 no 26, led=1 no 49, led=0 no 50 -- os mesmos 5 pontos
    do gabarito em backend/tests/diferencial/fixtures/blink.toml."""
    entradas = ["%IX0.0=0"] * 50
    resultado = _rodar(plc_host_runner, [str(BLINK_ST)], entradas, tmp_path)
    assert resultado.returncode == 0, resultado.stderr

    linhas = {int(c["ciclo"]): c["%QX0.0"] for c in map(_parsear, _linhas_saida(resultado))}
    assert len(linhas) == 50
    assert linhas[24] == "0"
    assert linhas[25] == "1"
    assert linhas[26] == "1"
    assert linhas[49] == "1"
    assert linhas[50] == "0"


# --------------------------------------------------------------------------
# Mapeamento de variavel localizada <-> pino casa com plc_io_pins.
# --------------------------------------------------------------------------


@toolchain_disponivel
def test_mapeamento_de_variavel_localizada_bate_com_plc_io_pins(
    plc_host_runner: Path, tmp_path: Path
) -> None:
    """Roda io_espelho.st em modo `--eletrico` (nivel de GPIO, nao endereco
    IEC) e prova, ponta a ponta, que %IX0.1/%QX0.1 estao ligados exatamente
    aos GPIOs que `plc_io_map.h` declara -- GPIO18 (entrada) e GPIO4 (saida),
    a pinagem revisada na Q-5 da spec 001. Reusa o parser de
    `test_plc_io_map.py` (mesmo diretorio de testes) em vez de duplicar os
    numeros de pino, para que uma futura revisao do mapa continue provando
    esta propriedade sem editar este arquivo."""
    from test_plc_io_map import _parse_header

    entradas_por_variavel = {
        entry.variable: entry for entry in _parse_header() if entry.direction == "PLC_IO_INPUT"
    }
    saidas_por_variavel = {
        entry.variable: entry for entry in _parse_header() if entry.direction == "PLC_IO_OUTPUT"
    }
    gpio_entrada = entradas_por_variavel["__IX0_1"].gpio
    gpio_saida = saidas_por_variavel["__QX0_1"].gpio

    resultado = _rodar(
        plc_host_runner,
        ["--eletrico", str(IO_ESPELHO_ST)],
        [f"gpio{gpio_entrada}=0", f"gpio{gpio_entrada}=1", f"gpio{gpio_entrada}=0"],
        tmp_path,
    )
    assert resultado.returncode == 0, resultado.stderr

    linhas = [_parsear(linha) for linha in _linhas_saida(resultado)]
    assert [linha[f"gpio{gpio_saida}"] for linha in linhas] == ["0", "1", "0"]


# --------------------------------------------------------------------------
# Casos de borda que a rodada pediu para nao esquecer.
# --------------------------------------------------------------------------


@toolchain_disponivel
def test_minimal_sem_variavel_localizada_nao_inventa_endereco(
    plc_host_runner: Path, tmp_path: Path
) -> None:
    """minimal.st exercita a sentinela do array vazio em `plc_located_vars`
    (ver o comentario em plc_glue.c): nenhuma AT %IX/%QX declarada. O
    contrato diz que a saida traz o valor de TODAS as saidas -- aqui esse
    conjunto e vazio, entao a linha e so "ciclo=N", sem endereco nenhum."""
    resultado = _rodar(plc_host_runner, [str(MINIMAL_ST)], ["", ""], tmp_path)
    assert resultado.returncode == 0, resultado.stderr

    linhas = _linhas_saida(resultado)
    assert linhas == ["ciclo=1", "ciclo=2"]


@toolchain_disponivel
def test_entrada_malformada_devolve_codigo_de_saida_diferente_de_zero(
    plc_host_runner: Path, tmp_path: Path
) -> None:
    """Endereco que nao existe no programa carregado: o contrato reserva
    codigo de saida != 0 para entrada malformada."""
    resultado = _rodar(plc_host_runner, [str(BLINK_ST)], ["%ZZ9.9=1"], tmp_path)
    assert resultado.returncode != 0
    assert resultado.stdout == ""
