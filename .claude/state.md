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

**Última atualização:** 2026-10-01 (conteúdo do pacote INPI alinhado à spec 006 e à distribuição do `.bin`; o hash desta versão ainda será gerado nesta rodada) · **Branch ativa:** `main`

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
| F6 | Tela mínima (fatia vertical) | navegador | ✅ |
| F7 | Editor Ladder visual | navegador | ✅ |
| F8 | Serializador Ladder → ST | navegador | ✅ |
| F9 | Simulador de ciclo de varredura | navegador | ✅ |
| F11 | Ambientes de simulação (portão) | navegador | ✅ |
| F10 | Coleta de métricas e validação | — | 🟡 |
| FT | Conformidade para depósito (transversal) | — | 🟡 |

**Leitura rápida:** com a F11 (2026-09-21) o fluxo editar → simular (diagrama + planta) → compilar → gravar está completo no software; o que resta sem cobertura continua sendo hardware físico. Com a F9 (2026-09-21) **não havia mais feature de código pendente além de ambientes**: o software está completo, e o que resta sem cobertura é o transporte Web Serial contra ESP32 físico — que não é código a escrever. A fatia vertical está fechada até onde é possível sem ESP32. Desde 2026-09-18 (F8), ela vale também para **diagramas Ladder**: o diagrama é serializado para ST no navegador e segue o mesmo caminho, com a equivalência medida no runtime. No navegador, cola-se ST (ou monta-se o diagrama), compila-se no servidor e o pacote (imagens + offsets) chega à tela. O botão Gravar vai até a tentativa de conexão Web Serial e falha de forma clara sem dispositivo. No servidor, o mesmo pacote foi gravado via `esptool` num ESP32 emulado (QEMU), que deu boot. Nenhum dispositivo físico foi gravado: o transporte Web Serial é a única camada sem cobertura.

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

**Concluído (S2 da spec 001, 2026-09-16)**
- `POST /compile/pacote` (JSON com as 3 imagens de flash + offsets). *Correção de 2026-09-20: até esta data este item continuava listado em "Falta" aqui, embora a **F5** o registre concluído desde 2026-09-16 — ver "Concluído — camada servidor (S2)" na F5. O item foi movido, não reescrito.*

**Falta**
- 🟡 **Pré-requisito para VPS em produção (ver §7 da spec 001):** autenticação, *rate limiting* e fila de compilação sob concorrência real continuam **fora do código**. Para demonstração temporária, `deploy/` documenta compose de produção (front estático, portas só em `127.0.0.1` via `deploy/.env`), `frontend/Dockerfile.prod` e Caddy do host com TLS + `basic_auth` — não entra no pacote de depósito (`build-deposito.sh --verificar` inalterado quanto ao manifesto autoral).

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

**Concluído — camada navegador (S3, 2026-09-16)**
- `frontend/src/lib/gravador.ts` sobre `esptool-js` 0.6.1:
  - `webSerialDisponivel()`;
  - `gravar(pacote)` monta o `fileArray` **a partir dos offsets do pacote**, com progresso agregado de 0 a 100, reset e `disconnect` no `finally`;
  - erros classificados: `sem_web_serial`, `porta_nao_selecionada`, `falha_conexao`, `porta_desconectada`, `falha_gravacao`.
- 10 testes `vitest`, com serial e loader injetados: navegador sem Web Serial, usuário cancela ou não há porta, falha de conexão, porta desconectada no meio, offsets repassados iguais aos do pacote, compilação falha na tela.
- **Verificado em Chromium headless** (Playwright em contêiner, contra o stack via `docker compose`):
  - compilar `blink.st` → "3 imagens prontas";
  - ST inválido → painel com `3:4 — no expression defined…` e Gravar desabilitado;
  - Gravar sem dispositivo → a tentativa chega ao `requestPort` e falha com "Nenhuma porta serial foi selecionada".
- **Modal de porta serial (revisão spec 001, 2026-09-23, CA-7):** `portasSeriais.ts` + `ModalPortaSerial.tsx`; Gravar abre o modal (portas autorizadas + "Adicionar porta…" → seletor nativo); confirmação passa `opcoes.porta` ao `gravar` — progresso "Gravando…" só após confirmar; cancelar registra no Console sem chamar `esptool-js`. Testes vitest em `portasSeriais`, `gravador`, `ModalPortaSerial` e `App.test`.

**Falta**
- **Transporte Web Serial:** depois da S2, é a única camada da gravação sem cobertura automatizada. É código da Espressif (esptool-js) e só fecha com ESP32 físico (CA-4).

> **Observação:** o `esptool.py` no servidor vem embutido no ESP-IDF e gera o `.bin` a partir do ELF — não é decisão a tomar, é dependência do toolchain.

---

## F6 — Tela mínima (fatia vertical) ✅

**Camada:** navegador · **Autoral:** sim

Interface deliberadamente crua: caixa de texto para colar ST, botão compilar, botão gravar. Não é o produto — é o instrumento que fecha a fatia vertical da spec 001.

**Ferramentas:** React, Tailwind (já instalados)

**Concluído (S3, 2026-09-16)**
- `App.tsx` + `components/EditorST`, `PainelErro`, `PainelGravacao`:
  - textarea com o `blink.st`;
  - botão Compilar (`/compile/pacote`), com aviso de que o primeiro build é lento;
  - botão Gravar, habilitado só com pacote válido e Web Serial;
  - painel de erro renderizando o envelope Q-3 (stage, code, diagnostics linha:coluna, `raw` em `<details>`);
  - progresso;
  - rodapé com `/health`.
- `tsc --noEmit`, `vitest run` e `npm run build` limpos.
- **Marco:** a partir daqui existe algo demonstrável — não é o produto, mas é mostrável ao orientador.

**Por que importa:** é o marco a partir do qual se pode afirmar viabilidade técnica. ST digitado no navegador acendendo um LED prova os quatro elos da cadeia de uma só vez.

---

## F7 — Editor Ladder visual ✅

**Camada:** navegador · **Autoral:** sim · **Maior feature do projeto**

**Spec:** [`docs/specs/002-editor-ladder/spec.md`](../docs/specs/002-editor-ladder/spec.md). Aprovada em 2026-09-16; plano e tarefas também aprovados. As quatro fatias e os ajustes #21–#27 foram concluídos em 2026-09-19. O histórico está abaixo, em ordem.

Construção de diagramas de contatos e bobinas em grade. A spec 002 cobre
contato NA, contato NF, bobina simples, bobina SET/RESET, ramo paralelo (OU) e
contador crescente — escopo motivado pelas três fixtures de referência do
projeto (`blink.st`, `io_espelho.st`, `minimal.st`); Q-1 a Q-7 decididas em 2026-09-16 (Q-4 revisada: equivalência exata; Q-6
registrada como desvio deliberado da prática corrente; Q-7: CTU destacável).

**Ferramenta (decidida no spike S4, 2026-09-16):** **SVG puro renderizado pelo React**, sem dependência nova. Konva prototipado e medido; React Flow descartado por argumento (grafo de posicionamento livre × grade rígida). Registro com medições em `docs/specs/002-editor-ladder/spike-canvas.md`; protótipos em `spikes/` (fora do depósito).

| Critério | SVG puro | Konva |
|---|---|---|
| Linhas autorais | 213 | 325 |
| Teste de UI em jsdom | sem mock | só com `canvas` nativo |
| Teclado / leitor de tela | por célula, 12 linhas | cursor lógico único; células invisíveis |
| Bundle gzip | 71 kB | 174 kB |

**Modelo de dados (spike S4):** grade `(linha, coluna)` por rung, ramos como intervalo de colunas, elementos em união discriminada, variável com endereço opcional; validação em funções puras com seis códigos de problema; as três fixtures passam (19 testes em `spikes/modelo/`). **Achado medido (revisado):** a primeira medição concluiu que blink em Ladder com CTU não fechava ciclo a ciclo "por construção"; a investigação do preset (`spikes/modelo/preset25/RESULTADO.md`) **refutou** isso — PV=12 com realinhamento do sinal de contagem e LED alternado pelo limite atrasado dá 0 divergências em 200 ciclos × 3 padrões de entrada contra `blink.st` executado. Auditoria independente confirmou os 19 testes e os números do agente original. **Lacuna do modelo:** o CTU precisa de entrada de reset por caminho de contatos (Q-5).

**Restrição de PI:** não reaproveitar código de `cdilga/ladder-logic-editor`, `hiperiondev/*` ou correlatos. Referência conceitual é legítima; cópia de arquivos transformaria o projeto em obra derivada e esvaziaria a originalidade do depósito.

**Plano (aprovado 2026-09-16, ressalvas R-1 a R-3):** `docs/specs/002-editor-ladder/plan.md` — núcleo puro em `frontend/src/ladder/` + SVG em `components/ladder/`; interação por seleção (sem arrastar); CTU terminal com linha de reset e isolado em `ladder/ctu.ts` (Q-7); `localStorage` versionado (Q-1); modos Ladder/ST (Q-2); 8 colunas e 2 linhas extras (Q-3); endereços restritos a `plc_io_map.h`; blink exato verificado por `blink_ladder.st` × `blink.st` até a F8 existir. Fatias: S5a = 1–2, S5b = 3–4.

**Ressalvas da aprovação:** R-1 — o teste do blink declara no código que a equivalência diagrama ↔ ST é assumida até a F8; R-2 — seleção sem arrastar registrada como decisão de design (grade não tem posição livre); R-3 — teste em `test_plc_io_map.py` falha se `plc_io_map.h` e `ladder/enderecos.ts` divergirem.

**Limitação declarada (TCC):** recusa de bobina simples duplicada (Q-6), desvio consciente da prática de mercado, ao lado da cobertura parcial da IEC 61131-3.

**Tarefas (aprovadas 2026-09-16):** `docs/specs/002-editor-ladder/tasks.md` — 20 tarefas em 4 fatias, com frentes N (núcleo, dona de `ladder/`), D (desenho), T (tela) e B (back-end/depósito) e propriedade de arquivo por fatia.

