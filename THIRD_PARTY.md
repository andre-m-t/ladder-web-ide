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
| esptool-js | Apache-2.0 | Dependência de pacote (front-end). |
| React | MIT | Dependência de pacote (front-end). |
| Vite | MIT | Dependência de pacote (ferramenta de build do front-end). |
| Tailwind CSS | MIT | Dependência de pacote (front-end). |
| TypeScript | Apache-2.0 | Dependência de pacote (ferramenta de build do front-end). |
| FastAPI | MIT | Dependência de pacote (back-end). |
| Uvicorn | BSD-3-Clause | Dependência de pacote (servidor ASGI do back-end). |
| Pydantic / pydantic-settings | MIT | Dependência de pacote (back-end). |

Imagens base de contêiner utilizadas na construção do ambiente:
`debian:bookworm-slim`, `python:3.12-slim` e `node:22-bookworm-slim`, com as
licenças das respectivas distribuições.

As dependências transitivas de cada ecossistema são declaradas em
`frontend/package.json` e `backend/requirements.txt` (mais
`backend/requirements-dev.txt`, restrito a desenvolvimento e testes) e fixadas
pelos respectivos arquivos de lock. Esses arquivos e os diretórios de
dependências instaladas **não** integram o pacote de depósito gerado por
`scripts/build-deposito.sh`.
