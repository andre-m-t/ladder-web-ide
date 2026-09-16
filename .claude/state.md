# LadderFlow — Estado do projeto

**Este é o `state.md` do projeto: a fotografia em tempo real do que existe, do que falta e do que está bloqueado.** É o primeiro arquivo a ler para saber onde o projeto está, e o último a escrever ao fim de qualquer rodada.

**Atualização é obrigatória, não opcional.** Toda implementação — ciclo completo ou caminho curto — atualiza este arquivo **no mesmo commit** que a muda. A regra está registrada em `CLAUDE.md`, em `docs/workflow.md` e em `.claude/commands/implementar.md`; se você é um agente de IA lendo isto, ela vale para você.

O que atualizar, ao fim de cada rodada:
1. Status (✅/🟡/⬜/🔒) das features tocadas, e o conteúdo de "Concluído"/"Falta" dentro delas
2. "Última atualização" e "Branch ativa", logo abaixo
3. A tabela **Histórico de rodadas**, ao fim do arquivo — uma linha por rodada
4. **Próximos passos** — remover o que foi feito, repriorizar o resto
5. **Decisões em aberto** — quando uma Q-n for decidida, tirar da tabela e refletir na feature afetada

Nunca deixe este arquivo afirmar algo que já se sabe falso: um estado desatualizado é pior que nenhum, porque é lido como verdade.

**Última atualização:** 2026-09-16 (S2 da spec 001) · **Branch ativa:** `main` (branches de feature são removidas após o merge)

## Legenda

| Símbolo | Significado |
|---|---|
| ✅ | Concluída e verificada |
| 🟡 | Parcial — existe, mas falta validação ou complemento |
| ⬜ | Não iniciada |
| 🔒 | Bloqueada por dependência |

**Camada:** onde o código executa — servidor, navegador ou dispositivo.
**Autoral:** se o código entra no depósito do INPI como criação própria.

---

## Panorama

| # | Feature | Camada | Status |
|---|---|---|---|
| F1 | Ambiente containerizado | servidor | ✅ |
| F2 | Adaptador MATIEC (ST → C) | servidor | ✅ |
| F3 | Toolchain ESP32 + runtime hospedeiro | servidor + dispositivo | 🟡 |
| F4 | Endpoint de compilação | servidor | ✅ |
| F5 | Gravação via navegador | servidor + navegador | 🟡 |
| F6 | Tela mínima (fatia vertical) | navegador | 🔒 |
| F7 | Editor Ladder visual | navegador | ⬜ |
| F8 | Serializador Ladder → ST | navegador | 🔒 |
| F9 | Simulador de ciclo de varredura | navegador | ⬜ |
| F10 | Coleta de métricas e validação | — | 🟡 |
| FT | Conformidade para depósito (transversal) | — | 🟡 |

**Leitura rápida:** a metade servidor está completa até a gravação: `POST /compile` devolve o `.bin`, `POST /compile/pacote` devolve imagens e offsets, e esse pacote foi gravado via `esptool` num ESP32 emulado (QEMU), que deu boot. A metade navegador ainda não existe, e nenhum dispositivo físico foi gravado.

---

## F1 — Ambiente containerizado ✅

**Camada:** servidor · **Autoral:** parcial (Dockerfile e compose são autorais)

Ambiente único em contêiner com FastAPI, MATIEC e ESP-IDF, mais o frontend em Vite.

**Ferramentas:** Docker, Docker Compose, base `espressif/idf:v5.4.1`

**Concluído**
- Dockerfile multi-estágio: `matiec-builder` compila o `iec2c`; `runtime` sobre a base da Espressif
- `docker compose up` sobe backend e frontend com dependência ordenada
- `/health` reporta `iec2c` e `esp_idf` com versão
- Volume nomeado para cache de build incremental
- Suíte de testes, `ruff` e `tsc --noEmit` limpos

**Custo registrado:** imagem de 7,33 GB (medido). Concentração deliberada de peso no servidor para que o cliente não instale nada.

---

## F2 — Adaptador MATIEC (ST → C) ✅

**Camada:** servidor · **Autoral:** sim (`matiec.py`)

Fronteira de subprocesso que invoca o `iec2c` e devolve os arquivos C gerados.

**Ferramentas:** MATIEC (`iec2c`), pinado por commit — GPL-3.0, invocado como processo separado

