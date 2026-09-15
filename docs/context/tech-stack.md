# Stack técnica e convenções — LadderFlow

Contexto lido pela IA na fase de **planejar**. Decisões de stack aqui são as do
`README.md`; mudá-las exige atualizar o README e registrar a decisão na spec/plano
correspondente.

---

## Front-end

| Item | Escolha | Observação |
|---|---|---|
| Runtime | Node 22 (imagem `node:22-bookworm-slim`) | só no contêiner de desenvolvimento |
| Biblioteca de UI | React 19 | componentes funcionais + hooks |
| Linguagem | TypeScript 5, `strict` | `frontend/tsconfig.json` cobre `src` e `vite.config.ts` |
| Build / dev server | Vite 6 | dev em `http://localhost:5173`, `server.host = true` |
| Estilo | Tailwind CSS 4 | via plugin `@tailwindcss/vite`; **sem** `tailwind.config.js`/`postcss.config.js` |
| Gravação serial | esptool-js (Espressif, Apache-2.0) | sobre a Web Serial API nativa |
| API do navegador | Web Serial API | só em contexto seguro |

Cliente HTTP da API em `frontend/src/lib/api.ts`; base configurada por
`VITE_API_URL`.

## Back-end

| Item | Escolha | Observação |
|---|---|---|
| Runtime | Python 3.12 (imagem `python:3.12-slim`) | |
| Framework | FastAPI | API em `http://localhost:8000`, docs em `/docs` |
| Dependências | `requirements.txt` + `requirements-dev.txt`, instaladas com `pip` | `pyproject.toml` só configura `pytest` e `ruff` |
| Compilador ST→C | MATIEC (`iec2c`), GPL-3.0 | **processo externo**, nunca importado como código (cf. §10) |
| Toolchain ESP32 | ESP-IDF v5.4.1 (imagem `espressif/idf:v5.4.1`) | **processo externo** (`idf.py build`), base do estágio `runtime` do `backend/Dockerfile` |
| Projeto de firmware | `backend/firmware/esp32-template` (ESP-IDF + CMake) | código autoral: `app_main.c` (ciclo de varredura), `plc_glue.c` (variáveis localizadas ↔ GPIO), `plc_io_map.h` (pinagem fixa, Q-5) |

As duas etapas externas de compilação têm **um módulo adaptador cada**, e são os
únicos lugares do backend que chamam `subprocess`:

| Etapa | Módulo | Invocação |
|---|---|---|
| ST → C ANSI | `backend/app/services/matiec.py` | `iec2c -f -I <lib_dir> -T <out_dir> <arquivo.st>` |
| C ANSI → firmware | `backend/app/services/esp32.py` | `idf.py -C <work_dir> -B <work_dir>/build build` |

O diretório de trabalho do ESP-IDF é reaproveitado entre compilações (volume
`esp-build-cache` no compose): é o build incremental que sustenta a decisão de
compilação síncrona (Q-6 da spec 001).

## Infraestrutura

- Docker + Docker Compose (`docker-compose.yml` na raiz): serviços `backend` e
  `frontend`, com o `frontend` dependendo do healthcheck `/health` do backend.
- O MATIEC é **compilado a partir do fonte** no estágio `matiec-builder` do
  `backend/Dockerfile`, a partir de `beremiz/matiec` pinado por commit; só o
  binário `iec2c` e o diretório `lib/` entram na imagem final.
- O estágio `runtime` parte de `espressif/idf:v5.4.1`: as dependências Python do
  backend são instaladas no venv do próprio ESP-IDF, e o entrypoint da imagem
  carrega `export.sh` antes do comando, de modo que o `uvicorn` e os
  subprocessos `idf.py` herdam `IDF_PATH` e `PATH`. **A imagem final mede
  ~7,3 GB** (`docker image ls ladderflow-backend:dev` → `7.33GB`, medido em
  2026-09-15; a base `espressif/idf:v5.4.1` sozinha já soma ~7,26 GB), bem
  acima da estimativa anterior de "~2–3 GB", que datava da base
  `python:3.12-slim` (~216 MB) anterior à migração para a imagem oficial da
  Espressif.

  O peso foi **concentrado no servidor de propósito**: é o preço de manter a
  promessa de "sem instalação" no cliente (cf. "Visão" em
  `docs/context/architecture.md`) — a própria métrica de acessibilidade que
  este trabalho se propõe a medir. É custo consciente de infraestrutura de
  desenvolvimento (a imagem só existe no ambiente que compila; nada disso
  chega ao navegador nem ao ESP32), não descuido. E é custo de **imagem**, não
  de **tempo de compilação** — este último está medido em Q-4 da spec 001
  (66 s a frio, 11–13 s incremental) e segue dentro da meta.
- Configuração via `.env` (a partir de `.env.example`). `.env` não é versionado.

## Norma de referência

IEC 61131-3 — linguagens Ladder (LD) e Structured Text (ST). O projeto cobre um
**subconjunto** declarado, não a norma inteira (cf. §3, §9).

## Convenções de código (a consolidar conforme o código nasce)

- Idioma do código: identificadores em inglês; comentários e documentação em
  português quando voltados ao TCC, em inglês quando técnicos de baixo nível.
- Código novo imita o estilo do arquivo/vizinhança (cf. §11).
- Front-end: componentes pequenos, estado local por padrão; sem dependência
  nova sem justificativa no `plan.md`.
- Back-end: funções puras onde possível; a fronteira com o `iec2c` isolada em um
  único módulo adaptador.
- Testes junto da feature; um bug corrigido ganha teste de regressão (cf. §4).

> Quando este projeto tiver um `CLAUDE.md` na raiz, ele passa a ser a fonte
> canônica de convenções e este arquivo apenas o complementa.