**Concluído — Fatia 1 / S5a (tarefas #1–#8, 2026-09-16)**
- Núcleo `frontend/src/ladder/`: `modelo.ts` (contrato sem CTU, 8 colunas, 2 linhas extras), `enderecos.ts` (4 endereços do `plc_io_map.h`), `fixtures.ts` (`IO_ESPELHO`, `MINIMAL`), `validacao.ts` (seis códigos com severidade; célula vazia na linha 0 conduz), `edicao.ts` (operações puras que recusam com motivo, ids `e<N>`)
- Desenho `frontend/src/components/ladder/`: `GradeDegrau` (SVG, célula focável com `aria-label`), `Simbolos` (NA, NF, bobina), `Paleta`, `PainelVariaveis`, `EditorLadder` (seleção ferramenta → célula; Esc cancela; remover limpa seleção)
- `App.tsx`: editor acima da caixa de ST (provisório até os modos da #12)
- R-3 cumprida: `test_plc_io_map.py` falha se `plc_io_map.h` e `enderecos.ts` divergirem (com dois testes negativos)
- CA-1, CA-2 e CA-5 verificados por teste de componente (espelho e mínimo construídos só pela UI, iguais às fixtures)
- Verificação: `tsc` limpo, 69 testes vitest, `vite build` (JS 350 kB / 110 kB gzip), pytest `not slow` 60 passed, `ruff` limpo, `build-deposito.sh --verificar` ok
- Implementado por frentes paralelas (N, D, T, B) no mesmo checkout, com dono único por arquivo; nenhum conflito

**Concluído — ajuste de interação #21 (entre as fatias 1 e 2, plano §11/D-11, 2026-09-16)**
- Paleta com símbolo de cada elemento ao lado do nome (ícone `aria-hidden`, chip claro no botão pressionado para contraste)
- Prévia sob o cursor **e** sob o foco de teclado, calculada chamando a própria operação do núcleo sem aplicar: fantasma translúcido (válida), célula vermelha com motivo em `<title>` (inválida), elemento em vermelho (remover)
- Recusa em `role="alert"` logo abaixo do degrau, com a célula marcada (`aria-invalid`, `aria-describedby`); erros de variável seguem no painel — resolve a pendência "recusa longe da grade" da fatia 1
- Mensagens do núcleo 1-based ("degrau N, coluna M") e explicando a regra violada; achado na verificação visual em Chromium headless, onde a mensagem dizia `linha=0, coluna=0` contra o rótulo "coluna 1" da tela. `motivoPosicaoInvalida` passou a ser a única implementação da regra de posição (`posicaoValida` deriva dela)
- Verificação: `tsc` limpo, 107 testes vitest, `vite build`; capturas em Chromium headless (paleta ativa, fantasma, célula inválida, recusa abaixo da grade)

**Concluído — #22: arrastar-e-soltar, tabela de variáveis e modal (plano §12, D-12, 2026-09-16)**
- Decisão do autor após uso: reverte D-4/R-2 (seleção ferramenta → célula). Inserir, mover e remover **só por arrasto** (Pointer Events próprios, sem biblioteca); teclado dentro do próprio arrasto (Espaço pega, setas, Espaço solta, Esc cancela, `aria-live`)
- Clique marca; lixeira ou Delete remove o marcado; duplo clique/Enter abre o modal
- `TabelaVariaveis` ao lado dos degraus (nome, tipo entrada/saída/interna, endereço livre da classe) e `ModalVariavel` acessível (bobina não aceita entrada); `PainelVariaveis` removido
- Núcleo: `moverElemento` (antecipado da #9), `atualizarVariavel` (renomear propaga), `removerVariavel` (recusa em uso), `classeDaVariavel`/`enderecosDaClasse`
- **Bug achado só no navegador real:** o segundo arrasto não funcionava. A primeira hipótese da frente (pointerenter perdido) estava errada — o teste simulava o defeito errado e passava. Log de eventos no Chromium mostrou `pointercancel`: seleção de texto residual fazia o navegador iniciar arrasto nativo. Correção: `preventDefault` no `pointerdown`, `select-none`/`touch-none`, limpeza de seleção; regressão testada
- Verificação: `tsc` limpo, 181 testes vitest, `vite build` (JS 370 kB / 116 kB gzip); fluxo completo em Chromium headless com mouse real (tabela, NA→col 1 com prévia e modal, recusa de bobina na col 2, bobina na col 8 com entrada desabilitada, mover, marcar+lixeira, arrastar à lixeira) e só por teclado
- Lição de processo: teste em jsdom não substitui verificação no navegador para interação de ponteiro — nenhum dos 172 testes pegou o bug

**Concluído — #23: IDE, segundo clique, variáveis e pinagem 8/8 (plano §13, D-13, 2026-09-17)**
- Segundo clique abre o modal; soltar item novo só marca
- Painel de variáveis Nome | Endereço | Tipo (BOOL) | Valor ("—" até a F9), filtro por classe, mapa endereço → GPIO
- **Pinagem 8/8** (`%IX0.0–7` → GPIO 0, 18, 19, 21, 22, 23, 32, 33; `%QX0.0–7` → GPIO 2, 4, 16, 17, 25, 26, 27, 13); revisão aditiva da Q-5 da spec 001; teste R-3 confere também o GPIO; **12 pinos novos sem validação em hardware**
- Casca de IDE em tela inteira: abas Ladder/ST, status do servidor, painel de variáveis e console recolhíveis e redimensionáveis, temas escuro e claro por tokens; console registra `/health`, compilação e gravação (`PainelGravacao` removido)
- Verificação: `tsc` limpo, 269 testes vitest, `vite build`; imagem reconstruída; pytest completo com `slow` 70 passed (rodado como root — ver pendência) e `not slow` 63 passed; depósito ok; Chromium com back-end real em rede isolada: layout 1280/1920 sem rolagem, segundo clique, variáveis `%IX0.7`/`%QX0.7` com GPIO 33/13 no mapa, alternância de tema, divisor e recolher, compilação real de `blink.st` (70 s, imagens no console) e ST inválido com diagnóstico no console e no painel de erro

**Pendências registradas na #23**
- ~~Suíte `slow` falha com `--user` não-root~~ — **resolvido em 2026-09-21/23** (`chmod 0777` no `ESP_BUILD_ROOT` no `Dockerfile`; ver retomada da rodada de fechamento)
- ~~`ruff format` em 3 arquivos de teste do back-end~~ — **resolvido na mesma rodada** nos arquivos tocados

**Concluído — #24: degrau responsivo, variáveis por pino, ícones e ramo paralelo (plano §14, D-14, 2026-09-17)**
- Degrau ocupa a largura do contêiner e acompanha redimensionamento e painel recolhido (célula mínima 56 px)
- Variáveis: escolha explícita Entrada | Saída | Memória ("interna" virou "Memória"); pino exibido como `GPIO n` com endereço discreto, edição por botão; filtro com Memórias; mapa de pinos em duas tabelas (Entradas/Saídas: Endereço, GPIO, Variável); painel com área rolável única
- Header com ícones `lucide-react` (dependência nova, ISC, em `THIRD_PARTY.md`) e sem MATIEC/toolchain; console registra uma linha por ferramenta na abertura
- Paleta sem rótulo e sem SVG duplicado, com item **Ramo** e lixeira com ícone
- **Ramo paralelo** (antecipado da #15): criar por arrasto, esticar/encolher pela alça (ponteiro e teclado), marcar e remover; ramo vazio é `rung_incompleto`; contato de selo construível pela UI
- Verificação: `tsc` limpo, 344 testes vitest, `vite build`, depósito ok; Chromium com back-end real: degrau em 1024/1440/1920 e com painel recolhido, console na abertura, criação de Memória, seletor por GPIO, **contato de selo montado com mouse real** (ramo, contato no ramo, alça até coluna 3 e de volta), temas e mapa. Revisão visual pegou pino duplicado e mapa cobrindo a lista — corrigidos

**Concluído — Fatias 2 e 3 (#9–#14, plano §15, D-15, 2026-09-17)**
- Núcleo: `inserirDegrau`/`removerDegrau` (último degrau não sai); `bobina_duplicada` (erro, uma por bobina) e `set_reset_autodependente` (aviso; "caminho" = degrau inteiro, leitura mais abrangente registrada em D-15); `persistencia.ts` com envelope `{ versao: 1 }`, descarte com aviso e falha de gravação sem exceção
- Editor: inserir degrau abaixo/no fim e remover pelo cabeçalho; selo de problema na célula (círculo = erro, triângulo = aviso, com `aria-label`) e no cabeçalho do degrau; prop `foco` por token
- IDE: diagrama carregado e salvo em `localStorage`, avisos no Console; `validarDiagrama` no `App`; painel inferior com abas **Problemas (N)** e Console; clicar no problema volta à aba Ladder e foca a célula
- **#14:** `bash frontend/e2e/rodar.sh` (Playwright 1.55.0 em contêiner, `--network none`, sem porta publicada): `IO_ESPELHO` montado com mouse real sobrevive ao reload; `localStorage` corrompido abre vazio com aviso (CA-8). `@playwright/test` em `THIRD_PARTY.md`; `frontend/e2e/` fora do depósito e fora do vitest
- Depósito: `persistencia.ts` e `ListaProblemas.tsx` em `REQUIRED_FILES`; `--verificar` ok
- Verificação: `tsc` limpo, 410 testes vitest, `vite build` (JS 422 kB / 129 kB gzip), pytest `not slow` 63 passed, e2e 2 passed; Chromium com mouse real: dois degraus, bobina duplicada marcada nas duas células e listada, clique no problema a partir da aba ST foca a célula certa, contato movido do degrau 2 ao 1, remover degrau limpa a duplicada, recusa do último degrau visível

**Concluído — #25: ajustes de UX do autor (plano §16, D-16, 2026-09-17)**
- Degrau vazio (sem elemento nem ramo) não gera problema; IDE limpa abre no Console com "Problemas (0)"; diagrama salvo com erro abre em Problemas (aviso não muda a aba); preferência da aba inferior removida
- Nenhum texto dentro do editor: recusa de ação vai à nova `BarraStatus` (rodapé, some em 6 s) e ao Console via `aoRecusar`; problemas só na aba; no degrau ficam ícones e prévia vermelha, com texto no nome acessível. A prévia da alça não reporta recusa a cada movimento — só ao soltar (achado na revisão)
- Escada contínua: sem cartão por degrau, trilhos emendados, número e ações na calha. Revisão visual pegou vão entre os trilhos (espaçamento entre blocos e SVG *inline*) — corrigido
- `celulaDeSoltura`: bobina solta em qualquer célula do degrau, inclusive linha de ramo, vai para a coluna 8; núcleo continua estrito
- Verificação: `tsc` limpo, 435 testes vitest, e2e 2 passed, depósito ok; Chromium com mouse real: IDE limpa no Console, 3 degraus, bobina na coluna 2 e no ramo indo para a coluna 8, recusa por coluna ocupada na barra de status e no Console sem `role="alert"`, temas claro e escuro, reload de diagrama com erro abrindo em Problemas

**Concluído — #26: projeto de linguagem única e IDE reorganizada (plano §17, D-17, 2026-09-17)**
- **Projeto** (`frontend/src/projeto/projeto.ts`, autoral): `{ versao, titulo, linguagem: 'ld'|'st', diagrama|fonte }` em `ladderflow:projeto`; a IDE reabre o último projeto e **migra** `ladderflow:diagrama` (remove a chave antiga só depois de gravar a nova); corrompido abre vazio com aviso
- **Novo projeto:** confirmação de descarte só quando há conteúdo, depois título (1–60) e linguagem em modal acessível; esqueleto ST **verificado no `iec2c` real** (exit 0) — o MATIEC recusa `VAR` vazio e corpo vazio, então o esqueleto traz uma variável e uma instrução de exemplo
- **Cabeçalho em duas faixas:** Novo projeto, título + chip LD/ST, Compilar, Gravar, painel, tema; abaixo, abas **Lógica** e **Variáveis** (esta só em projeto Ladder). Em Ladder, Compilar e Gravar ficam desabilitados com o motivo ("depende da F8")
- **Variáveis** em tabela de largura inteira (Nome | Tipo | Uso | Pino | Valor, linha "Adicionar variável" fixa, mapa de pinos recolhível); painel lateral e suas preferências removidos
- **Painel inferior:** Problemas | **Mensagens** (recusas, com contador de não lidas que zera ao abrir) | Console; `BarraStatus` removida. A marca vermelha da célula recusada passa a sumir em 3 s (achado na verificação: sem texto ao lado, marca parada era lida como estado)
- Verificação: `tsc` limpo, 499 testes vitest, e2e 4 cenários (LD com reload, criação de ST, corrompido, migração), depósito ok com `projeto/projeto.ts` no manifesto; Chromium com mouse real nos dois temas: cabeçalho, Lógica ↔ Variáveis, recusa em Mensagens com contador, Compilar desabilitado com motivo, fluxo de novo projeto com e sem conteúdo, foco devolvido ao botão

**Pendências e limitações registradas**
- **Limitação conhecida (D-15):** `set_reset_autodependente` usa o degrau inteiro como "caminho"; com ramo paralelo o aviso fica conservador demais em alguns casos. Reavaliar depois da fatia 4
- Diagrama salvo descartado é sobrescrito na primeira gravação (o aviso já foi dado; não há cópia do conteúdo corrompido)
- **Um projeto por vez:** não há biblioteca de projetos, nem abrir/salvar arquivo — "Novo projeto" substitui o atual. Fora do escopo da spec 002
- ~~Compilar e Gravar seguem indisponíveis em projeto Ladder até a **F8** existir~~ — resolvido em 2026-09-18 pela spec 003 (F8 ✅)
- Ramos de linhas diferentes que se cruzam ou aninham: o conector vertical da linha 2 atravessa o traço da linha 1 e pode ser lido como junção, embora o ramo ligue só ao trilho principal (semântica fixada em D-1 do plano 003 e testada). É pendência de **desenho** do editor, levantada no plano 003
- `carregarDiagrama` confere só a forma de degraus e variáveis, não cada elemento

**Concluído — revisão pós-#26: painel de variáveis volta a ser lateral (2026-09-18)**
- O autor testou a sub-aba "Variáveis" de largura inteira (#26) e pediu de volta o painel lateral recolhível/redimensionável (18–40rem) que existia antes — `PainelLateral.tsx` restaurada (era removida em `dc0bb6e`), `BarraSuperior` perde as sub-abas Lógica/Variáveis e ganha de volta o alternador "Alternar painel de variáveis" (só em projeto Ladder); `AreaEditor` volta a mostrar só o `EditorLadder`, com `PainelVariaveis` como irmão dele em `App`, não mais uma sub-aba
- **Achado na verificação em Chromium real:** a tabela de variáveis (redesenhada na #26, com coluna "Uso" e mapa de pinos) não cabia na largura do painel lateral — o seletor de classe (`SeletorClasse`, 3 botões) vazava da própria célula e cobria o `<select>` de Pino ao lado, interceptando o clique; ganhou `flex-wrap`. A tabela também ganhou `min-w-[600px]` com rolagem horizontal própria (`overflow-auto`), porque as seis colunas espremidas em ~288–320px escondiam o pino (`GPIO n · %IX0.n`) de forma ilegível — nenhum teste `vitest` pegou isso, só o arrasto real no Chromium (mesma lição da tarefa #22)
- Pedido à parte, no mesmo giro: removido o preenchimento cinza (`fill-ide-elevado`) que destacava sozinha a coluna terminal (onde a bobina fica) — `classeRetangulo`/`strokeDasharray` deixam de tratar `ehTerminal` como caso especial; a célula da bobina agora usa a mesma linha tracejada e fundo transparente das outras colunas
- Verificação: `tsc` limpo, 499 testes vitest, e2e 3 passed (Chromium real: IO_ESPELHO montado com painel lateral, seletor de classe sem sobrepor o pino, "Novo projeto" some com o painel em projeto ST), depósito ok (`PainelLateral.tsx` volta ao manifesto)

**Concluído — #27: recusas em toasts, aba Mensagens removida (plano §18, D-18, 2026-09-18)**
- O autor concluiu que, na aba Mensagens, o usuário não percebia em tempo real por que uma ação não surtia efeito. As recusas do editor e do painel de variáveis passam a aparecer como **toasts**, no canto superior esquerdo, logo abaixo do cabeçalho. A primeira versão ficava no canto inferior direito e foi movida a pedido do autor no mesmo dia.
- Só as recusas viram toast. O **Console não muda** e nada dele vira toast (decisão explícita do autor).
- O componente é próprio (`lib/toasts.ts` puro + `components/ide/Toasts.tsx`), sem dependência nova:
  - níveis `info | sucesso | aviso | erro`;
  - aviso some em 5 s, com pausa sob o cursor ou com foco, e retoma do tempo restante. Erro fica até ser fechado;
  - repetição seguida não empilha, só reinicia o tempo. A pilha tem no máximo 3;
  - `aria-live="polite"`.
- O painel inferior fica com **Problemas | Console**. `ListaMensagens.tsx` e o contador de não lidas saem. A marca vermelha de 3 s na célula recusada continua.
- É a opção "toast" que o autor tinha avaliado e preterido na #25, retomada depois da experiência com a barra de status (#25) e com a aba (#26).
- **Verificação:** `tsc` limpo, 587 testes vitest, build, e2e 5 passed (com um cenário novo de recusa → toast com mouse real), depósito ok. No Chromium, conferido nos dois temas, e o toast some sozinho.

**Concluído — Fatia 4 (#15–#20, plano §19/D-19, 2026-09-19)**

Rodada feita em levas de subagentes sonnet: o orquestrador trocou o contrato,
depois N ∥ S, depois D ∥ T.

**Contrato**
- `Elemento = ElementoSimples | ElementoCtu`, com `ehTerminal`, `ehCtu` e
  `variavelDoElemento` em `modelo.ts`.
- Dois ajustes ao §5 do plano, registrados em D-19:
  - `instancia` é gerada (`ctu0`…) e não é editável;
  - `vincularVariavel` num CTU grava `saida`.

**Núcleo (`ladder/ctu.ts`, novo, destacável — Q-7)**
- Criação, com a linha de reset na primeira linha extra livre.
- Contatos da linha de reset e remoção em cascata (CA-7).
- Mover entre degraus levando o reset.
- `criarRamo` pula a linha de reset. Quando o ramo cairia abaixo dela, **troca**: o ramo sobe e o reset desce com seus contatos.
  - Achado na verificação visual: o conector vertical do ramo cruzava a linha de reset, e isso se lia como junção.
- Validação:
  - saída nula, inexistente ou de entrada;
  - saída do CTU conta como escrita simples em `bobina_duplicada`;
  - código novo `ctu_limite_invalido` (PV 1–32767).
- Os pontos de extensão foram listados pela frente N. É a verificação de destacabilidade da #16.

**Editor**
- Paleta com Bobina SET, Bobina RESET e Contador.
- Bobinas com "S"/"R".
- `SimboloCtu.tsx` (novo): caixa com fundo opaco da linha 0 até a linha de reset, CU/R, PV e Q → saída.
- Linha de reset desenhada como traço reto do trilho até R, sem conector que sugira junção. As células têm `aria-label` "reset do contador".
- Modal do CTU com o campo "Limite (PV)".
- **CA-3:** `BLINK` montado inteiro pela UI, igual à fixture e sem problemas.
- **CA-10:** recusa do limite de linhas.
- Desempenho: **50 degraus em ~141 ms** (plano §6).

**#17 substituída (D-19)**
- `blink_ladder.st` não foi criado. O `BLINK` **serializado** é executado contra `blink.st`, com **0 divergências** em 200 ciclos × 3 padrões (ver F8).

**Depósito (#19)**
- `modelo.ts`, `enderecos.ts`, `validacao.ts`, `edicao.ts`, `ctu.ts`, `EditorLadder.tsx` e `SimboloCtu.tsx` em `REQUIRED_FILES`.

**Verificação**
- `tsc` limpo, **717 testes vitest**, `vite build` (JS 456 kB / 139 kB gzip).
- pytest `not slow` com 76 passed.
- e2e 6 passed; o novo é `blink.spec.ts`: `BLINK` carregado, linha de reset visível, `.st` baixado e `source` iguais byte a byte ao dourado.
- `--verificar` ok.
- Chromium com back-end real (rede `--internal`, sem porta publicada):
  - CTU, contato no reset, ramo com troca de linha, recusa da 3ª linha em toast e SET, tudo com mouse real;
  - `BLINK` nos dois temas e modal do contador;
  - **`BLINK` compilado de verdade**, com 3 imagens (`0x1000`/`0x8000`/`0x10000`), 70 s em build frio e 13 s incremental, e Gravar habilitado.

**Limitações registradas**
- Se a troca de linhas é impossível (linha abaixo ocupada em outra coluna), o ramo pode ficar abaixo do reset e o cruzamento visual volta. É raro: por exemplo, um ramo que ficou sozinho na linha 2 depois de o da linha 1 ser removido, e um CTU que chega ao degrau depois disso. Faz parte da pendência de desenho dos ramos cruzados, e a semântica não muda.
- O nome da instância não é editável.

> **Adiada por decisão do autor (2026-09-17).** A Fatia 4 sai da frente da fila e
> a **F8 entra antes**. Razão: o editor já constrói e valida diagramas, mas
> Compilar e Gravar seguem desabilitados em projeto Ladder — a Fatia 4
> acrescenta elementos ao editor sem mover essa agulha, enquanto a F8 fecha o
> caminho editar → serializar → compilar → gravar. Consequência registrada: a
> **#17** (`blink_ladder.st` escrito à mão) perde o motivo de existir, porque o
> ST deixa de ser escrito por uma pessoa e passa a sair do serializador — é
> exatamente o elo manual que o plano 002 registrou como risco em D-8/R-1. A
> tarefa não é apagada; será revista quando a Fatia 4 for retomada, já com o
> serializador disponível. O CTU (#16) continua sendo pré-requisito para
> estender o serializador a contadores.
>
> **Atualização (2026-09-18), com a F8 pronta.** A R-1 do plano 002 está
> quitada: `backend/tests/test_serializador_diferencial.py` executa no runtime
> o ST que o serializador gera. Ao retomar a Fatia 4, a #17 deve ser reescrita
> como "`BLINK` serializado × `blink.st`, pelo mesmo teste diferencial", e o
> `blink_ladder.st` escrito à mão sai de cena. Isso depende da #16 (CTU no
> modelo) e da extensão do serializador para CTU (trabalho novo, fora da
> spec 003).

---

## F8 — Serializador Ladder → ST ✅

**Camada:** navegador · **Autoral:** sim

Percorre a grade e produz texto ST conforme a IEC 61131-3. Pequeno em linhas, central em importância — é a tradução que dá sentido à arquitetura inteira.

**Ferramentas:** nenhuma. TypeScript puro.

**Spec 003 concluída (2026-09-18):** [`spec.md`](../docs/specs/003-serializador-ladder-st/spec.md), [`plan.md`](../docs/specs/003-serializador-ladder-st/plan.md) e [`tasks.md`](../docs/specs/003-serializador-ladder-st/tasks.md), com as 10 tarefas feitas. Spec aprovada com Q-1 a Q-6 decididas e revisão aditiva do RF-5; plano aprovado; as duas fatias foram implementadas no mesmo dia. **Fecha o segundo caminho fim-a-fim: editar Ladder → serializar → compilar → gravar** (a gravação física segue bloqueada por falta de hardware, como em toda a F5).

**Destravada.** Deixou de estar 🔒: o modelo de dados que ela consome (`frontend/src/ladder/modelo.ts`) já tem os cinco tipos de elemento — contato NA/NF, bobina simples, bobina SET, bobina RESET — e o ramo paralelo, desde as fatias 1–3 da spec 002. A dependência é sobre o **modelo**, não sobre a interface que o constrói; por isso a F8 não espera a Fatia 4.

**Escopo da spec 003**
- Traduz o subconjunto acima; **CTU fica fora** — não existe no modelo ainda (entra na #16 da spec 002), e a extensão do serializador para contadores é trabalho novo, não dívida desta spec. *(Revisto em 2026-09-19: o CTU entrou por revisão aditiva, com RF-13, CA-10 e D-13 — ver "Concluído — CTU serializado" abaixo.)*
- Habilita Compilar e Gravar em projeto Ladder, fechando a pendência da revisão aditiva da Q-2 da spec 002
- Reusa o serviço de compilação da spec 001 sem mudar contrato; a serialização roda inteiramente no navegador
- 12 RF e 9 CA; CA-1 a CA-4 **medidos** pelo arcabouço diferencial (`backend/tests/diferencial/`) contra o compilador e o runtime reais

**Por que importa para o TCC:** quita a ressalva R-1 do plano 002. Até aqui a equivalência diagrama ↔ ST era **assumida** — o único ST de referência foi escrito à mão, provando que aquele texto se comporta como o `blink.st`, nunca que o diagrama produz aquele texto. A partir da F8 o texto comparado é o que a serialização realmente gera: suposição de projeto vira número medido.

**Decisões da spec 003 (2026-09-18, §9 da spec):**
- **Q-1:** ST gerado visível, somente leitura, atualizado a cada edição.
- **Q-2:** erro de validação recusa na tela. Compilar fica indisponível com o motivo, nada vai ao servidor, e avisos não bloqueiam.
- **Q-3:** rastreio por degrau, com mapa degrau → linhas e comentário por degrau no texto.
- **Q-4:** nomes e intervalo fixos (`prog0`/`Config0`/`Res0`/`task0`, `T#20ms`, como `minimal.st`).
- **Q-5:** SET/RESET em ordem dos degraus, e vence a última escrita do ciclo.
- **Q-6:** degrau vazio é omitido, e diagrama sem elemento é "nada a compilar".

CA-4, CA-7 e CA-8 ganharam uma revisão aditiva que os liga às decisões.

**Plano em revisão (2026-09-18):** [`plan.md`](../docs/specs/003-serializador-ladder-st/plan.md), com D-1 a D-11 e duas fatias.
- **Núcleo:** puro, em `frontend/src/ladder/serializador.ts`.
- **Topologia (D-1):** o degrau é lido como circuito de nós, com redução série-paralelo. Ramos cruzados usam fallback por nó. O ramo liga só ao trilho principal.
- **Arquivos dourados (D-11):** gerados pelo vitest com `toMatchFileSnapshot` e executados pelo pytest diferencial. Quitam a R-1.
- **Recusas (D-5):** palavra reservada da IEC e nomes que diferem só em maiúsculas. É regra nova no cliente, registrada como tensão no §9 do plano.
- **Fatias:**
  - S6a (núcleo medido: CA-1 a CA-4, CA-6, CA-8, CA-9);
  - S6b (IDE: CA-5, CA-7, aba ST gerado, rastreio por degrau).
- **Risco novo:** ramos de linhas diferentes que se cruzam são desenhados de forma ambígua no editor (pendência de desenho da spec 002).

**Aprovação (2026-09-18).** O autor aprovou o plano e liberou `/tarefas` e `/implementar` das duas fatias na mesma decisão. Também decidiu registrar as recusas de D-5 como **revisão aditiva do RF-5** na spec. `tasks.md` escrito com 10 tarefas e as frentes N, B, P e T.

**Concluído — Fatia 1 / S6a, núcleo medido (#1–#6, 2026-09-18)**
- **`frontend/src/ladder/serializador.ts`:**
  - `serializar` implementa D-1 a D-8, com a redução série-paralelo e o fallback por nó;
  - a ordem dos operandos segue uma chave de origem (coluna, linha) propagada pelas fusões. Achado da frente N: sem ela, `a OR b` poderia sair `b OR a` conforme o caminho da redução;
  - `degrauDaLinha` para o rastreio Q-3.
- **Testes do serializador:** 39 no vitest. A topologia (simples, aninhada, cruzada, lacuna) é conferida por **tabela-verdade completa** contra uma enumeração de caminhos. Cobrem também as recusas D-5, os vazios, o determinismo, ASCII, CA-9 e o pior caso.
- **Fixtures e arquivos dourados:** `RAMO_OU`, `SET_RESET` e `SELO` em `fixtures.ts`. Os 5 arquivos dourados em `backend/tests/fixtures/serializados/` foram **gerados pelo vitest** (`toMatchFileSnapshot`) e todos compilam no `iec2c` real.
- **Teste diferencial:** `test_serializador_diferencial.py` roda os dourados no `plc_host_runner`, **executando de verdade** (o binário é compilado sob demanda na imagem), com **0 divergências**:
  - io_espelho, minimal, ramo_ou, set_reset (inclusive o ciclo de coincidência, em que vence o RESET do degrau de baixo) e selo, contra os gabaritos TOML;
  - io_espelho e minimal também contra a execução do ST de referência da spec 001.
  - **É a medição que quita a R-1 do plano 002**: o ST medido passa a ser o que o serializador gera.
- **Organização dos TOMLs:** os novos ficam em `diferencial/fixtures/serializador/`, fora do glob de `test_diferencial.py`, que usa o diretório de ST antigo.
- **Código de problema:** `CodigoProblema` ganhou `erro_compilacao`, só o tipo.
- **Depósito:** `serializador.ts` em `REQUIRED_FILES`.
- **Verificação:** `tsc` limpo, 548 testes vitest (inclui a aba da #7, ainda não integrada), pytest `not slow` com 72 passed, `--verificar` ok.

**Concluído — Fatia 2 / S6b, IDE (#7–#10, 2026-09-18)**
- **Aba "ST gerado"** (`components/ide/VisualizacaoST.tsx` + `PainelInferiorConteudo`), só em projeto LD:
  - `<pre>` somente leitura, com a numeração de linha fora da seleção;
  - recusa ou vazio aparecem como motivo, sem `role="alert"`.
- **`App.tsx`:**
  - `serializar` em `useMemo`;
  - portão D-6, que usa só os erros de validação. Os de compilação não travam o botão;
  - Compilar em LD pelo **mesmo** `compilarPacote`;
  - diagnósticos do `iec2c` viram problemas `erro_compilacao` com o degrau (Q-3), limpos a cada edição ou compilação. A aba Problemas abre quando algum aponta para um degrau.
- **e2e** `frontend/e2e/compilar.spec.ts`: IO_ESPELHO montado pela UI, com `source` enviado a `/compile/pacote` **idêntico, byte a byte**, ao arquivo dourado `io_espelho.st`.
- **Verificação:** `tsc` limpo, 553 testes vitest, `vite build` (JS 442 kB / 135 kB gzip), e2e 4 passed, pytest `not slow` 72 passed, `--verificar` ok.
- **Chromium com back-end real** (rede Docker `--internal`, sem porta publicada):
  - diagrama com erro → Compilar desabilitado com "1 problema no diagrama — ver aba Problemas";
  - diagrama vazio → "Nada a compilar";
  - **IO_ESPELHO compilado de verdade** (60,4 s em build frio) e **SELO** (11,3 s incremental), cada um com as 3 imagens (`0x1000`/`0x8000`/`0x10000`) e Gravar habilitado;
  - aba ST gerado conferida visualmente com o SELO.
- **Não verificado:** gravação em ESP32 físico (sem hardware, como em toda a F5).

**Concluído — revisão pós-F8: download no lugar da aba "ST gerado" (#11, plano D-12, 2026-09-18)**
- O autor concluiu, usando a ferramenta, que ver o ST intermediário não ajuda o usuário. **Revisão aditiva da Q-1**: a aba "ST gerado" sai, e `VisualizacaoST.tsx` é removido.
- Botão **Baixar** no cabeçalho, entre Compilar e Gravar (`MenuDownload.tsx`, menu acessível):
  - **Ladder (.json)**, só em projeto LD: o envelope do projeto, no formato de `salvarProjeto`;
  - **Structured Text (.st)**: o texto serializado em LD, ou a fonte em projeto ST.
- Em LD, a opção .st fica desabilitada com o mesmo motivo do Compilar (erro, vazio ou recusa). O nome do arquivo vem do título (`lib/download.ts`), e o download é feito no cliente, sem servidor. Cada download registra uma linha no Console.
- **Verificação:** o e2e baixa o .st de IO_ESPELHO montado pela UI e confere **byte a byte** contra o arquivo dourado. No Chromium, o menu foi conferido nos dois temas, com o .st desabilitado e o motivo "Nada a compilar".

**Concluído — CTU serializado (revisão aditiva: RF-13, CA-10, plano D-13, tarefa #12; 2026-09-19)**
- **Decisão do autor nesta rodada:** estender o serializador ao contador na mesma rodada da Fatia 4 da spec 002. É revisão aditiva datada da spec, com o §7 anotado.
- **Emissão:**
  - `ctuN(CU := <expr>, R := <reset>, PV := n);` e depois `saida := ctuN.Q;`;
  - CU é a mesma redução D-1 da linha 0 com ramos;
  - R é o AND dos contatos da linha de reset, ou `FALSE`;
  - os contatos do reset nunca vazam para CU (provado em teste).
- **Declaração e recusas:** `ctuN : CTU;` vai no `VAR` interno. A instância passa pelas recusas D-5, e há recusa de PV fora de 1–32767.
- **Fixture `BLINK`** (variante K do spike, 8 degraus). O dourado `blink.st` foi **gerado pelo vitest** e tem a mesma sequência de instruções da variante K.
- **Diferencial (`test_serializador_diferencial.py`):**
  - o `BLINK` serializado bate com `blink.toml`;
  - contra a **execução de `blink.st`** da spec 001, foram 200 ciclos × 3 padrões (sempre 0; pulso no 60; pressionado 45–55), com **0 divergências**, executando de verdade no `plc_host_runner`.
  - **O CA-3 da spec 002 (Q-4 revisada, equivalência exata) passa a ser medido, não assumido.** Nenhum ST de referência do pisca-pisca foi escrito por uma pessoa.

---

## F9 — Simulador de ciclo de varredura ✅

**Camada:** navegador · **Autoral:** sim

Executa a lógica no navegador antes da gravação, seguindo a semântica da norma: lê entradas → resolve todos os rungs → escreve saídas → repete.

**Ferramentas:** nenhuma no produto. TypeScript puro. (No **ambiente de teste** do back-end entraram `node` e o binário nativo do `esbuild` — ver Q-8 abaixo e `THIRD_PARTY.md`.)

**Spec 004 concluída (2026-09-21):** [`spec.md`](../docs/specs/004-simulador-varredura/spec.md), [`plan.md`](../docs/specs/004-simulador-varredura/plan.md) e [`tasks.md`](../docs/specs/004-simulador-varredura/tasks.md). Spec aprovada em 2026-09-20 com Q-1 a Q-8 decididas; plano e tarefas liberados na mesma decisão; as duas fatias implementadas no dia seguinte. **É a última feature de código do projeto.**

**Escopo entregue:** contato NA, contato NF, bobina simples, bobina SET, bobina RESET, ramo paralelo e **contador crescente (CTU)** — o mesmo subconjunto do editor e do serializador. O CTU não ficou de fora: sem ele o `BLINK` não simularia, e o `BLINK` é o programa cuja equivalência exata foi medida na Fatia 4.

### Decisões da spec 004 (2026-09-20, §9 da spec)

- **Q-1:** tempo real a 20 ms/ciclo como padrão, com marcha lenta selecionável. Cadência de ciclo separada da cadência de quadro.
- **Q-2:** Executar/Pausar, Passo e Reiniciar.
- **Q-3:** só acionamento manual; sequência pré-definida na interface fica como extensão futura (já existe onde importa, nos TOMLs do arcabouço).
- **Q-4:** energizado por **cor e espessura** (codificação redundante); selo de problema no canto, energização no traço.
- **Q-5:** estado da simulação volátil.
- **Q-6:** projeto ST fora do escopo, com o controle desabilitado e o motivo visível.
- **Q-7:** modo exclusivo — a simulação congela a edição e desabilita Compilar/Gravar.
- **Q-8:** o segundo executor roda como **processo de verdade** (`node` na imagem de teste + empacotamento sob demanda pelo `esbuild`), e não como traço gravado. Razão registrada pelo autor: traço gravado é artefato congelado que pode divergir do código sem ninguém notar — a mesma classe de falha do `ESP_PROJECT_TEMPLATE` que motivou a Regra 5, e reintroduzi-la justamente no instrumento que produz a métrica central seria contraditório. O plano B (traço, com guarda de sequência) ficou registrado e **não foi necessário**.

### RF-7 — a proibição que sustenta a medição

O simulador calcula a energização por **propagação de fluxo da esquerda para a direita**, leitura própria e independente da topologia do degrau. É **proibido** reaproveitar a redução série-paralelo do serializador. A razão está na spec como requisito de primeira ordem, não como observação de plano: o runtime em C executa o texto que o serializador produz, e a medição compara os dois. Se as duas leituras da topologia fossem a mesma, um erro apareceria idêntico nos dois lados, a comparação mediria zero divergências e o instrumento diria "de acordo" sem ter medido nada. **A duplicação é o instrumento.** Registrada como tensão deliberada contra o §11 da Constituição, para sobreviver a uma futura refatoração bem-intencionada.

### Concluído — Fatia 1: o motor medido (#1–#9, 2026-09-21)

- **`frontend/src/ladder/simulacao.ts`** (núcleo puro, sem React, SVG, relógio, `localStorage` ou pinagem): propagação de fluxo por nós; imagem de processo explícita (entrada lida uma vez por ciclo, acionamento só vale no ciclo seguinte); escrita de um degrau visível para os seguintes no mesmo ciclo; SET/RESET com a última escrita do ciclo vencendo; CTU com reset precedendo a borda de subida; energização devolvida por **nó, célula e elemento**, que é o que o desenho consome.
- **`frontend/src/ladder/simulacao-cli.ts`**: o mesmo motor sem interface, falando **exatamente** o contrato de `docs/validacao/contrato-runtime-host.md` (stdin `%IX0.0=1`, stdout `ciclo=N %QX0.0=1`, endereço IEC e nunca GPIO).
- **`backend/tests/diferencial/executores.py`**: `SimuladorExecutor`, alteração **aditiva**. Resolução em três vias como o `HostRunnerExecutor`; empacotamento sob demanda em diretório temporário **fora do repositório** (mesma restrição do `OUT_DIR` do runtime em C, que o `build-deposito.sh` cobra); diagrama irmão resolvido pelo nome do `.st`, com falha alta e motivo se faltar — nunca pulo silencioso.
- **Diagramas de referência** (`backend/tests/fixtures/diagramas/*.json`) gerados pelo vitest por `toMatchFileSnapshot`, como os `.st` dourados: nunca escritos à mão.
- **`backend/Dockerfile`**: camada com `node` (v18.19.1). Imagem 7,33 → **7,39 GB** (+60 MB). Node.js e esbuild identificados em `THIRD_PARTY.md` como ferramenta externa em processo separado, só em teste.

**A medição (CA-1 a CA-3), `backend/tests/test_simulacao_diferencial.py`:**
- os 5 cenários sem contador (`io_espelho`, `minimal`, `ramo_ou`, `set_reset`, `selo`) contra os gabaritos TOML **já existentes, sem alterar nenhuma fixture**;
- **`BLINK` simulado × `blink.st` executado de verdade no `plc_host_runner`**, 200 ciclos × 3 padrões (sempre 0; pulso no 60; pressionado 45–55): **0 divergências**. O ST comparado é o **de referência da spec 001**, não o dourado do serializador — a comparação atravessa as duas implementações inteiras.
- **Controle negativo feito pelo orquestrador:** com o PV do `blink.json` alterado de 12 para 13, o instrumento acusou **57 divergências**, a primeira em `ciclo=25 ponto=%QX0.0 esperado=True obtido=False`; restaurado, voltou a 9 passed. "9 passed" sozinho não prova que mediu — este controle prova.
- **Cadência (CA-11):** 50 degraus × 2000 ciclos em **~243 ms (~0,12 ms/ciclo)**, ~165× de folga sobre o orçamento de 20 ms.

### Concluído — Fatia 2: a simulação na ferramenta (#10–#14, 2026-09-21)

- **Desenho:** token `--ide-energizado` nos dois temas (`#c2410c` claro, `#ff9248` escuro), sempre acompanhado de aumento de espessura — cor e espessura decididas como **par único**, nunca em lugares diferentes. O fio da linha 0 passou a ser um segmento por célula, para mostrar **onde** a energia para no meio do degrau. `SeloProblema` intocado. Prop ausente = desenho byte a byte igual ao anterior (conferido por teste).
- **IDE:** faixa `BarraSimulacao` acima do editor — Simular/Sair, Executar/Pausar, Passo, Reiniciar, marcha (tempo real 20 ms, lenta 500 ms) e ciclo na faixa; controles visíveis sempre, desabilitados fora da simulação. Relógio em `requestAnimationFrame` com N ciclos por quadro, teto de 10 ciclos/quadro e **um único** `setState` por quadro. Modo exclusivo: edição congelada, Compilar/Gravar/`.st` desabilitados com o motivo. Portão de erro de validação reusando o do Compilar. Em projeto ST, "Simulação disponível apenas em projeto Ladder".
- **Variáveis:** a coluna "Valor", reservada desde a #23 justamente para isto, passou a mostrar o estado ao vivo; variável de **entrada** vira `role="switch"` acionável, saída e memória continuam só leitura (checado no componente, não confiado a quem chama). "Ciclo N" no cabeçalho do painel.

### Verificação

- `tsc` limpo, **799 testes vitest** (eram 717), `vite build` (JS 469 kB / 143 kB gzip).
- pytest `not slow` **85 passed** (eram 76); `test_simulacao_diferencial.py` 9 passed.
- e2e **10 cenários** (6 antigos + 4 novos em `simular.spec.ts`: CA-4, CA-5, CA-8, CA-13), sem intermitência — o avanço de ciclos é feito por Passo até a contagem exibida, nunca por tempo de parede.
- `build-deposito.sh --verificar` ok, com `simulacao.ts` e `simulacao-cli.ts` no manifesto.
- **Chromium real, nos dois temas, pelo orquestrador:** `IO_ESPELHO` energizando ao acionar a entrada, `BLINK` rodando até o ciclo 50 com o CTU e as linhas CU/R energizadas, projeto ST com Simular desabilitado e o motivo.

### Achado da verificação visual (corrigido)

O fio da **célula terminal** era desenhado desenergizado atravessando a bobina energizada — a mesma célula mostrava dois estados contraditórios, e a leitura que saía era "a energia para antes da bobina". Causa: o desenho usava `celulas` (definida como "entra energizado **e** conduz"), e uma bobina é carga, não conduz para a direita. **O núcleo não foi tocado** — está medido contra o runtime e não se ajusta por questão de desenho; a correção foi do desenho, que na célula terminal passou a seguir a energização do próprio terminal. Regra fixada junto: trilho esquerdo energizado (é o vivo), trilho direito em `stroke-ide-trilho` (é o neutro). Teste novo que falha sem a correção. **Nenhum teste em jsdom pegava isso** — é a quarta rodada em que a verificação no navegador acha o que a suíte não acha.

### Pendências e limitações registradas

- **Marcha lenta em 500 ms/ciclo** foi escolhida sem validação com o autor; a spec só exigia "ao menos uma". Registrada como **Q-9** em "Decisões em aberto".
- **Achado técnico:** `declare module 'node:fs'` não funciona sem `@types/node` (o TypeScript o trata como *augmentation* de um módulo inexistente, TS2664). O shim usa `import()` com especificador não-literal. Nenhuma dependência nova entrou.

**Fechado na retomada da rodada de fechamento (2026-09-23, stash de 2026-09-21):**
- **CA-8 / affordance do congelamento:** paleta esmaecida e inerte sem `pointer-events-none` (preserva `preventDefault`); grade com `cursor-not-allowed`; toast ao insistir pela grade/teclado; seleção do documento limpa ao entrar/sair da simulação; e2e CA-8 com controle negativo. Destaque do modo simulação na `BarraSimulacao` — **sem** chip SIMULANDO na barra superior (decisão do autor na retomada).
- **Coluna "Valor"** imediatamente após **Nome** (RF-13, revisão 2026-09-21).
- **`Passo` em rajada:** `aoPassoSimulacao` com `setSimulacao` funcional (inclui passo da planta do ambiente); teste em `App.test.tsx`.
- **`IO_ESPELHO_8`:** fixture dos 16 pinos em `fixtures.ts`, dourados e diferencial `io_espelho_8` no pytest.
- **Dívida técnica triada:** `chmod 0777` no `ESP_BUILD_ROOT` no `Dockerfile` — suíte completa como não-root; `ruff format` nos arquivos tocados.
- **Tabela na simulação** já estava fechada em 2026-09-23 (`simulacaoAtiva`); limitação §10 de `docs/limitacoes-declaradas.md` revogada.

## F11 — Ambientes de simulação ✅

**Camada:** navegador · **Autoral:** sim · **Spec:** [`docs/specs/005-ambientes-simulacao/spec.md`](../docs/specs/005-ambientes-simulacao/spec.md) (aprovada 2026-09-21)

Planta visual acoplada ao ciclo de varredura (F9): um passo de física por `executarCiclo`, vínculo por endereço `%IX`/`%QX`, painel lateral direito na IDE (substitui variáveis enquanto aberto). Primeiro ambiente: **Portão** (`id: portao`; reimplementação autoral do cenário Java do autor — §11 da spec).

**Concluído**
- Núcleo `frontend/src/ambientes/` (`contrato`, `portao`, `catalogo`, `vinculo`, `integracao`) + testes vitest
- UI: `ModalAmbiente` → `PainelAmbiente` no `PainelLateral` + `CenaPortao` (SVG autoral: fachada sem letreiro, folha ancorada no topo, motor ao lado do vão com setas SOBE/DESCE corrigidas e ligado por barra lateral + fio, FC com chamada sem fundo pastel; sem leitor I/O nem veículos)
- Botão **Ambiente** em `BarraSimulacao`; fechar ambiente encerra simulação ativa; laço em `App.tsx` com falha de motor → pausa + toast + Console
- Entradas comandadas pela planta somente-leitura na tabela de variáveis
- Mapa de E/S alinhado à referência (`%IX0.0`–`%IX0.4`, `%QX0.0`–`%QX0.4`); FC NA com margem; dano do motor só no batente
- Confirmado (2026-09-23): os dois FC são NA e `CenaPortao.tsx` já acendia o `SensorFc` exatamente quando o booleano de entrada (`entradas[ENDERECO_FC_*]`, sem inversão) indica contato fechado — nenhuma mudança em `CenaPortao.tsx`; JSDoc explícito e teste novo (`CenaPortao.test.tsx`, 3 casos). **Superado em parte na rodada seguinte, mesma data** — ver linha abaixo: o booleano do FC superior que essa confirmação validava era o fisicamente errado.
- **Correção física do FC superior (2026-09-23, revisão aditiva da spec 005):** o autor apontou que, no portão de enrolar (folha e tambor no topo), o FC1/superior é montado junto ao tambor e detecta a **lona passando** por aquele ponto, não "a folha chegou ao topo" — fica **ligado** fechado ou entreaberto, e só **desliga** perto do totalmente aberto (o inverso do que a linha acima confirmara; o FC inferior não mudou, o autor não o questionou). `nivelFcSuperior` em `frontend/src/ambientes/portao.ts` invertido (`abertura < ABERTURA_MAX - MARGEM_FC`); `CenaPortao.tsx` continua sem mudança (render já mirrorava o booleano bruto). Para preservar o mesmo comportamento físico do programa de referência (motor para no batente, lâmpada certa acende), os contatos de `fc_superior` no fixture `PORTAO` (`frontend/src/ladder/fixtures.ts`) trocaram NF↔NA nos três degraus que o usam (subir, `lamp_aberto`, `lamp_entreaberto`); dourados `portao.st`/`portao.json` regenerados pelo vitest (`toMatchFileSnapshot`); `portao.toml` com `%IX0.3` corrigido para o valor fisicamente coerente no cenário testado (saídas esperadas inalteradas). Testes hardcoded na convenção antiga corrigidos: `portao.test.ts` (fixture da planta) e `CenaPortao.test.tsx` (2 dos 3 casos invertidos: fechado passa a ter os dois FC acesos, aberto passa a não ter nenhum, entreaberto passa a ter só o superior). Spec 005 com nota datada explicando a física e listando cada degrau trocado. Verificação: `tsc --noEmit` sem erro novo; vitest completo 872 passed; pytest no backend (`docker run ladderflow-backend:dev`) 26 passed nos dois arquivos diferenciais do portão e 89 passed/7 deselected na suíte `not slow` completa. **Pendência para o autor:** a correção cobre a planta e o programa de referência/medição (`PORTAO`); a lógica que o usuário monta livremente na IDE para o ambiente interativo não é tocada por este fix — cabe a quem a monta usar a convenção agora documentada.
- Fixture `PORTAO` (motores + lâmpadas aberto/fechado/entreaberto), dourados `portao.st`/`portao.json`, `portao.toml`; diferencial portão ok (simulador + host)
- **Botão Parar NF (2026-09-28, revisão aditiva da spec 005):** pedido do orientador. `nivelParar` deixa `%IX0.2` verdadeiro em repouso e falso ao pressionar; a cena mostra `PARAR (NF)`; os contatos de `parar` no fixture `PORTAO` passam de NF para NA para o motor continuar habilitado em repouso; dourados regenerados e `portao.toml` com `%IX0.2 = true` nos ciclos de repouso
- e2e `ambiente.spec.ts` (modal, simulação, fechar no painel lateral); depósito (`build-deposito.sh --verificar` ok)
- **Criar variáveis sem sair do ambiente (2026-09-23, revisão aditiva nas specs 005 e 002):** o contrato de E/S abre expandido, com "N de M conectados", o nome da variável vinculada por ponto e, sem vínculo, o botão **Criar**. Ele abre `ModalNovaVariavel` com o endereço fixo e o nome sugerido (`nomeSugerido` no `PontoAmbiente`; no portão, os nomes da fixture `PORTAO`). **Criar todas** declara as que faltam, tudo ou nada. Complementar: **Nova variável…** no modal do elemento cria e vincula numa jogada, com o pino rotulado pelo ponto da planta quando há ambiente aberto. Tudo passa por `declararVariavel` e `aoMudarProjeto`, por isso entra no Desfazer. A criação pelo contrato fica desabilitada durante a simulação. Núcleo: `pontosSemVariavel`, `sugerirNomeVariavel` e `declararVariaveisDoContrato` em `vinculo.ts`. `ModalNovaVariavel.tsx` entrou no `REQUIRED_FILES`. Testes: `vinculo.test.ts`, `PainelAmbiente.test.tsx` (novo), `ModalVariavel.test.tsx`, `EditorLadder.test.tsx` e `App.test.tsx`, mais o e2e novo em `ambiente.spec.ts`. Conferido em Chromium real por capturas descartáveis

**Limitação declarada:** ver `docs/limitacoes-declaradas.md` §8 (planta didática simplificada; lâmpadas `%QX0.2`–`%QX0.4` dependem do programa Ladder).

## F10 — Coleta de métricas e validação 🟡

**Camada:** transversal · Sustenta a conclusão científica do trabalho

| Métrica | Status |
|---|---|
| Tempo de compilação | ✅ frio 66 s · incremental 11–13 s (Q-4) |
| Corretude do ciclo (tabela-verdade) | 🟡 verificada no runtime hospedeiro (host + QEMU); falta confirmar em hardware |
| Divergência simulação ↔ **runtime hospedeiro** | ✅ **0 divergências** (2026-09-21): 5 cenários contra gabarito + `BLINK` × `blink.st` executado no `plc_host_runner`, 200 ciclos × 3 padrões. Medida por dois processos independentes executando, não por traço gravado |
| Divergência simulação ↔ **hardware** | 🔒 depende de ESP32 físico; o lado do simulador já existe |
| Taxa de sucesso de gravação em N tentativas | 🔒 depende de F5 |
| Tempo de ciclo de varredura no dispositivo | ⬜ |
| Tempo total edição → dispositivo operante | 🔒 depende de F6 |
| Cobertura de elementos IEC 61131-3 | ⬜ |
| Acessibilidade: pré-requisitos vs. fluxo desktop | ⬜ comparação com OpenPLC |

**Arcabouço de teste diferencial (2026-09-15).** `backend/tests/diferencial/` está pronto: fixture declarativa em TOML (código ST, entradas por ciclo, saídas esperadas por ciclo), `HostRunnerExecutor` falando o contrato de `docs/validacao/contrato-runtime-host.md`, e um comparador que reporta ciclo, ponto e esperado/obtido. A abstração `Executor` e a função `comparar_execucoes` já existem para receber o simulador de F9 sem reescrita — falta só o segundo executor. **Cumprido em 2026-09-21** (spec 004): `SimuladorExecutor` entrou como alteração aditiva e `runner.py`, `comparador.py` e as fixtures TOML não mudaram uma linha — a promessa de 2026-09-15 se verificou literalmente.

**Alerta metodológico:** "o firmware compila" é evidência de que um componente funciona, não de que a integração é viável. A isso se acrescenta, desde 2026-09-15: **"o firmware roda no emulador" é evidência de que o código executa, não de que o dispositivo funciona.** A conclusão do trabalho precisa estar ancorada nestes números, não em demonstração pontual.

---

## FT — Conformidade para depósito (transversal) 🟡

**Concluído**
- `scripts/build-deposito.sh` **audita e aborta** em vez de apenas imprimir: manifesto `REQUIRED_FILES` (**51 arquivos**, contados em 2026-09-30: 14 do firmware/runtime, 5 do back-end — adaptadores, pipeline, endpoint e `main` — e 32 do front-end, os 30 anteriores mais `blocos.ts` e `SimboloBloco.tsx` da spec 006. O número anterior registrado aqui — 49, de 2026-09-24 — não acompanhava a spec 006) e listas de artefatos proibidos
- Modo `--verificar` para CI
- **Resumo digital hash em SHA-512** (`.zip.sha512`, 128 caracteres hexadecimais): é o algoritmo recomendado pelo Manual do Usuário do RPC e o declarado no formulário do NIT do IFTM em depósito anterior. O script imprime `SHA512` como o valor a transcrever no campo "Algoritmo hash" do e-Software. Antes gerava SHA-256, que o formulário aceitaria mas não é o recomendado
- `frontend/src/ladder/fixtures.ts` **fora do pacote**: são diagramas de gabarito importados só por `*.test.ts(x)` e pelos specs e2e — nenhum código de produção os usa. Escapavam do `--exclude "*.test.ts"` por não terem `.test.` no nome, contradizendo o critério "teste não é o programa" do próprio script. Pacote foi de 97 para **96 arquivos** em 2026-09-24; a spec 006 acrescentou dois fontes e a contagem atual é **98 arquivos**
- Nome `THIRD_PARTY.md` **mantido** (decisão do autor, 2026-09-24): o INPI não recebe o arquivo — só o resumo hash —, e a convenção do repositório é nome consagrado para arquivo de ecossistema (`README.md`, `Dockerfile`, `Makefile`) e português para fonte autoral. Renomear também deixaria as specs 002 e 004, já fechadas, apontando para arquivo inexistente
- Análise de conformidade de 2026-09-30, com o projeto aprovado pelo orientador. Três correções no que entra no zip: (1) `COPY tests/ ./tests/` saiu do `backend/Dockerfile` — `backend/tests/` não entra no pacote e um `COPY` de origem inexistente aborta o build do Docker; nenhum fluxo documentado lia a cópia embutida em `/app/tests` (os roteiros montam o `backend/` do host); (2) o `README.md` do pacote deixou de ter link markdown para `docs/limitacoes-declaradas.md` e `docs/README.md`, que ficam de fora — viraram menção em texto ao caminho no repositório; (3) varredura do conteúdo dos 98 arquivos: sem menção a assistente de IA, dado pessoal, segredo ou código de terceiro. Derivação autorizada permanece "não houve": MATIEC e ESP-IDF são processo separado, e as bibliotecas são dependência de pacote, não transformação da obra originária (Lei 9.609, art. 5º; Manual do RPC, seção 2.3.2)
- Correção de conteúdo de 2026-10-01, antes de gerar o hash. O README do pacote lista CTU, CTD, TON e TOF — a lista parava no CTU, anterior à spec 006. O segundo item de "Duas formas de uso do MATIEC" em `THIRD_PARTY.md` atribui o `.bin` combinado ao serviço de compilação, que o entrega por download ou gravação, e registra que a distribuição está sujeita à LGPL-3.0 para quem opera o serviço. O comentário em `plc_glue.c` aponta para `THIRD_PARTY.md` em vez de declarar LGPL-2.1+. Comentários que citam `.claude/state.md`, menções do README a `docs/` e o `.env.example` permanecem de propósito
- `verificar_origem` inspeciona a **árvore de origem**, não o staging — evita que os `EXCLUDES` do rsync limpem contaminação em silêncio e produzam pacote verde indevidamente
- Quatro testes em `test_deposito.py`, incluindo dois negativos que provam que o guarda morde. **Desde 2026-09-16 eles rodam na imagem**: `rsync` e `zip` passaram a ser instalados no `Dockerfile` (camada de 3,04 MB); antes, pulavam em silêncio pelo `skipif`
- Critério escrito do que entra no depósito — **o programa, não o projeto** — no cabeçalho de `scripts/build-deposito.sh`, com a regra para arquivo novo
- `THIRD_PARTY.md` corrigido: headers do MATIEC são **LGPL-3.0-or-later** (não LGPL-2.1) — `iec_types_all.h` declara LGPL-3+ e `iec_std_lib.h` declara LGPL-2+; como o build reúne ambos pelo mesmo `-I`, prevalece a mais restritiva
- Distinção registrada entre processo separado (sem obra derivada) e linkagem real no firmware. O trabalho combinado é o `.bin` gerado pelo serviço de compilação e entregue ao usuário por download ou gravação; a LGPL-3.0 recai sobre quem distribui esse binário, não sobre o código autoral nem sobre o pacote depositado (redação alinhada em 2026-10-01; a versão anterior atribuía o `.bin` ao usuário final)
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
| **Q-9** | **Cadência da marcha lenta do simulador.** Está em **500 ms/ciclo**, escolhida na spec 004 sem validação do autor (a spec só exigia "ao menos uma marcha lenta"). Dado concreto: a 500 ms, **meia piscada do `BLINK` (25 ciclos) leva 12,5 s** — lento demais para observar o laço sem impaciência. A alternativa prevista no plano original é **duas velocidades, 200 ms e 1 s**. | F9, usabilidade do simulador. Só interface; o núcleo medido não muda. | **Depois de testar na ferramenta.** Registrada em 2026-09-21 a pedido do autor, que decidiu não alterar o valor sem usar antes. |
| — | Temporizadores e contadores no escopo da PoC | F8, F9, cobertura IEC | **Encerrada:** CTU, TON, TOF e CTD no editor, serializador e simulador (spec 006, 2026-09-28). |

---

## Estado final do software

O software do TCC está **completo até onde é possível sem ESP32 físico**: F1–F9 e F11 entregues; F5/F3/F10 com lacunas só de hardware ou de medição sistemática. A fatia vertical editar → simular (diagrama + ambiente) → compilar → tentar gravar está fechada. A rodada de fechamento de 2026-09-21 (interrompida antes da verificação final) foi **retomada em 2026-09-23** a partir do stash: defeitos de UX da F9, `IO_ESPELHO_8`, pytest como não-root, documentação alinhada e roteiro `docs/validacao/dia-do-hardware.md`. **Nenhuma pendência de código** resta da F9 além da decisão de produto **Q-9** (marcha lenta).

---

## Próximos passos, em ordem

**Não há mais feature de código pendente.** O que resta é decisão (Q-9), medição (F10), hardware e escrita do TCC.

1. **Decidir a Q-9** (marcha lenta) usando a ferramenta.
2. **Coleta sistemática de métricas (F10).** O instrumento está completo: dois executores independentes. Métricas sem hardware podem ser fechadas — cobertura IEC e comparação com OpenPLC seguem ⬜.
3. **Demonstração ao orientador** e **Dia do Hardware** quando houver ESP32 (`docs/validacao/dia-do-hardware.md`).
4. Pendências menores: desenho de ramos cruzados (limitação declarada §1).

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
| 2026-09-16 | S3 da spec 001 — gravação no navegador e tela mínima | F6 fechada e F5 com a camada navegador pronta: `gravador.ts` sobre esptool-js com erros classificados, tela crua com painel do envelope Q-3; 10 testes vitest; verificação em Chromium headless (compilar, ST inválido, Gravar sem dispositivo); caminho do diretório temporário deixa de vazar em `diagnostics[].file`; testes do front-end excluídos do depósito; Vitest/jsdom/Testing Library em `THIRD_PARTY.md` |
| 2026-09-16 | Fase 1 (Especificar) da spec 002 — Editor Ladder | `docs/specs/002-editor-ladder/spec.md` criado: subconjunto IEC 61131-3 do editor (NA, NF, bobina simples, SET/RESET, ramo paralelo, contador crescente), motivado pelas três fixtures de referência (`blink.st`, `io_espelho.st`, `minimal.st`); seis questões em aberto (Q-1 a Q-6); `plan.md`/`tasks.md` como placeholders. Nenhum código escrito — F7 continua ⬜, aguardando aprovação do autor para liberar a Fase 2 |
| 2026-09-16 | Spike S4 da spec 002 — canvas e modelo de dados | Protótipos SVG puro e Konva sobre o mesmo contrato de modelo, medidos pelos mesmos critérios: **SVG puro venceu** em todos (213 × 325 linhas, jsdom sem mock, teclado por célula, 71 × 174 kB gzip, nenhuma dependência nova); React Flow descartado por argumento. Modelo de grade validado nas três fixtures (19 testes). Blink em Ladder com CTU medido no `plc_host_runner`: 1 divergência em 50 ciclos, por construção. Q-1, Q-2, Q-4, Q-6 da spec 002 decididas. Registro em `spike-canvas.md`; protótipos em `spikes/`, fora do depósito (`--verificar` ok) |
| 2026-09-16 | Fechamento do spike S4 e decisões da spec 002 | Rodada do spike commitada e worktrees de agente removidas. Auditoria independente confirmou o agente que caiu por limite de API (19 testes, números do diferencial idênticos). Hipótese do preset investigada com gabarito forte (`blink.st` executado, 200 ciclos, 3 padrões de entrada): o veredito "divergência intrínseca" do agente foi **refutado** — variante com PV=12, realinhamento do sinal de contagem e LED pelo limite atrasado fecha com 0 divergências; a linha anterior deste histórico ("por construção") estava errada. Q-4 revisada para equivalência exata; Q-3, Q-5 e Q-7 (CTU destacável) decididas; Q-6 registrada como desvio deliberado da prática corrente |
| 2026-09-16 | Spec 002 aprovada e plano 002 | Checklist de revisão da spec percorrido: acrescentados CA-9 (bobina duplicada/aviso SET-RESET) e CA-10 (limites), corrigida contagem de elementos; spec aprovada. `plan.md` escrito com D-1 a D-10, contrato do modelo (CTU com `linhaReset`, `tipo` só `BOOL`, severidade), mapeamento CA → teste e quatro fatias; aguardando aprovação do autor |
| 2026-09-16 | Plano 002 aprovado e tarefas 002 | Push de `main` (`ce93bce..d983635`). Ressalvas da aprovação registradas no plano como §10 (R-1 aviso no código do elo manual do CA-3; R-2 seleção como decisão de design; R-3 teste de acoplamento endereços ↔ `plc_io_map.h` movido para o pytest, que hoje não existia). `tasks.md`: 20 tarefas, 4 fatias, frentes com dono único de arquivo para evitar conflito em `frontend/src/ladder/`; aguardando aprovação |
| 2026-09-16 | Fatia 1 da spec 002 (#1–#8) | Editor Ladder mínimo na tela: núcleo puro (modelo, endereços, validação, edição) + SVG (grade, símbolos, paleta, variáveis, editor). `IO_ESPELHO` e `MINIMAL` construíveis pela UI (CA-1, CA-2), recusa de posição inválida visível (CA-5); teste de acoplamento `plc_io_map.h` ↔ `enderecos.ts` (R-3). 69 testes vitest, 60 pytest, build e depósito verdes. Frentes paralelas sem conflito de arquivo |
| 2026-09-16 | Ajuste de interação #21 (spec 002) | Pedido do autor antes da fatia 2: paleta com símbolo, prévia sob cursor/foco derivada do núcleo, recusa abaixo do degrau com célula marcada (plano §11, D-11). Frentes D1 (símbolos/paleta) e D2 (grade/editor) em paralelo; ambas caíram por limite de API e foram retomadas. Revisão do orquestrador pegou ícone invisível no botão pressionado e, na verificação visual, mensagens 0-based sem a regra — corrigidas (frente N), com a regra de posição tornada fonte única. 107 testes vitest, build verde |
| 2026-09-16 | #22 da spec 002 — só arrastar-e-soltar | Autor reverteu D-4/R-2 após uso (plano §12, D-12): arrasto por Pointer Events com teclado, clique marca + lixeira/Delete, tabela de variáveis (tipo e endereço) ao lado dos degraus, modal de variável. Frentes N, D1, D2, T em paralelo. Verificação no Chromium real achou bug que os testes não pegavam (segundo arrasto cancelado por arrasto nativo de seleção); primeira correção do agente partiu de causa errada e foi refutada no navegador; causa isolada por log de eventos e corrigida. Tabela alargada após captura. 181 testes vitest, build verde |
| 2026-09-17 | #23 da spec 002 — IDE, segundo clique, variáveis, 8/8 E/S | Autor pediu redesign estilo IDE (referência visual sem cópia), modal só no segundo clique e variáveis simplificadas com até 8 entradas/8 saídas. Frentes F (pinagem 8/8 no firmware + Q-5 da spec 001), L (editor), V (variáveis), I (casca de IDE, console, temas) em paralelo; as quatro caíram por limite de API antes de escrever e foram retomadas. 269 testes vitest, pytest completo com `slow` 70 passed, compilação real verificada no console da IDE em Chromium |
| 2026-09-17 | #24 da spec 002 — degrau responsivo, pinos, ícones, ramo | Ajustes do autor sobre a #23: degrau na largura do contêiner, variável Memória explícita e pino GPIO no seletor, mapa de pinos em duas tabelas, header e paleta com `lucide-react`, MATIEC/toolchain só no console, e ramo paralelo por arrasto com alça (antecipado da #15). Frentes N, L, V, I em paralelo; revisão visual devolveu dois defeitos do painel à frente V. 344 testes vitest; contato de selo montado com mouse real no Chromium |
| 2026-09-17 | Fatias 2 e 3 da spec 002 (#9–#14) | Commit da #24 antes de começar. Autor escolheu executar as duas fatias juntas e a lista de problemas numa aba do painel inferior (D-15). Levas: N1 (degraus) ∥ N2 (Q-6, persistência) → L (editor) ∥ I (IDE) → E (e2e Playwright). Revisão corrigiu JSDoc que chamava de "mais restrita" a leitura mais abrangente de `set_reset_autodependente`; o vitest passou a pegar o spec do Playwright e foi restrito a `src/`. 410 testes vitest, e2e 2 passed, Chromium com mouse real (degraus, duplicada, foco, mover entre degraus) |
| 2026-09-17 | #25 da spec 002 — ajustes de UX | Commit e push das fatias 2–3 (`3ab1307`). Autor: degrau vazio não é erro, "caminho" mantido como limitação, aba inicial pelo erro carregado, mensagens fora do editor (barra de status + Console, escolhida após comparar com toast e aba própria), escada contínua no padrão dos editores Ladder, bobina solta vai à coluna 8. Frentes N ∥ L ∥ I. Revisão pegou recusa da alça a cada `pointermove` e vão entre trilhos; corrigidos. 435 testes vitest, e2e verde, Chromium nos dois temas |
| 2026-09-17 | Fase 1 da spec 003 — Serializador Ladder → ST | Rodada da #26 fechada e empurrada (`dc0bb6e`). Autor reordenou a fila: **F8 antes da Fatia 4**, porque o editor já constrói e valida mas Compilar/Gravar seguem desabilitados em projeto Ladder, e porque a #17 (ST escrito à mão) perde o motivo de existir quando o serializador existir. `docs/specs/003-serializador-ladder-st/spec.md` escrita por frente de especificação: 12 RF, 9 CA (CA-1 a CA-4 medidos pelo arcabouço diferencial contra compilador e runtime reais), subconjunto sem CTU, Q-1 a Q-6 em aberto. F8 sai de 🔒 — a dependência é o modelo de dados, não a Fatia 4. Nenhuma linha de código; aguardando aprovação do autor para liberar a Fase 2 |
| 2026-09-17 | #26 da spec 002 — projeto e IDE reorganizada | Autor trouxe referências visuais: cabeçalho defasado, variáveis como aba e painel inferior mais dividido. Q-2 revista: um projeto por linguagem, criado por Novo projeto (descarte confirmado, título e linguagem), isolando a compilação. Frentes P (projeto) ∥ M (modais) ∥ H (cabeçalho/painel) ∥ L (variáveis) → A (integração) → E (e2e); a primeira tentativa das quatro caiu por limite de sessão antes de escrever e foi redespachada. Esqueleto ST validado no iec2c. 499 testes vitest, e2e com 4 cenários, Chromium nos dois temas |
| 2026-09-18 | Revisão pós-#26 — painel de variáveis volta a ser lateral | Autor testou a sub-aba "Variáveis" de largura inteira e pediu de volta o painel lateral recolhível/redimensionável de antes da #26 (`PainelLateral` restaurada, sub-abas Lógica/Variáveis saem de `BarraSuperior`). Achado só no Chromium real: `SeletorClasse` vazava da célula e cobria o `<select>` de Pino, interceptando o clique — corrigido com `flex-wrap`; tabela ganhou `min-w-[600px]` com rolagem horizontal própria para não esconder o pino num painel de 288–320px. Pedido à parte: fundo cinza da coluna da bobina (coluna terminal) removido, célula igual às outras. 499 testes vitest, e2e 3 passed (Chromium real), depósito ok |
| 2026-09-18 | Aprovação da spec 003 — decisões Q-1 a Q-6 | Revisão de onde o projeto estava: da spec 002 só resta a Fatia 4, adiada pelo autor em favor da F8, então nenhuma fatia pendente da sprint. Autor decidiu as seis questões conforme a recomendação: ST gerado visível somente leitura; erro de validação recusado na tela; rastreio de diagnóstico por degrau; nomes e `T#20ms` fixos; SET/RESET em ordem dos degraus, com a última escrita vencendo; degrau vazio omitido e diagrama vazio como "nada a compilar". CA-4/7/8 com revisão aditiva datada; spec aprovada; esboço técnico registrado no F8 para o `/planejar 003`. Só documentação, nenhum código |
| 2026-09-18 | Fase 2 (Planejar) da spec 003 | Aprovação da spec commitada e enviada (`0f0c6e9`). `plan.md` escrito com D-1 a D-11: serializador puro que lê o degrau como circuito de nós (redução série-paralelo, com fallback por nó para ramos cruzados, que a edição permite); SET/RESET como `IF` na ordem dos degraus; recusa de palavra reservada IEC e de nomes que diferem só em maiúsculas (tensão registrada, sem RF próprio); arquivos dourados via `toMatchFileSnapshot` executados pelo pytest diferencial, o que quita a R-1; portão de compilação na IDE; aba "ST gerado"; diagnóstico → degrau. Nenhuma dependência nova. Plano em revisão; nenhum código |
| 2026-09-18 | Plano 003 aprovado e Fatia 1 da spec 003 (S6a, #1–#6) | O autor aprovou o plano e liberou tarefas e implementação na mesma decisão; as recusas de D-5 entraram como revisão aditiva do RF-5. `tasks.md` com 10 tarefas. Frentes sonnet N ∥ B ∥ P. Entregues: serializador puro (redução série-paralelo com fallback por nó, ordem determinística por chave de origem, achado da frente N), 39 testes com prova por tabela-verdade, 5 arquivos dourados gerados pelo vitest e compilados no `iec2c` real, pytest diferencial **executando** no `plc_host_runner` com 0 divergências nos 5 cenários, inclusive a coincidência SET/RESET e a comparação com os STs de referência. **R-1 do plano 002 quitada.** 548 testes vitest, 72 no pytest, depósito ok. A aba "ST gerado" (#7) está pronta, com integração na IDE (#8, #9) em andamento |
| 2026-09-18 | Fatia 2 da spec 003 (S6b, #7–#10) — F8 ✅ | Frentes sonnet P (aba "ST gerado") e T (App + e2e). Portão D-6 usando só erros de validação, para uma falha de compilação não travar o botão; Compilar em LD pelo mesmo `/compile/pacote`; diagnóstico do `iec2c` → degrau na aba Problemas. e2e confere o `source` enviado byte a byte contra o arquivo dourado. Chromium com back-end real em rede isolada: IO_ESPELHO (60 s, build frio) e SELO (11 s) compilados de diagramas Ladder, com as 3 imagens e Gravar habilitado; erro e vazio bloqueiam com motivo. 553 testes vitest, 72 no pytest, e2e 4 passed, depósito ok. Segundo caminho fim-a-fim fechado até onde é possível sem ESP32 |
| 2026-09-18 | Integração à `main` | `feat/002-editor-ladder` integrada à `main` por fast-forward, levando a spec 002 (fatias 1–3, ajustes #21–#26) e a spec 003 inteira (F8 ✅); a branch foi apagada local e remotamente. A `main` passa a ser a única branch |
| 2026-09-18 | Revisão de UX pós-F8 — download e toasts (spec 002 #27, spec 003 #11) | Duas revisões aditivas pedidas pelo autor depois de usar a F8: (1) Q-1 da spec 003 revista, com a aba "ST gerado" trocada pelo botão **Baixar** no cabeçalho (Ladder .json / Structured Text .st, com o .st sob o mesmo portão do Compilar; D-12); (2) aba Mensagens trocada por **toasts** próprios só para as recusas, com o Console inalterado (D-18). Frentes sonnet D ∥ M → T. Nenhuma dependência nova. 587 testes vitest, e2e 5 passed (download conferido byte a byte com o arquivo dourado; recusa → toast com mouse real), depósito ok, capturas nos dois temas |
| 2026-09-18 | Toasts no canto superior esquerdo (ajuste de D-18) | A pedido do autor, os toasts saem do canto inferior direito e vão para o superior esquerdo, logo abaixo do cabeçalho (`top-14`, sem cobrir "Novo projeto"). Só a posição mudou; D-18 ganhou uma nota datada |
| 2026-09-19 | Fatia 4 da spec 002 + CTU serializado — **F7 ✅** | O autor incluiu a serialização do CTU na rodada (revisão aditiva da spec 003: RF-13, CA-10, D-13; plano 002 §19/D-19). O orquestrador trocou o contrato (`ElementoCtu`); depois as frentes sonnet N (`ctu.ts` destacável) ∥ S (serializador, `BLINK` e diferencial) e D (SET/RESET/CTU no editor) ∥ T (e2e). O `BLINK` serializado bate com `blink.st`, com 0 divergências em 200 ciclos × 3 padrões. A #17 foi substituída sem ST escrito à mão, e o CA-3 é montado pela UI. A revisão visual no Chromium achou o ramo cruzando a linha de reset (corrigido com a troca de linhas) e o traço atravessando a caixa do CTU (corrigido com fundo opaco). 717 vitest, 76 pytest, e2e 6, depósito ok; `BLINK` compilado de verdade no Chromium com back-end real |
| 2026-09-20 | Fase 1 e 2 da spec 004 — F9 | Spec escrita com 21 RF, 13 CA e Q-1 a Q-8; o autor decidiu as oito na mesma rodada e liberou plano, tarefas e implementação. O corolário do plano virou **RF-7**, requisito de primeira ordem: o simulador calcula energização por propagação de fluxo própria e **não** reaproveita a redução do serializador, porque leituras de topologia compartilhadas fariam a comparação medir zero sem medir nada — tensão contra o §11 registrada de propósito. Q-8 decidida pelo autor a favor do processo real contra o traço gravado, com o argumento do `ESP_PROJECT_TEMPLATE` (artefato congelado que envelhece sem ninguém notar). Correções de passagem no painel: `POST /compile/pacote` movido de "Falta" para "Concluído" na F4 e a descrição do manifesto atualizada. A terceira correção pedida (resíduo de Fase 1 na F7) **não se aplicava** — a frase só existe numa linha datada do Histórico, que é registro verdadeiro daquele dia |
| 2026-09-21 | Spec 004 implementada — **F9 ✅**, software completo | Etapa 0 (contrato de `simulacao.ts` e do shim) publicada pelo orquestrador antes de despachar ninguém. Levas de subagentes sonnet: N (motor, testes, shim, diagramas exportados) ∥ X (`node` na imagem, `SimuladorExecutor`, teste diferencial, README) → D (energização) ∥ T (modo simulação, relógio, variáveis ao vivo) → E (e2e). **`BLINK` simulado × `blink.st` no `plc_host_runner`: 0 divergências em 200 ciclos × 3 padrões**, com controle negativo (PV 12→13 → 57 divergências) provando que o instrumento mede. A promessa de 2026-09-15 do arcabouço se cumpriu literalmente: `runner.py`, `comparador.py` e as fixtures TOML não mudaram uma linha. A verificação em Chromium real achou o fio da célula terminal desenhado desenergizado atravessando a bobina energizada — corrigido **no desenho**, nunca no núcleo medido. 799 vitest, 85 pytest, 10 e2e, depósito ok. A frente E caiu uma vez por limite de API antes de escrever e foi redespachada do zero |
| 2026-09-21 | Spec 005 — **F11 ✅** ambientes de simulação | Ciclo SDD completo (spec/plano/tarefas/implementação). Núcleo `ambientes/` + planta portão SVG; painel flutuante; acoplamento um passo/ciclo em `App.tsx`; fixture `PORTAO` no diferencial (10 passed simulação + serializador). 808 vitest, depósito ok, e2e `ambiente.spec.ts` |
| 2026-09-22 | Cena portão + saídas paralelas | `CenaPortao.tsx` redesenhada (folha no topo, fachada/interior bar, motor, FC com chamada). Núcleo: bobinas na coluna terminal linhas 0–2; serializador/simulador/grade/editor; `SAIDAS_PARALELAS` + `PORTAO` com `%QX0.2–0.4`; dourados; pytest diferencial 26 passed; e2e `saidas-paralelas.spec.ts`; revisões specs 002–005 e `limitacoes-declaradas.md` |
| 2026-09-22 | Ramo de saída e modal de propriedades | Reverte soltura automática na primeira linha livre: paralelo exige `ehRamoDeSaida`; `criarRamo` na coluna terminal; `trocarTipoElemento`; grade sem slots vazios automáticos; `ModalVariavel` → propriedades (select + ícones); dourados `saidas_paralelas.json`; vitest completo; pytest diferencial `saidas_paralelas`; specs 002–004 revisão aditiva; depósito ok |
| 2026-09-23 | Ambiente lateral e faixa de simulação | `PainelAmbiente` no painel direito (variáveis recolhidas); `BarraSimulacao` acima do editor; barra superior enxuta (sem LadderFlow/simulação/ambiente); `aoFecharAmbiente` encerra simulação; remove `JanelaFlutuante`; specs 004/005 revisão aditiva; vitest + e2e `ambiente`; depósito ok |
| 2026-09-23 | Oito ajustes de IDE | `favicon.svg` (contato NF); `historico.ts` + Desfazer/Refazer na barra do Ladder (Ctrl+Z/Y); `exportarPlcopen` + menu Baixar `.xml`; alças início/fim do ramo; `ModalConfirmarRemocaoDegrau`; largura máxima do painel `window−320px`; `--ide-energizado` verde; Sair da simulação em `ide-perigo`; dourados `frontend/tests/fixtures/plcopen/`; `docs/validacao/plcopen-exportacao.md`; 843 vitest; depósito ok |
| 2026-09-23 | Confirmação da semântica NA dos fins de curso (`CenaPortao.tsx`) | O autor perguntou se os dois FC do portão são NA e se o aceso/apagado do `SensorFc` era coerente. Confirmado: sim, ambos NA (já decidido na revisão de 2026-09-21); e o booleano que acende o sensor (`entradas[ENDERECO_FC_SUPERIOR/INFERIOR]`) já era o valor bruto, sem inversão — mesma condição que acende `lamp_aberto`/`lamp_fechado` no fixture `PORTAO`. Não havia bug: só JSDoc explícito em `SensorFc` e no cálculo de `fcSup`/`fcInf`, remoção de um ramo morto (`ring: 'none'` nunca usado), e `CenaPortao.test.tsx` novo (fechado/aberto/entreaberto). Spec 005 revisão aditiva; `tsc --noEmit` sem erros novos; 57/57 testes do escopo (`src/ambientes`, `src/App.test.tsx`, `CenaPortao.test.tsx`) |
| 2026-09-23 | Criar variáveis sem sair do ambiente (specs 005 e 002, revisão aditiva) | O autor relatou que, com o ambiente ocupando o painel lateral, era preciso alternar com o painel de variáveis para programar. As duas opções propostas foram adotadas, com papéis diferentes. A **principal** é o contrato de E/S: expandido, com nome vinculado por ponto, **Criar** (endereço fixo e nome do contrato) e **Criar todas**. A **complementar** é **Nova variável…** no modal do elemento, que cria e vincula. Um `ModalNovaVariavel` serve aos dois fluxos, e tudo passa por `declararVariavel`, pelo Desfazer e pelo congelamento da simulação. Achados: o e2e antigo de `ambiente.spec.ts` já falhava por ambiguidade de rótulo ("Abrir/Fechar ambiente" na faixa e no modal ou no painel), e foi corrigido escopando os seletores. O teste CA-3 do `BLINK` pela UI já levava 18–19 s contra um limite de 20 s e passou do limite com o botão novo; o timeout subiu para 40 s. `ModalVariavel.tsx` ficou sem o erro de `tsc` (`classeBotao`). 871 vitest, 13 e2e, `tsc` só com os 2 erros antigos de `edicao.test.ts`, depósito ok |
| 2026-09-23 | Correção física do FC superior do portão (spec 005, revisão aditiva) | O autor corrigiu a rodada anterior no mesmo dia (linha acima do FC): o FC1/superior, no portão de enrolar (folha e tambor no topo), detecta a **lona passando** pelo ponto fixo junto ao tambor — fica ligado fechado/entreaberto e só desliga perto do totalmente aberto; a leitura simétrica ao FC inferior, confirmada horas antes, era fisicamente errada para este sensor (o FC inferior continua correto, não foi questionado). Corrigido só na planta: `nivelFcSuperior` em `portao.ts` inverte o limiar (`abertura < ABERTURA_MAX - MARGEM_FC`); `CenaPortao.tsx` não muda (já mirrorava o booleano bruto sem inversão). Para o programa de referência `PORTAO` continuar parando o motor no batente e acendendo a lâmpada certa com o sinal do sensor invertido, os contatos de `fc_superior` nos degraus 1, 3 e 5 trocaram NF↔NA; dourados `portao.st`/`portao.json` regenerados pelo vitest e `portao.toml` com `%IX0.3` ajustado ao valor fisicamente coerente (saídas esperadas inalteradas). Testes que hardcoded a convenção antiga corrigidos: `portao.test.ts` e 2 dos 3 casos de `CenaPortao.test.tsx`. Nota datada na spec 005 explicando a física do tambor e cada degrau trocado, sem apagar a nota anterior (histórico aditivo). Verificação: `tsc --noEmit` sem erro novo; vitest completo 872 passed (403 isolados em `src/ambientes`+`src/ladder`+`App.test.tsx`+`CenaPortao.test.tsx`; um falso-negativo de `App.test.tsx` na corrida paralela completa não se repetiu isolado nem numa segunda corrida completa — flake de contenção, não regressão); pytest no backend via `docker run ladderflow-backend:dev` — 26 passed nos dois arquivos diferenciais do portão, 89 passed/7 deselected na suíte `not slow` completa. Pendência registrada para o autor: a correção não toca a lógica livre que o usuário monta na IDE para o ambiente interativo, só a planta e o programa de referência/medição |
| 2026-09-23 | Tabela de variáveis bloqueada na simulação (spec 002, revisão aditiva) | Decisão do autor após a criação de variáveis pelo contrato de E/S (que já bloqueava na simulação): a **tabela** no painel lateral também desabilita criar, renomear, trocar classe/pino e remover enquanto `simulacao.ativo`, com os mesmos motivos no `title`; leitura e valores ao vivo permanecem. Implementação já estava no disco (`TabelaVariaveis.tsx`, `PainelVariaveis.tsx`, `App.tsx`); esta rodada fechou spec 002, `state.md` (pendência F9) e verificação final. Testes: `TabelaVariaveis.test.tsx`, `PainelVariaveis.test.tsx` |
| 2026-09-23 | Botão Ambiente oculto com painel aberto (spec 005) | O autor pediu para não mostrar o botão **Ambiente** na `BarraSimulacao` enquanto o painel lateral de ambiente está aberto; fechar só pelo **Fechar ambiente** do `PainelAmbiente`. Teste em `BarraSimulacao.test.tsx` |
| 2026-09-23 | Retomada da rodada de fechamento (stash 2026-09-21) | Port manual do stash sobre `b4a7bcd`: CA-8 (paleta sem `pointer-events-none`, grade `not-allowed`, toast, e2e 10/10), coluna Valor após Nome, `aoPassoSimulacao` funcional + teste rajada, `IO_ESPELHO_8` + diferencial, `Dockerfile`/`ESP_BUILD_ROOT` para pytest não-root, README/arquitetura/THIRD_PARTY/limitações/dia-do-hardware, spec 004 revisões 2026-09-21; chip SIMULANDO **não** reaplicado (`BarraSimulacao`). Verificação completa na mesma rodada |
| 2026-09-23 | Modal de porta serial (spec 001, RF-5/CA-7) | Revisão aditiva na spec/plan/tasks (#17–#20); `portasSeriais.ts`, `ModalPortaSerial.tsx`, `gravar({ porta })`, integração em `App.tsx`; depósito com dois arquivos novos; vitest/tsc/build/`--verificar` verdes |
| 2026-09-23 | Deploy temporário VPS (`deploy/`) | Caminho curto: `docker-compose.prod.yml` standalone (`name: ladderflow`), portas só `127.0.0.1` via `deploy/.env`, `frontend/Dockerfile.prod` (build estático + Caddy no contêiner), `Caddyfile.exemplo` + README (TLS e `basic_auth` no host); `THIRD_PARTY.md` (Caddy); nota aditiva item 13 em `limitacoes-declaradas.md`; F4 atualizada — fora do pacote INPI |
| 2026-09-23 | Scripts `deploy/deploy.sh` e `deploy/remover.sh` | Caminho curto. `deploy.sh`: confere `deploy/.env`, avisa porta ocupada, `up -d --build`, espera `service_healthy` via `docker inspect` no id resolvido por `compose ps -q backend` (sem hardcode de nome de contêiner), testa `/health`, imprime o bloco do Caddy pronto para colar (não mexe no Caddy do host). `remover.sh`: `down -v --rmi all` e depois remove as imagens base (`espressif/idf:v5.4.1`, `node:22-bookworm-slim`, `caddy:2-alpine`) só quando `docker ps -a --filter ancestor=<imagem>` confirma que nenhum outro contêiner do host as usa; nunca roda prune global; lembra os 2 passos manuais restantes (bloco do Caddyfile e apagar `deploy/.env`). README §3/§7 atualizado para usar os scripts, mantendo o equivalente manual. `build-deposito.sh --verificar` confirmado sem `deploy/` no pacote |
| 2026-09-21 | Spec 005 revisão — redesign do portão | Modal de escolha (`ModalAmbiente`); cena SVG redesenhada; mapa `%IX`/`%QX` alinhado à referência; nome **Portão**; correção do × na janela flutuante; `PORTAO` com NF; dourados/`portao.toml` regenerados; e2e atualizado; depósito com componentes de UI do ambiente |
| 2026-09-28 | Spec 006 — TON, TOF, CTD | `ElementoBloco` + `blocos.ts`, diagrama persistência v2; simulador MATIEC (20 ms/ciclo); serializador/dourados `ton`/`tof`/`ctd`; relógio `plc_hal_stub_advance_us` no host; diferencial sim×host; `SimboloBloco`, paleta, CV/ET ao vivo; docs 006 + revisões aditivas; manifesto INPI; vitest 921+/923, pytest `not slow` 94 passed, `--verificar` ok |
| 2026-09-28 | README + firmware .zip (orientador) | `README.md`: clone `andre-m-t/ladder-web-ide`, passo a passo Linux/Windows (Docker e só front-end), comportamento sem backend; menu Baixar → Firmware ESP32 (.zip) com compilação sob demanda e reutilização de pacote; `lib/download.ts` (ZIP STORE + `gravacao.txt`); revisão aditiva Q-1 spec 003 |
| 2026-09-28 | Botão Parar NF no portão (orientador) | Planta: `%IX0.2` verdadeiro em repouso e falso ao pressionar; cena `PARAR (NF)`; fixture `PORTAO` com contato NA em `parar`; dourados e `portao.toml` atualizados; revisão aditiva spec 005 |
| 2026-09-28 | manifest.json no zip de firmware | `conteudoManifestEspWebTools` + entrada no ZIP; `gravacao.txt`/README com ESP Web Tools; teste vitest; revisão aditiva Q-1 spec 003 |
| 2026-09-24 | Pacote INPI pronto para o hash | Caminho curto, motivado pela preparação do formulário do NIT. `--verificar` passou no commit `2e3f66c` com a árvore limpa. Três achados: (1) o script gerava **SHA-256** e o Manual do RPC recomenda **SHA-512** — o formulário preenchido pelo mesmo orientador em depósito anterior (`Formulario_INPI_CLP_Pedro-Robson.pdf`) declara `SHA512` com resumo de 128 caracteres, confirmado por contagem; script passou a gerar `.zip.sha512` e a imprimir o algoritmo a transcrever; (2) `frontend/src/ladder/fixtures.ts` vinha no pacote por não casar com `--exclude "*.test.ts"`, embora só testes e specs e2e o importem — excluído, pacote de 97 → **96 arquivos**; (3) `REQUIRED_FILES` tem 49 arquivos, não os 35 registrados aqui desde 2026-09-21. Nome `THIRD_PARTY.md` mantido por decisão do autor. `--verificar` reexecutado: exit 0, auditoria ok, nenhum arquivo de teste no pacote |
| 2026-09-29 | Build de produção do frontend | Caminho curto. O `npm run build` do `Dockerfile.prod` caía no `tsc`: depois da spec 006, `App` e `EditorLadder` passam `blocos` na simulação, mas `AreaEditor` ainda tipava só a energização; o helper `arrastarEEscolher` aceitava só `RegExp` e três testes do CTU passam o rótulo em string. Tipo único `SimulacaoDiagrama`; `tsc --noEmit` limpo (a pendência antiga de `edicao.test.ts` também já não existe). O aviso de portas 8010/3010 no `deploy.sh` é o stack que já está no ar, não a causa da falha |
| 2026-09-30 | Pacote INPI constrói e está conforme | Caminho curto, depois da aprovação do orientador. Análise contra a Lei 9.609 (art. 3º §1º III e art. 5º), o Manual do RPC e o formulário do NIT: o pacote segue sendo só código autoral mais o mínimo para reproduzir; derivação autorizada continua "não houve"; varredura dos arquivos sem IA, dado pessoal, segredo ou código de terceiro. Três correções: `COPY tests/` saiu do `backend/Dockerfile` (o pacote extraído não construía); links do README para `docs/` viraram menção em texto; contagens da F(T) atualizadas para 51 no manifesto e 98 no pacote. A frase da decisão encerrada sobre temporizadores, que ainda dizia "TON/TOF/CTD fora", foi alinhada à spec 006. Verificação: imagem reconstruída (cache até `COPY firmware/`); pytest `not slow` 94 passed, 7 deselected; `--verificar` exit 0, 98 arquivos, nenhum teste no pacote |
| 2026-10-01 | Pacote INPI: conteúdo alinhado antes do hash | Caminho curto, spec 001. Três correções no que entra no zip: (1) o README listava só o CTU e passou a citar CTU, CTD, TON e TOF, já entregues na spec 006; (2) `THIRD_PARTY.md` deixou de atribuir o `.bin` combinado ao usuário final — quem gera e entrega o binário é o serviço de compilação, e a LGPL-3.0 recai sobre quem opera o serviço; (3) o comentário de `plc_glue.c` deixou de citar LGPL-2.1+ e aponta para `THIRD_PARTY.md`. Comentários que citam `.claude/state.md`, menções do README a `docs/` e o `.env.example` permanecem. Verificação: imagem reconstruída (cache até `COPY firmware/`); pytest `not slow` 94 passed, 7 deselected; `--verificar` exit 0, 98 arquivos |