**Concluído**
- `backend/app/services/matiec.py` com dataclasses `frozen` e hierarquia de erros
- Invocação com `-f` para preservar localização de token (linha/coluna)
- Saída canônica verificada: `POUS.c/h`, `Config0.c/h`, `Res0.c`, `GLOBALS.h`, `LOCATED_VARIABLES.h`
- Testes em `test_matiec.py`

---

## F3 — Toolchain ESP32 + runtime hospedeiro 🟡

**Camada:** servidor (compilação) + dispositivo (execução) · **Autoral:** sim — é o núcleo autoral mais forte do projeto

Compila o C gerado pelo MATIEC em firmware executável. Inclui o runtime que o `iec2c` não gera: laço de varredura, temporização e mapeamento de variáveis localizadas para GPIO.

**Ferramentas:** ESP-IDF v5.4.1 (Apache-2.0); headers do MATIEC linkados no firmware (LGPL-3.0-or-later)

> ⚠️ **Ao mexer em `backend/firmware/**` ou no `backend/Dockerfile`, reconstrua a imagem antes de testar:** `docker build -t ladderflow-backend:dev backend/`. O `ESP_PROJECT_TEMPLATE` aponta para a cópia dentro da imagem (`/app`), não para o *bind mount* (`/repo`) — sem o rebuild, `test_esp32.py` e `test_qemu.py` medem firmware antigo **sem acusar erro**. Ver `docs/validacao/limites-da-validacao-sem-hardware.md`. O aviso também está na Regra 5 do `CLAUDE.md`, onde se lê antes de rodar testes.

**Concluído**
- `backend/app/services/esp32.py` — segunda fronteira de subprocesso
- `backend/firmware/esp32-template/` — projeto IDF autoral (`app_main.c`, `plc_glue.c/h`)
- Build real em teste automatizado: `blink.st` → `iec2c` → `idf.py build` → `.bin` de 183 KB
- Build incremental sobre volume persistente
- Pinagem revisada (ver Q-5): `%IX0.1` migrado de GPIO5 para GPIO18 por conflito com strapping pin
- `test_plc_io_map.py` falha se header e spec divergirem
- `-Werror=all` rebaixado seletivamente, por aviso nomeado, apenas para código gerado e headers de terceiros
- **Camada de abstração de I/O** (`plc_hal.h`) com duas implementações atrás da mesma interface — ESP32 (`plc_hal_esp32.c`) e stub em memória (`plc_hal_stub.c`), escolhidas em tempo de compilação, sem `#ifdef` na lógica
- **Runtime executável no host**: `plc_host_runner` religa o C do `iec2c` ao runtime autoral a cada execução; `test_plc_runtime_host.py` verifica a ordem lê → resolve → escreve, a alternância do `blink.st` e o mapeamento localizado ↔ `plc_io_pins`
- Invariante de imagem de processo (uma leitura de pino por ciclo, só em `read_inputs()`; `write_outputs()` nunca consulta entrada) registrada em comentário sobre `plc_glue_scan`, marcada como propriedade estrutural **sem teste que a derrube por inteiro**
- **Boot verificado em QEMU** (`test_qemu.py`, `slow`): sem *panic*, sem *bootloop*, e heartbeat `scan ciclo=<N>` crescente — a primeira evidência de que o firmware **executa**

**Falta**
- 🔴 **Gravação em ESP32 físico — bloqueada: não há ESP32 disponível.** Ver "Bloqueado aguardando hardware". Pendente, e com ela tudo o que exige o dispositivo: gravação via Web Serial ponta a ponta, tempo de ciclo real e comportamento dos *strapping pins* no boot. Ver `docs/validacao/limites-da-validacao-sem-hardware.md`.
- Procedimento documentado em `docs/validacao/ca-4-gravacao-esp32.md`, com offsets `0x1000`/`0x8000`/`0x10000` conferidos contra o `flasher_args.json` gerado — **pendente de execução**

> **Mudança de status (2026-09-15).** Até esta rodada, "o laço de varredura funciona" não tinha nenhuma evidência: o firmware compilava e nunca havia executado. Agora tem, por dois caminhos independentes e sem hardware — o runtime roda no host com I/O em memória, e o firmware real dá boot em QEMU com o laço progredindo. O que **não** mudou é o risco de integração com o dispositivo físico, que segue inteiro.

