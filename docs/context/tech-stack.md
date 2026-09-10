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
| Toolchain ESP32 | ainda não provisionada | entra como novo estágio no `backend/Dockerfile` junto com a etapa C → firmware |

A fronteira com o `iec2c` é **`backend/app/services/matiec.py`** — o único
módulo que chama `subprocess`. Invocação:
`iec2c -f -I <lib_dir> -T <out_dir> <arquivo.st>`.

## Infraestrutura

- Docker + Docker Compose (`docker-compose.yml` na raiz): serviços `backend` e
  `frontend`, com o `frontend` dependendo do healthcheck `/health` do backend.
- O MATIEC é **compilado a partir do fonte** no estágio `matiec-builder` do
  `backend/Dockerfile`, a partir de `beremiz/matiec` pinado por commit; só o
  binário `iec2c` e o diretório `lib/` entram na imagem final.
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
