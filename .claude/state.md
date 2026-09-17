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

**Última atualização:** 2026-09-17 (spec 002 — #26: projeto de linguagem única, cabeçalho novo, aba Variáveis e painel inferior em 3 abas) · **Branch ativa:** `feat/002-editor-ladder` (branches de feature são removidas após o merge)

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
| F7 | Editor Ladder visual | navegador | 🟡 |
| F8 | Serializador Ladder → ST | navegador | 🔒 |
| F9 | Simulador de ciclo de varredura | navegador | ⬜ |
| F10 | Coleta de métricas e validação | — | 🟡 |
| FT | Conformidade para depósito (transversal) | — | 🟡 |

**Leitura rápida:** a fatia vertical está fechada até onde é possível sem ESP32. No navegador, cola-se ST, compila-se no servidor e o pacote (imagens + offsets) chega à tela. O botão Gravar vai até a tentativa de conexão Web Serial e falha de forma clara sem dispositivo. No servidor, o mesmo pacote foi gravado via `esptool` num ESP32 emulado (QEMU), que deu boot. Nenhum dispositivo físico foi gravado: o transporte Web Serial é a única camada sem cobertura.

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

## F7 — Editor Ladder visual 🟡

**Camada:** navegador · **Autoral:** sim · **Maior feature do projeto**

**Spec em rascunho:** [`docs/specs/002-editor-ladder/spec.md`](../docs/specs/002-editor-ladder/spec.md)
(Fase 1 do SDD concluída em 2026-09-16, aguardando aprovação do autor;
`plan.md`/`tasks.md` são placeholders). Status desta feature continua ⬜ — nada
foi implementado ainda.

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
- Suíte `slow` falha com `--user` não-root: `ESP_BUILD_ROOT` na imagem é de root. Decidir entre `chown` no `Dockerfile` ou rodar como root
- `ruff format --check` aponta 3 arquivos antigos (`tests/diferencial/executores.py`, `tests/test_deposito.py`, `tests/test_plc_runtime_host.py`)

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
- Compilar e Gravar seguem indisponíveis em projeto Ladder até a **F8** existir
- `carregarDiagrama` confere só a forma de degraus e variáveis, não cada elemento

**Falta:** Fatia 4 (#15 SET/RESET, #16 CTU e `BLINK`, #17 `blink_ladder.st`, #18 SET/RESET/CTU no editor, #19 manifesto, #20 fechamento).

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
| — | Temporizadores e contadores no escopo da PoC | F8, F9, cobertura IEC | Após a fatia vertical fechar — **parcialmente decidida para o editor** pela spec 002: contador crescente (CTU) entra no escopo de F7, temporizadores (TON/TOF) e contador decrescente (CTD) seguem fora; escopo de F8/F9 continua em aberto |

---

## Próximos passos, em ordem

1. Demonstração da fatia vertical ao orientador. A afirmação de viabilidade só fecha com o hardware físico (ver abaixo).
2. `/implementar 002` — Fatia 4 (#15 SET/RESET → #16 CTU ∥ #17 `blink_ladder.st` → #18 editor → #19 → #20) → **F7**; depois **F8**, que destrava Compilar/Gravar em projeto Ladder
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
| 2026-09-17 | #26 da spec 002 — projeto e IDE reorganizada | Autor trouxe referências visuais: cabeçalho defasado, variáveis como aba e painel inferior mais dividido. Q-2 revista: um projeto por linguagem, criado por Novo projeto (descarte confirmado, título e linguagem), isolando a compilação. Frentes P (projeto) ∥ M (modais) ∥ H (cabeçalho/painel) ∥ L (variáveis) → A (integração) → E (e2e); a primeira tentativa das quatro caiu por limite de sessão antes de escrever e foi redespachada. Esqueleto ST validado no iec2c. 499 testes vitest, e2e com 4 cenários, Chromium nos dois temas |
