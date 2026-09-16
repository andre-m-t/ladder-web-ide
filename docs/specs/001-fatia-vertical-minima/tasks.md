# Tarefas 001 — Fatia vertical mínima

> **Status:** em execução (Fatia 1 / S1 concluída)
> **Plano de origem:** [`plan.md`](./plan.md) (aprovado em 2026-09-16)

Lista de execução. Cada tarefa é pequena, tem arquivos-alvo, dependências
explícitas e um critério de pronto verificável. `[x]` marca concluída.

---

## Fatia 1 — S1: `POST /compile` (servidor, contrato completo)

- [x] **#1 — Capturar saída real do iec2c para ST inválido**
  - Arquivos: `backend/tests/fixtures/iec2c_saidas/` (entrada + stdout/stderr
    de 3 casos: erro de sintaxe, variável não declarada, tipo incompatível)
  - Depende de: —
  - Pronto quando: fixtures no repositório, capturadas com
    `iec2c -f -I /usr/local/share/matiec/lib -T <out> <arquivo>` dentro da
    imagem, formato documentado em `COMANDO.txt`.

- [x] **#2 — `parse_diagnostics` em `matiec.py`**
  - Arquivos: `backend/app/services/matiec.py`
  - Depende de: #1
  - Pronto quando: `parse_diagnostics(stdout, stderr) -> list[Diagnostic]`
    reconhece o formato `arquivo:linha-col..linha-col: severidade: mensagem`
    das fixtures, ignora linhas não reconhecidas sem levantar exceção, e
    lista vazia é aceita como resultado válido.

- [x] **#3 — Configuração do contrato**
  - Arquivos: `backend/app/config.py`
  - Depende de: —
  - Pronto quando: `compile_max_body_bytes` (262144), `compile_timeout_matiec_s`
    (30.0) e `compile_timeout_esp32_s` (300.0) existem em `Settings`.

- [x] **#4 — `pipeline.compilar`**
  - Arquivos: `backend/app/services/pipeline.py`
  - Depende de: #2, #3
  - Pronto quando: encadeia `matiec.compile_st_to_c` → `esp32.build_firmware`,
    serializa o diretório de trabalho compartilhado com `threading.Lock`,
    mapeia `MatiecTimeout`/`Esp32Timeout`/`*NotAvailable`/`*Error` e o
    `ok=False` de cada etapa para `FalhaCompilacao` (envelope Q-3), devolve
    `ResultadoCompilacao` com `build_dir` no sucesso, e não chama
    `subprocess` diretamente.

- [x] **#5 — `POST /compile`**
  - Arquivos: `backend/app/api/compile.py`, `backend/app/main.py`
  - Depende de: #4
  - Pronto quando: o router valida `{"source": ...}`, aplica o limite de
    tamanho (`checar_tamanho_corpo`, checagem dupla por `Content-Length` e
    corpo lido) antes de compilar, devolve `200` octet-stream com
    `Content-Disposition: attachment; filename="ladderflow_plc.bin"` no
    sucesso, e o envelope Q-3 com o status HTTP correto (`mapear_falha`) nos
    demais casos; router registrado em `main.py` com o *exception handler* de
    `ErroCompilacaoHTTP`.

- [x] **#6 — Testes da Fatia 1**
  - Arquivos: `backend/tests/test_compile_api.py`
  - Depende de: #1 a #5
  - Pronto quando: contrato rápido com `monkeypatch` (sucesso, ST inválido,
    payload grande sem chamar o iec2c, timeout de cada etapa, toolchain
    ausente, falha de link) verde; teste real do iec2c com ST inválido
    (`skipif` fora do container) verde; teste `slow` ponta a ponta com
    `blink.st` verde; `test_parse_diagnostics` sobre as fixtures de #1 verde.
    CA-1, CA-2, CA-3, CA-5, CA-6 da spec cobertos.

- [x] **#7 — Documentação: Q-2 decidida e revisão aditiva de Q-3**
  - Arquivos: `docs/specs/001-fatia-vertical-minima/spec.md`
  - Depende de: #5
  - Pronto quando: Q-2 tem status "decidida" (256 KiB, justificativa do
    autor) e Q-3 tem uma revisão datada (2026-09-16) acrescentando
    `stage: "request"`, sem apagar a decisão original de 2026-09-10.

- [x] **#8 — `plan.md` e `tasks.md`**
  - Arquivos: `docs/specs/001-fatia-vertical-minima/plan.md`,
    `docs/specs/001-fatia-vertical-minima/tasks.md`
  - Depende de: #7
  - Pronto quando: os dois documentos substituem o *placeholder*, seguem os
    templates de `docs/templates/` e descrevem o contrato fixado para S2/S3.

