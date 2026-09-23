# Arquitetura — LadderFlow

Contexto estável lido pela IA antes de especificar ou planejar. Reflete o
`README.md` na raiz; se divergir, o `README.md` prevalece e este arquivo deve
ser atualizado.

---

## Visão

Arquitetura **cliente-servidor**. O cliente executa integralmente no navegador.
Ao servidor cabe **exclusivamente** a compilação (cf. §6 da constituição).

```
Navegador (sem instalação)                    Serviço de compilação
┌────────────────────────────────┐            ┌───────────────────────────┐
│ Editor visual Ladder           │            │ API (FastAPI)             │
│      │                         │  ST        │      ↓                    │
│      ├─► Serializador → ST ────┼──────────► │ MATIEC / iec2c  (ST → C)  │
│      │                         │            │      ↓                    │
│      └─► Simulador de ciclo    │            │ Toolchain ESP32 (C → bin) │
│          de varredura (lê o    │            │                           │
│          diagrama direto)      │  binário   │                           │
│                                 │            │                           │
│ Gravação via Web Serial API    │ ◄───────── │                           │
└──────────────┬─────────────────┘            └───────────────────────────┘
               │ Web Serial
               ▼
┌────────────────────────────────┐
│ ESP32 (clássico)               │
│ Runtime hospedeiro — software  │
│ autoral embarcado (ciclo de    │
│ varredura + glue de I/O)       │
└────────────────────────────────┘
```

## As três camadas

O diagrama acima tem duas colunas lado a lado e uma seta descendo para o
ESP32, o que convida a ler "duas camadas e um destino". Na verdade são
**três camadas**, e a terceira executa software autoral tanto quanto as
outras duas:

1. **Cliente** (navegador) — editor visual Ladder, serializador Ladder → ST,
   simulador de ciclo de varredura, gravação via Web Serial API. Sem
   instalação.
2. **Serviço de compilação** (servidor) — API FastAPI, MATIEC/`iec2c` e
   toolchain ESP-IDF, os dois últimos invocados como processos externos (cf.
   §6 e §10 da constituição). Sem estado: não persiste projetos, não conhece
   o editor.
3. **Runtime hospedeiro** (ESP32) — `backend/firmware/esp32-template`: o
   programa que de fato executa no dispositivo, com código autoral próprio —
   ciclo de varredura em `app_main.c`, ligação entre variáveis localizadas e
   GPIO em `plc_glue.c`, pinagem fixa em `plc_io_map.h`. É o destino do
   binário produzido pelo serviço de compilação, mas seu código-fonte é
   independente do back-end: embarca e roda no ESP32, não no servidor.

A pasta desse runtime hospedeiro fica sob `backend/firmware/` por **decisão de
build** — contexto de build do Docker, regras do `.dockerignore`, bind mount
de hot-reload (`./backend:/app` no `docker-compose.yml`) — **não** por decisão
de arquitetura. A localização em disco não deve ser lida como se o runtime
hospedeiro fosse parte do back-end: o back-end roda no servidor; o runtime
hospedeiro roda no ESP32.

## Fluxo de execução

1. O usuário constrói a lógica no **editor Ladder** (grade interativa em SVG).
2. A partir do mesmo diagrama, dois caminhos independentes rodam no cliente,
   sem um alimentar o outro:
   - o **serializador** (`frontend/src/ladder/serializador.ts`) traduz o
     diagrama para Structured Text de forma contínua, recalculado a cada
     edição (`useMemo` em `App.tsx`);
   - o **simulador de ciclo de varredura** (`frontend/src/ladder/simulacao.ts`)
     lê o **diagrama diretamente** — não o ST gerado — e executa lê → resolve →
     escreve a cada ciclo. É proibição deliberada (RF-7 da spec 004): o
     simulador não reaproveita a leitura de topologia do serializador, para
     que os dois nunca errem da mesma forma (ver "Arquitetura de validação"
     abaixo).
3. O código ST é enviado ao servidor e **compilado** (MATIEC → C ANSI →
   firmware ESP32).
