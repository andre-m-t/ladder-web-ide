"""Arcabouço de teste diferencial: compara a saída de um executor de lógica
IEC contra um gabarito declarado em fixture, ciclo a ciclo, endereço a
endereço.

Ver `README.md` neste diretório para o formato de fixture, a abstração
`Executor` e o ponto de extensão para o futuro simulador de F9. Os submódulos:

- `fixtures.py`   — carrega e valida fixtures `.toml`.
- `executores.py` — abstração `Executor` + `HostRunnerExecutor` (processo
  `plc_host_runner`, contrato em `docs/validacao/contrato-runtime-host.md`).
- `comparador.py` — compara saídas e produz `Divergencia` (ciclo, ponto,
  esperado, obtido).
- `runner.py`     — amarra fixture + executor + comparador numa chamada só.
"""
