# Teste diferencial — arcabouço

**Status:** instrumento pronto, aguardando F9. Compara *um* executor (o
`plc_host_runner` real, em C) contra o gabarito declarado em cada fixture.
A comparação que o TCC realmente quer medir — simulador (F9, TypeScript)
contra runtime host — ainda não é possível, porque F9 não existe. Este
arcabouço é o instrumento que a espera; ele já está pronto para receber um
segundo executor sem precisar ser reescrito (ver "Ponto de extensão", abaixo).

## Por que este diretório existe

A métrica "divergência simulação ↔ hardware" (F10) precisa de dois executores
rodando o mesmo programa ST e produzindo a mesma forma de saída para poderem
ser comparados ciclo a ciclo. O contrato que fixa essa forma de saída —
`docs/validacao/contrato-runtime-host.md` — já está publicado, e o primeiro
executor (`plc_host_runner`, runtime em C rodando no host, sem ESP32) está
sendo implementado em paralelo a este arcabouço. O segundo executor (o
simulador de F9, em TypeScript, rodando no navegador) ainda não existe.

Este diretório entrega o que dá para entregar sem F9: o formato de fixture, o
runner que executa uma fixture contra um executor, o comparador que produz
divergências apontáveis (CICLO/PONTO/ESPERADO/OBTIDO, não só "falhou"), e a
abstração `Executor` que absorve o segundo executor sem exigir reescrita.

## Formato de fixture — por que TOML

Cada fixture é um `.toml` em `fixtures/`: referência ao `.st` (em
`backend/tests/fixtures/`, os mesmos arquivos que `test_esp32.py` e
`test_matiec.py` já usam — nada duplicado), quantos ciclos rodar, as entradas
por ciclo (em faixas `[[entradas]]`, para não repetir a mesma linha dezenas
de vezes quando o valor não muda) e um gabarito **esparso** de saídas
esperadas (`[[saidas_esperadas]]` — só os ciclos que provam o comportamento
sob teste entram, não todos).

Escolhido TOML, e não YAML ou JSON, por três razões:

1. **Sem dependência nova.** `tomllib` é biblioteca padrão do Python 3.11+
   (leitura). YAML exigiria adicionar `pyyaml` a `requirements-dev.txt`, fora
   da propriedade de arquivos desta frente de trabalho.
2. **Comentário.** Uma fixture é, antes de mais nada, documentação do
   comportamento esperado — "por que este ciclo, por que este valor" precisa
   de comentário ao lado do dado. JSON não aceita comentário; TOML aceita.
3. **Já é o formato do repositório.** `pyproject.toml` já configura `pytest`
   e `ruff` neste mesmo `backend/`; TOML não é sintaxe nova para quem lê o
   projeto.

Formato completo, comentado, em `fixtures/blink.toml`, `fixtures/
io_espelho.toml` e `fixtures/minimal.toml`.

## Runner e comparador

`executores.py` define `Executor` (a abstração central — ver "Ponto de
extensão") e `HostRunnerExecutor`, que fala com o `plc_host_runner` via
subprocesso, exatamente no formato do contrato (stdin `%IX0.0=1 %IX0.1=0`
por linha/ciclo, stdout `ciclo=N %QX0.0=... %QX0.1=...`). `fixtures.py`
carrega e valida os `.toml`. `comparador.py` compara saída obtida contra
gabarito e produz `Divergencia(ciclo, ponto, esperado, obtido)` — a mensagem
de falha do pytest é literalmente essa lista formatada, uma linha por
divergência, nunca só "falhou". `runner.py` amarra os três.

## Ponto de extensão para F9

`Executor` (em `executores.py`) é um `Protocol` com um único método,
`executar(st_path, entradas) -> ResultadoExecucao`. `HostRunnerExecutor` é a
única implementação hoje. Quando o simulador de F9 existir, basta escrever um
segundo executor (`SimuladorExecutor`, por exemplo, falando com o processo
Node/TypeScript do simulador) que implemente essa mesma interface — nem
`runner.py`, nem `comparador.py`, nem as fixtures existentes precisam mudar
uma linha.

A comparação de dois executores completos, sem gabarito escrito à mão — cada
lado vira o "esperado" do outro — já existe e já está testada:
`comparador.comparar_execucoes(esperado, obtido)`. Hoje ela só é exercitada
com dados sintéticos, em `test_diferencial.py::test_comparar_execucoes_*`
(prova de que a lógica está correta antes de haver um segundo executor
de verdade para alimentá-la). Quando F9 existir, o uso pretendido é:

```python
executor_host = HostRunnerExecutor()
executor_simulador = SimuladorExecutor()  # a escrever, quando F9 existir

saida_host = executor_host.executar(fixture.st_path, fixture.entradas_por_ciclo()).ciclos
saida_simulador = executor_simulador.executar(fixture.st_path, fixture.entradas_por_ciclo()).ciclos

divergencias = comparar_execucoes(saida_simulador, saida_host)
```

É essa chamada — não uma reescrita do runner — que fecha a métrica de F10.

## Como rodar

Dentro do container (regra 5 do `CLAUDE.md`, nunca `docker compose up`):

```bash
docker run --rm -v "$(pwd):/repo" -w /repo/backend ladderflow-backend:dev \
  python -m pytest -m "not slow" -q tests/test_diferencial.py
```

Os testes de fixture contra o runtime real (`test_fixture_sem_divergencia_no_
runtime_host`) pulam de forma limpa se `plc_host_runner` não estiver
disponível — defina a variável de ambiente `PLC_HOST_RUNNER` com o caminho do
binário, ou instale-o no `PATH` da imagem (mesmo padrão de `iec2c` e
`idf.py`). Os testes do comparador (`test_comparar_*`) são lógica pura e
sempre rodam, com ou sem o binário.
