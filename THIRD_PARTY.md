# Componentes de terceiros

Este documento **identifica** os componentes de terceiros utilizados pelo
LadderFlow, para fins de transparência e de conformidade de licenças.

Conforme orientação do INPI, os itens são apenas identificados — sua
implementação não é descrita — de modo que eventual exame de originalidade do
programa recaia somente sobre o código autoral.

Nenhum código-fonte de terceiros é incorporado ao código autoral deste projeto.
As bibliotecas são consumidas como dependências de pacote; o MATIEC é executado
como processo separado.

| Componente | Licença | Forma de uso |
|---|---|---|
| MATIEC (`iec2c`) | GPL-3.0 | Binário executado como **processo separado** pelo serviço de compilação. Compilado a partir do fonte durante a construção da imagem; não vinculado ao código autoral. |
| MATIEC — biblioteca C (`lib/C`, cabeçalhos `iec_std_lib.h` e afins) | LGPL-3.0-or-later (verificado — ver nota abaixo) | Cabeçalhos de terceiros **incluídos na compilação do firmware**, a partir da imagem do contêiner. Não são copiados para o repositório nem para o pacote de depósito. |
| ESP-IDF (toolchain do ESP32, `idf.py`) | Apache-2.0 | Ferramenta executada como **processo separado** pelo serviço de compilação; provida pela imagem oficial da Espressif. |
| QEMU (`qemu-system-xtensa`, alvo esp32) | GPL-2.0-only, com componentes sob licenças compatíveis | Emulador executado como **processo separado**, só em testes de validação (`pytest -m slow tests/test_qemu.py`, via `backend/scripts/run_qemu.py`). Vem embutido na imagem `espressif/idf:v5.4.1` (fork `esp_develop_9.0.0_20240606` distribuído pela Espressif). Nenhum fonte do QEMU é copiado para o repositório nem para o pacote de depósito. |
| Node.js (`node`, pacote `nodejs` do repositório apt de `espressif/idf:v5.4.1`, Ubuntu 24.04 "noble") | MIT | Ferramenta executada como **processo separado**, só na imagem de TESTE do back-end (`ladderflow-backend:dev`), instalada em `backend/Dockerfile` (spec 004, RF-19, Q-8a). Interpreta o `.mjs` empacotado sob demanda pelo esbuild (linha abaixo) a partir de `frontend/src/ladder/simulacao-cli.ts` — o segundo executor do arcabouço de teste diferencial (`backend/tests/diferencial/executores.py::SimuladorExecutor`). Não integra o produto entregue ao usuário nem o pacote de depósito; nenhum fonte do Node.js é copiado para o repositório. |
| esbuild (binário nativo `@esbuild/linux-x64`) | MIT | Já é dependência de pacote do front-end (via Vite); reaproveitado em teste como **ferramenta externa** para empacotar `simulacao-cli.ts` num `.mjs` único, fora do repositório, sem exigir `node` para o próprio empacotamento (`SimuladorExecutor::_empacotar_sob_demanda`). Nenhum artefato desse empacotamento é gravado na árvore do repositório. |
| esptool-js | Apache-2.0 | Dependência de pacote (front-end). |
| React | MIT | Dependência de pacote (front-end). |
| Vite | MIT | Dependência de pacote (ferramenta de build do front-end). |
| Tailwind CSS | MIT | Dependência de pacote (front-end). |
| lucide-react | ISC | Dependência de pacote (front-end): ícones da interface. |
| TypeScript | Apache-2.0 | Dependência de pacote (ferramenta de build do front-end). |
| Vitest, jsdom, Testing Library (`@testing-library/react`, `jest-dom`, `user-event`) | MIT | Dependências de pacote usadas só nos testes do front-end; não entram no programa entregue. |
| Playwright (`@playwright/test`) | Apache-2.0 | Dependência de pacote usada só nos testes ponta a ponta (`frontend/e2e/`, fora do front-end entregue e fora do pacote de depósito); roda em contêiner à parte, a partir da imagem oficial `mcr.microsoft.com/playwright`. |
| `@types/w3c-web-serial` | MIT | Declarações de tipo da Web Serial API (ferramenta de build do front-end). |
| Caddy | Apache-2.0 | Servidor HTTP e proxy reverso executado como **processo separado**; imagem oficial `caddy:2-alpine` no cenário de demonstração (`deploy/`). Não integra o programa entregue nem o pacote de depósito. |
| FastAPI | MIT | Dependência de pacote (back-end). |
| Uvicorn | BSD-3-Clause | Dependência de pacote (servidor ASGI do back-end). |
| Pydantic / pydantic-settings | MIT | Dependência de pacote (back-end). |
| pytest | MIT | Dependência de pacote usada só nos testes do back-end; não entra no programa entregue. |
| ruff | MIT | Dependência de pacote usada só nos testes do back-end; não entra no programa entregue. |
| httpx2 | BSD-3-Clause | Dependência de pacote usada só nos testes do back-end; não entra no programa entregue. Sucessor do `httpx` (`pydantic/httpx2`), exigido pelo Starlette 1.6.0 instalado na imagem; usado pelo `TestClient` do Starlette/FastAPI. Em `backend/requirements-dev.txt`. |