> **Nota:** a validação por `esptool` de linha de comando confirma o firmware, mas **não fecha CA-4**, que exige gravação pelo navegador (depende de F5).

---

## F4 — Endpoint de compilação ✅

**Camada:** servidor · **Autoral:** sim

`POST /compile` recebe texto ST e devolve o binário ou erro estruturado. É a porta de entrada para o motor que já funciona.

**Ferramentas:** FastAPI (já instalado). Nenhuma dependência nova.

**Decisões já tomadas**
- **Q-6** — compilação **síncrona**. Bloqueia até binário ou erro, com timeout por etapa. Viável porque o build incremental leva 11–13 s (build frio: 66 s). Migração para `202 + job_id` fica aditiva se a medição piorar.
- **Q-3** — envelope de erro estável com `stage`, `code`, `message`, `diagnostics[]` e `raw`. O `diagnostics` é *best-effort*; `raw` sempre carrega a saída bruta íntegra. Revisão aditiva de 2026-09-16: `stage` ganha o valor `"request"`, usado só com `code: "payload_too_large"`, porque esse erro acontece antes de qualquer etapa de compilação.
- **Q-2** (decidida 2026-09-16) — limite do corpo de `POST /compile`: **256 KiB (262 144 bytes)**, conferido por `Content-Length` e pelo corpo lido, antes de compilar. Justificativa: ST é texto, um programa da PoC gera poucos KB, o envelope Q-3 já previa `payload_too_large`, e o valor dá duas ordens de grandeza de folga funcionando também como limite de abuso.

**Concluído (S1 da spec 001, 2026-09-16)**
- `backend/app/services/matiec.py`: `parse_diagnostics(stdout, stderr) -> list[Diagnostic]`, best-effort sobre o formato real do `iec2c` (`arquivo:linha-col..linha-col: severidade: mensagem`), capturado em `backend/tests/fixtures/iec2c_saidas/` **antes** de escrever a regex
- `backend/app/services/pipeline.py` (novo): `compilar(source) -> ResultadoCompilacao | FalhaCompilacao`, encadeia matiec → esp32 com timeout por etapa (config), `threading.Lock` de módulo serializando o diretório de trabalho compartilhado, mapeia toda exceção dos dois adaptadores para o envelope Q-3, devolve `build_dir` para a S2 usar
- `backend/app/api/compile.py` (novo): `POST /compile`, validação de tamanho (`checar_tamanho_corpo`) e mapeamento de erro (`mapear_falha`) desenhados como peças reutilizáveis pela S2 (`POST /compile/pacote`); registrado em `main.py` com *exception handler* dedicado para o envelope não virar `{"detail": ...}`
- `backend/tests/test_compile_api.py` (novo, 15 testes): contrato rápido com `monkeypatch` nos adaptadores, teste real do `iec2c` com ST inválido, teste `slow` ponta a ponta com `blink.st`, testes do parser sobre as fixtures
- Suíte completa (50 testes, incluindo `slow`) verde na imagem; `ruff check`/`ruff format --check` limpos nos arquivos tocados
- Curl de aceitação contra o stack em `BACKEND_PORT=18000`: `blink.st` → `.bin` de 197 088 bytes; ST inválido → `422` com `stage:"matiec"` e `diagnostics` não vazio; corpo de 300 KB → `413` com `stage:"request"`
- `scripts/build-deposito.sh --verificar`: `backend/app/api/compile.py` e `backend/app/services/pipeline.py` no manifesto, exit 0
- `docs/specs/001-fatia-vertical-minima/plan.md` e `tasks.md` preenchidos (Fatia 1 = S1 concluída; Fatias 2 e 3 = S2/S3, ainda não iniciadas)

**Falta**
- `POST /compile/pacote` (JSON com as 3 imagens de flash + offsets) — S2
- 🟡 **Pré-requisito para VPS, ainda fora de escopo (ver §7 da spec 001):** autenticação, *rate limiting*, fila de compilação se houver concorrência real (hoje só há exclusão mútua via `threading.Lock`, suficiente para um usuário por vez), e HTTPS na borda — nenhum implementado, todos necessários antes de expor o serviço fora de `localhost`.

---

## F5 — Gravação via navegador 🟡

**Camada:** navegador · **Autoral:** integração

Transfere o `.bin` ao ESP32 pela porta serial, sem driver nem instalação.