- [x] **#9 — Manifesto do depósito**
  - Arquivos: `scripts/build-deposito.sh`
  - Depende de: #4, #5
  - Pronto quando: `backend/app/api/compile.py` e
    `backend/app/services/pipeline.py` estão em `REQUIRED_FILES`, e
    `bash scripts/build-deposito.sh --verificar` sai com código 0.

- [x] **#10 — `state.md`**
  - Arquivos: `.claude/state.md`
  - Depende de: #1 a #9
  - Pronto quando: F4 está `✅` com "Concluído" atualizado, Q-2 saiu de
    "Decisões em aberto", há uma linha nova em "Histórico de rodadas",
    "Próximos passos" reflete S2/S3, e há nota de pré-requisitos para VPS
    (autenticação, rate limit, fila se houver concorrência, HTTPS).

## Fatia 2 — S2: gravação, camada servidor (em paralelo com a Fatia 3)

- [x] **#11 — `esp32.flash_manifest(build_dir)`**
  - Arquivos: `backend/app/services/esp32.py`
  - Depende de: #5 (S1 commitada)
  - Pronto quando: lê `flasher_args.json` (`flash_files`, `flash_settings`,
    `extra_esptool_args.chip`) e devolve as três imagens com offset inteiro
    (vindo do JSON, nunca de constante), bytes e sha256, em ordem crescente
    de offset.

- [x] **#12 — `POST /compile/pacote`**
  - Arquivos: `backend/app/api/compile.py`
  - Depende de: #11
  - Pronto quando: reaproveita `checar_tamanho_corpo` e `mapear_falha` da S1,
    devolve o JSON do contrato (`chip`, `flash`, `images[]`) no sucesso.

- [x] **#13 — Validação de gravação real via QEMU/esptool**
  - Arquivos: `backend/scripts/run_qemu.py`,
    `backend/tests/test_gravacao_qemu.py`,
    `docs/validacao/gravacao-qemu-esptool.md`
  - Depende de: #12
  - Pronto quando: `POST /compile/pacote` → grava via `esptool`/socket no
    `qemu-system-xtensa` → reinicia → mesmo contrato de boot de
    `test_qemu.py` (sem panic, heartbeat crescente), marcado `slow`.

## Fatia 3 — S3: gravação no navegador + tela mínima (em paralelo com a Fatia 2)

- [x] **#14 — `frontend/src/lib/api.ts`**
  - Arquivos: `frontend/src/lib/api.ts`
  - Depende de: #5 (S1 commitada; não depende de #11-#13)
  - Pronto quando: `compilarBinario(source)` e `compilarPacote(source)`
    tipados, com `ErroCompilacao` a partir do envelope Q-3.

- [x] **#15 — `frontend/src/lib/gravador.ts`**
  - Arquivos: `frontend/src/lib/gravador.ts`
  - Depende de: #14
  - Pronto quando: `webSerialDisponivel()` e `gravar(pacote, opções)` sobre
    `esptool-js`, com erros classificados e testados via `vitest`.

- [x] **#16 — Tela mínima**
  - Arquivos: `frontend/src/App.tsx`, `frontend/src/components/*`
  - Depende de: #14, #15
  - Pronto quando: RF-1 a RF-6 cobertos na interface; `tsc --noEmit`,
    `vitest run` e `npm run build` verdes.

---

## Rastreabilidade

| Tarefa | Requisito(s) | Critério(s) de aceitação |
|---|---|---|
| #1, #2 | RF-8 | CA-6 |
| #3, #4 | RF-2, RF-3, RF-9, Q-6 | CA-1, CA-2 |
| #5 | RF-2, RF-3, RF-4, RF-7, RF-8, Q-2, Q-3 | CA-1 a CA-3, CA-5, CA-6 |
| #6 | RF-2 a RF-4, RF-7 a RF-9 | CA-1, CA-2, CA-3, CA-5, CA-6 |
| #7, #8, #9, #10 | rastreabilidade (§8 constitution) | — |
| #11, #12 | RF-5 (metade servidor) | pré-requisito de CA-4 |
| #13 | RF-5, RF-6 (validação sem hardware) | pré-requisito de CA-4 |
| #14, #15, #16 | RF-1, RF-5, RF-6 | CA-1 a CA-6 (CA-4 só fecha com ESP32 físico) |