Imagens base de contêiner utilizadas na construção do ambiente:
`debian:bookworm-slim`, `espressif/idf` e `node:22-bookworm-slim`, com as
licenças das respectivas distribuições.

**Verificação da licença dos cabeçalhos do MATIEC (2026-09-15).** Leitura
direta, dentro da imagem `ladderflow-backend:dev`, do conjunto de cabeçalhos em
`/usr/local/share/matiec/lib/C` de fato alcançável pelo `-I` do build
(`backend/firmware/esp32-template/main/CMakeLists.txt` adiciona
`$ENV{MATIEC_LIB_DIR}/C` inteiro a `INCLUDE_DIRS`):

- `iec_std_lib.h` e `iec_std_functions.h` — aviso de copyright (Edouard
  Tisserant, Mario de Sousa) seguido de "GNU Lesser General Public License ...
  either version 2 ... or (at your option) any later version."
- `iec_types_all.h` — "GNU Lesser General Public License ... version 3 of the
  License, or (at your option) any later version."
- `iec_types_list.h` — sem número de versão no próprio cabeçalho; remete a
  "COPYING and COPYING.LESSER" do pacote.
- Os demais cabeçalhos do diretório (`accessor.h`, `globals_*.h`, `iec_types.h`,
  `iec_std_FB*.h`, `pous_*.h`, `undef_macros.h`) não trazem aviso de licença
  próprio; integram o mesmo pacote MATIEC, sob a licença declarada em
  `COPYING.LESSER`.

Como o build reúne, num mesmo binário, cabeçalhos com piso em LGPL-2 e
cabeçalhos com piso em LGPL-3 (ambos com cláusula "ou posterior"), a licença
efetiva da combinação é a mais recente entre as declaradas: **LGPL-3.0-or-later**.
Verificação ancorada no commit pinado do MATIEC —
`beremiz/matiec` `79410c7660cf337ec7991a167e53ef141a26caf9` (`ARG MATIEC_REF`
em `backend/Dockerfile`) — de modo que a conclusão seja reproduzível a partir
do mesmo fonte.

**Duas formas de uso do MATIEC, duas consequências distintas:**
- **`iec2c` invocado como processo separado** pelo serviço de compilação — não
  gera obra derivada. Nenhuma consequência sobre o código autoral do
  LadderFlow nem sobre a plataforma.
- **Cabeçalhos do MATIEC compilados dentro do firmware** — há linkagem real. O
  trabalho combinado é o `.bin` que o **usuário final** produz a partir do
  próprio programa Ladder. A consequência recai sobre a distribuição desse
  binário, não sobre a plataforma LadderFlow nem sobre o pacote depositado no
  INPI. Os cabeçalhos não são copiados para o repositório nem para o pacote de
  depósito.

O firmware gerado é um trabalho combinado: o código autoral do LadderFlow (o
projeto ESP-IDF em `backend/firmware/`), o C produzido pelo MATIEC a partir do
programa do usuário, os cabeçalhos LGPL da biblioteca do MATIEC e componentes
do ESP-IDF. Isso diz respeito ao **artefato compilado**, não ao código autoral
depositado, e deve ser observado ao distribuir firmware ou imagens de
contêiner.

As dependências transitivas de cada ecossistema são declaradas em
`frontend/package.json` e `backend/requirements.txt` (mais
`backend/requirements-dev.txt`, restrito a desenvolvimento e testes) e fixadas
pelos respectivos arquivos de lock. Esses arquivos e os diretórios de
dependências instaladas **não** integram o pacote de depósito gerado por
`scripts/build-deposito.sh`.