**Ferramentas:** esptool-js (Apache-2.0) + Web Serial API

**Requisitos de ambiente:** Chrome/Edge 89+, contexto HTTPS ou `localhost`

**Concluído — camada servidor (S2, 2026-09-16)**
- `esp32.flash_manifest(build_dir)` lê imagens, offsets, chip e `flash_settings` do `flasher_args.json` real. Nenhum offset hardcoded. Observado no `blink.st`: `0x1000` / `0x8000` / `0x10000`.
- `POST /compile/pacote` entrega `{chip, flash, images[{name, offset, size, sha256, data_base64}]}`. É o contrato que o navegador consome.
- Correção de concorrência: o binário e o manifesto são lidos **dentro** da trava do pipeline, e os endpoints não tocam mais no diretório de build compartilhado.
- **Gravação provada no QEMU** (`test_gravacao_qemu.py`, `slow`):
  - o pacote da API é gravado por `esptool` sobre `socket://` no `qemu-system-xtensa` em modo download;
  - o QEMU reinicia sobre a mesma flash;
  - o boot segue o mesmo contrato de `test_qemu.py` (sem panic, um reset, heartbeat crescente).
  - Funcionou de primeira, sem plano B.
- Offsets do pacote iguais aos do `flasher_args.json`, e sha256 igual ao dos arquivos do build — **conferidos por teste**, não por suposição.
- Registro do que isso prova e do que não prova em `docs/validacao/gravacao-qemu-esptool.md`.

**Falta**
- Camada navegador: wrapper sobre o esptool-js, seleção de porta, progresso e tratamento de erro (S3).
- **Transporte Web Serial:** depois da S2, é a única camada da gravação sem cobertura automatizada. É código da Espressif (esptool-js) e só fecha com ESP32 físico (CA-4).

> **Observação:** o `esptool.py` no servidor vem embutido no ESP-IDF e gera o `.bin` a partir do ELF — não é decisão a tomar, é dependência do toolchain.

---

## F6 — Tela mínima (fatia vertical) 🔒

**Camada:** navegador · **Autoral:** sim · **Bloqueada por:** F4, F5

Interface deliberadamente crua: caixa de texto para colar ST, botão compilar, botão gravar. Não é o produto — é o instrumento que fecha a fatia vertical da spec 001.

**Ferramentas:** React, Tailwind (já instalados)

**Por que importa:** é o marco a partir do qual se pode afirmar viabilidade técnica. ST digitado no navegador acendendo um LED prova os quatro elos da cadeia de uma só vez.

---

## F7 — Editor Ladder visual ⬜

**Camada:** navegador · **Autoral:** sim · **Maior feature do projeto**

Construção de diagramas de contatos e bobinas em grade.

**Ferramenta:** decisão em aberto — exige *spike* antes de escolher

| Opção | A favor | Contra |
|---|---|---|
| SVG puro + modelo de grade próprio | Modelo de dados limpo, casa com a serialização | Mais código inicial |
| Konva | Controle fino de canvas, ajuda no arrastar/soltar | A grade continua sendo responsabilidade nossa |
| React Flow | Início mais rápido | Feito para grafos de posicionamento livre; Ladder é grade rígida — atrito crescente |

**Restrição de PI:** não reaproveitar código de `cdilga/ladder-logic-editor`, `hiperiondev/*` ou correlatos. Referência conceitual é legítima; cópia de arquivos transformaria o projeto em obra derivada e esvaziaria a originalidade do depósito.

**Falta:** *spike* de biblioteca, modelo de dados da grade, renderização, edição, validação de posições.

---

## F8 — Serializador Ladder → ST 🔒

**Camada:** navegador · **Autoral:** sim · **Bloqueada por:** F7 (depende do modelo de dados da grade)

Percorre a grade e produz texto ST conforme a IEC 61131-3. Pequeno em linhas, central em importância — é a tradução que dá sentido à arquitetura inteira.

**Ferramentas:** nenhuma. TypeScript puro.

---

## F9 — Simulador de ciclo de varredura ⬜

**Camada:** navegador · **Autoral:** sim

Executa a lógica no navegador antes da gravação, seguindo a semântica da norma: lê entradas → resolve todos os rungs → escreve saídas → repete.

**Ferramentas:** nenhuma. TypeScript puro.

**Ponto de atenção:** é implementação independente do runtime em C do F3. A divergência entre os dois é **métrica do TCC**, não bug a esconder — deve ser medida e reportada.