4. O binário retorna e é **gravado no ESP32** pelo navegador, via Web Serial API.

## Fronteiras e contratos

| Fronteira | Direção | Conteúdo |
|---|---|---|
| Cliente → Servidor | requisição | código Structured Text (texto) |
| Servidor → Cliente | resposta | firmware binário **ou** erros de compilação estruturados |
| Cliente → ESP32 | Web Serial | protocolo de bootloader do ESP32 (via esptool-js) |

O servidor é **sem estado**: não persiste projetos, não conhece o editor.

## Componentes

- `frontend/` — aplicação web em React/Vite/Tailwind: editor Ladder
  (`components/ladder/`), núcleo puro do modelo, validação, edição,
  serializador e simulador (`frontend/src/ladder/`), persistência local do
  projeto, gravação via Web Serial (`lib/gravador.ts` sobre `esptool-js`) e a
  casca de IDE (`App.tsx`, painéis, temas).
- `backend/` — API FastAPI de compilação (`POST /compile`,
  `POST /compile/pacote`) e integração com MATIEC e com a toolchain ESP32,
  ambos invocados como processos externos.
- `backend/firmware/esp32-template/` — **runtime hospedeiro**: projeto ESP-IDF
  autoral que executa no ESP32, ligando o C gerado pelo MATIEC aos GPIOs
  (ciclo de varredura e pinagem fixa). Ver "As três camadas" acima.
- `docs/` — método de desenvolvimento, documentação técnica e resultados de validação.
- `scripts/` — utilitários do projeto (ex.: `build-deposito.sh`).
- `.claude/` — instrumentos do método: `state.md` (painel de estado do projeto)
  e `commands/` (as quatro fases do SDD). `CLAUDE.md`, na raiz, carrega as
  regras operacionais lidas por agentes de IA.
- `docker-compose.yml`, `.env.example` — orquestração local.

## Arquitetura de validação

A corretude da lógica autoral (serializador e simulador) é medida, não
suposta, por um arcabouço de **teste diferencial** (`backend/tests/diferencial/`):
dois executores independentes rodam o **mesmo** programa Ladder e são
comparados ciclo a ciclo, ponto a ponto.

- **Runtime hospedeiro** — o C gerado pelo MATIEC religado ao runtime autoral,
  compilado e executado de verdade no host (`plc_host_runner`), com I/O em
  memória.
- **Simulador** — `frontend/src/ladder/simulacao-cli.ts`, o mesmo motor de
  `simulacao.ts` sem interface, falando o mesmo contrato de E/S
  (`docs/validacao/contrato-runtime-host.md`) via `node` e um binário
  empacotado sob demanda pelo `esbuild`, invocado pelo executor de teste
  (`backend/tests/diferencial/executores.py::SimuladorExecutor`).

Os dois partem do mesmo diagrama de referência (via serializador, no caso do
runtime, e diretamente, no caso do simulador) e não compartilham código de
leitura de topologia — condição necessária para que uma divergência apareça
quando um dos dois erra. Ver RF-7 da spec 004 e o fluxo de execução acima.

## Pinagem de E/S

O ESP32 é mapeado para **8 entradas e 8 saídas digitais** (`%IX0.0`–`%IX0.7`,
`%QX0.0`–`%QX0.7`), fixadas em `backend/firmware/esp32-template/main/plc_io_map.h`
e espelhadas em `frontend/src/ladder/enderecos.ts` (um teste de acoplamento
falha se os dois divergirem). Detalhe da escolha de GPIOs, dos riscos de
*strapping pins* e do que ainda não foi verificado em hardware físico está em
`docs/validacao/`, especialmente
`docs/validacao/limites-da-validacao-sem-hardware.md`.

## Restrições de execução

- Navegador: Chrome ou Edge 89+ (Web Serial API).
- Contexto: HTTPS ou `localhost`.
- Hardware alvo: ESP32 clássico.
- Ambiente de dev: Docker + Docker Compose (MATIEC e ESP-IDF vêm no contêiner do
  backend, ambos executados como processos externos).