**Escopo inicial:** contatos NA/NF e bobinas. Temporizadores e contadores (TON/TOF/CTU/CTD) em iteração posterior.

---

## F10 — Coleta de métricas e validação 🟡

**Camada:** transversal · Sustenta a conclusão científica do trabalho

| Métrica | Status |
|---|---|
| Tempo de compilação | ✅ frio 66 s · incremental 11–13 s (Q-4) |
| Corretude do ciclo (tabela-verdade) | 🟡 verificada no runtime hospedeiro (host + QEMU); falta confirmar em hardware |
| Divergência simulação ↔ hardware | 🟡 instrumento pronto (`backend/tests/diferencial/`), aguardando F9 |
| Taxa de sucesso de gravação em N tentativas | 🔒 depende de F5 |
| Tempo de ciclo de varredura no dispositivo | ⬜ |
| Tempo total edição → dispositivo operante | 🔒 depende de F6 |
| Cobertura de elementos IEC 61131-3 | ⬜ |
| Acessibilidade: pré-requisitos vs. fluxo desktop | ⬜ comparação com OpenPLC |

**Arcabouço de teste diferencial (2026-09-15).** `backend/tests/diferencial/` está pronto: fixture declarativa em TOML (código ST, entradas por ciclo, saídas esperadas por ciclo), `HostRunnerExecutor` falando o contrato de `docs/validacao/contrato-runtime-host.md`, e um comparador que reporta ciclo, ponto e esperado/obtido. A abstração `Executor` e a função `comparar_execucoes` já existem para receber o simulador de F9 sem reescrita — falta só o segundo executor.

**Alerta metodológico:** "o firmware compila" é evidência de que um componente funciona, não de que a integração é viável. A isso se acrescenta, desde 2026-09-15: **"o firmware roda no emulador" é evidência de que o código executa, não de que o dispositivo funciona.** A conclusão do trabalho precisa estar ancorada nestes números, não em demonstração pontual.

---

## FT — Conformidade para depósito (transversal) 🟡

**Concluído**
- `scripts/build-deposito.sh` **audita e aborta** em vez de apenas imprimir: manifesto `REQUIRED_FILES` (14 fontes de firmware + adaptadores + `api.ts`) e listas de artefatos proibidos
- Modo `--verificar` para CI
- `verificar_origem` inspeciona a **árvore de origem**, não o staging — evita que os `EXCLUDES` do rsync limpem contaminação em silêncio e produzam pacote verde indevidamente
- Quatro testes em `test_deposito.py`, incluindo dois negativos que provam que o guarda morde. **Desde 2026-09-16 eles rodam na imagem**: `rsync` e `zip` passaram a ser instalados no `Dockerfile` (camada de 3,04 MB); antes, pulavam em silêncio pelo `skipif`
- Critério escrito do que entra no depósito — **o programa, não o projeto** — no cabeçalho de `scripts/build-deposito.sh`, com a regra para arquivo novo
- `THIRD_PARTY.md` corrigido: headers do MATIEC são **LGPL-3.0-or-later** (não LGPL-2.1) — `iec_types_all.h` declara LGPL-3+ e `iec_std_lib.h` declara LGPL-2+; como o build reúne ambos pelo mesmo `-I`, prevalece a mais restritiva
- Distinção registrada entre processo separado (sem obra derivada) e linkagem real no firmware (implicação sobre o binário do usuário final, não sobre a plataforma)
- ESP-IDF registrado como Apache-2.0
- QEMU registrado em `THIRD_PARTY.md` (GPL-2.0-only, com componentes sob licenças compatíveis) como ferramenta externa em processo separado, usada só em teste; nenhum fonte copiado para a árvore autoral
- Imagem de eFuse do QEMU **descrita**, não transcrita do ESP-IDF, com teste que confere byte a byte contra o valor da toolchain — evita pôr blob de terceiro na árvore autoral sem abrir mão da fidelidade
- Rodada de 2026-09-15 commitada em cinco commits rastreáveis e integrada à `main` (`ba92980..09534f7`, fast-forward), com push para `origin`
- Painel de estado (`.claude/state.md`) instituído com atualização obrigatória por rodada — sustenta a rastreabilidade da autoria exigida pelo depósito

**Falta**
- Confirmação formal de titularidade e coautoria com o NIT do IFTM
- Decisão de licença (manter sem `LICENSE` até o depósito — posição reversível)
- Alinhamento com o NIT sobre uso de assistentes de IA no desenvolvimento

---

## Decisões em aberto

| ID | Questão | Impacto | Quando decidir |
|---|---|---|---|
| — | Biblioteca de canvas do editor Ladder | F7 inteira | *Spike* antes do Sprint do editor |
| — | Temporizadores e contadores no escopo da PoC | F8, F9, cobertura IEC | Após a fatia vertical fechar |

---

## Próximos passos, em ordem

1. **S3** (navegador) da spec 001, sobre o contrato de `docs/specs/001-fatia-vertical-minima/plan.md`: `gravador.ts` sobre `esptool-js` e tela mínima (F5 + F6). A afirmação de viabilidade só fecha com o hardware físico (ver abaixo).
2. *Spike* de biblioteca de canvas → **F7** → **F8**
3. **F9** e início da coleta sistemática de métricas (**F10**)

## Bloqueado aguardando hardware

Não há ESP32 físico disponível. Nada abaixo é executável até haver um; não trate estes itens como próximo passo.

- **Gravar o `.bin` em ESP32 físico** — procedimento pronto em `docs/validacao/ca-4-gravacao-esp32.md`. O risco que resta é o de **integração com o dispositivo**, não o de corretude da lógica (ver F3 e `docs/validacao/limites-da-validacao-sem-hardware.md`)
- Tempo de ciclo de varredura medido no dispositivo (F10)
- Comportamento dos *strapping pins* no boot
- **CA-4** pelo navegador — depende também de F5
- Taxa de sucesso de gravação em N tentativas e tempo edição → dispositivo operante (F10)

---

## Histórico de rodadas

| Data | Rodada | Resultado |
|---|---|---|
| — | Sprint 0 | Ambiente containerizado, MATIEC operacional, `/health` |
| 2026-09-10 | Toolchain ESP32 | Firmware compila (183 KB); Q-1, Q-3, Q-4, Q-5, Q-6 registradas |
| 2026-09-15 | Conformidade e pinagem | Auditoria de depósito com abort; `%IX0.1` → GPIO18; licenças corrigidas (LGPL-3.0-or-later); CA-4 documentado; integrado à `main` |
| 2026-09-15 | Painel de estado | Este documento criado como `state.md`; atualização tornada obrigatória em `CLAUDE.md`, `docs/workflow.md` e nos comandos do SDD |
| 2026-09-15 | Validação sem hardware | Runtime autoral passa a **executar**: camada de abstração de I/O com stub, runtime no host, boot verificado em QEMU e arcabouço de teste diferencial pronto para F9. Nada do que exige ESP32 físico foi fechado — ver `docs/validacao/limites-da-validacao-sem-hardware.md` |
| 2026-09-16 | Correção do painel e pendências de revisão | Gravação física saiu de "Próximos passos" para "Bloqueado aguardando hardware" (não há ESP32); `rsync`/`zip` na imagem — `test_deposito.py` deixa de pular (4 passed); aviso de imagem velha na Regra 5 do `CLAUDE.md`; critério "o programa, não o projeto" no cabeçalho do `build-deposito.sh`; invariante não testada de `plc_glue_scan` comentada |
| 2026-09-16 | S1 da spec 001 — `POST /compile` | F4 fechada: parser de diagnóstico do `iec2c` (fixtures reais capturadas antes do parser), `pipeline.py` encadeando matiec→esp32 com lock e timeouts, endpoint com envelope Q-3 e limite de corpo (Q-2 decidida, 256 KiB); 50 testes verdes (com `slow`), curl de aceitação confirmado (`.bin` de 197 088 bytes, erro 422 com diagnostics, 413 por tamanho); `plan.md`/`tasks.md` da spec 001 preenchidos; manifesto do depósito atualizado |
| 2026-09-16 | S2 da spec 001 — gravação, camada servidor | `esp32.flash_manifest` com offsets lidos do `flasher_args.json`; `POST /compile/pacote`; leitura do binário e do manifesto dentro da trava do pipeline; pacote da API gravado por `esptool` sobre socket no QEMU, reiniciado e com o laço progredindo (sem plano B); 63 testes verdes (com `slow`); Web Serial passa a ser a única camada da gravação sem cobertura |
