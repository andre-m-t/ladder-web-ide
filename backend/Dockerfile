# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Estagio 1 — compila o MATIEC (GPL-3.0) a partir do fonte.
#
# O MATIEC entra na imagem apenas como BINARIO, executado como processo
# separado pelo backend (constitution §10). Nenhum fonte do MATIEC e copiado
# para dentro do codigo autoral do projeto.
# ─────────────────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS matiec-builder

# Linhagem do autor original do MATIEC (Sousa & Carvalho), usada pelo Beremiz.
ARG MATIEC_REPO=https://github.com/beremiz/matiec.git
# Commit fixado para builds reproduziveis (master em 2026-08-14).
ARG MATIEC_REF=79410c7660cf337ec7991a167e53ef141a26caf9

RUN apt-get update && apt-get install -y --no-install-recommends \
        git ca-certificates build-essential autoconf automake libtool flex bison \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git clone "$MATIEC_REPO" matiec \
    && cd matiec \
    && git checkout --detach "$MATIEC_REF" \
    && autoreconf -i \
    && ./configure CXXFLAGS="-w" CFLAGS="-w" \
    && make -j"$(nproc)" \
    && test -x ./iec2c

# ─────────────────────────────────────────────────────────────────────────────
# Estagio 2 — runtime do servico de compilacao.
#
# A base e a imagem oficial da Espressif, que traz o ESP-IDF (toolchain
# xtensa-esp32, CMake, ninja e idf.py) ja instalado e um venv Python proprio em
# /opt/esp/python_env. O entrypoint da imagem (/opt/esp/entrypoint.sh) carrega
# export.sh antes de executar o comando, de modo que tanto o uvicorn quanto os
# subprocessos idf.py disparados pelo backend herdam IDF_PATH e PATH corretos.
#
# Assim como o MATIEC, a toolchain entra na imagem apenas como FERRAMENTA
# EXTERNA, executada como processo separado (constitution §10). O preco da
# escolha e o tamanho da imagem (~2-3 GB), aceito em troca do caminho canonico
# da Espressif.
# ─────────────────────────────────────────────────────────────────────────────
FROM espressif/idf:v5.4.1 AS runtime

SHELL ["/bin/bash", "-c"]

COPY --from=matiec-builder /src/matiec/iec2c /usr/local/bin/iec2c
COPY --from=matiec-builder /src/matiec/lib/ /usr/local/share/matiec/lib/

ENV MATIEC_IEC2C_PATH=/usr/local/bin/iec2c \
    MATIEC_LIB_DIR=/usr/local/share/matiec/lib \
    ESP_IDF_PY_PATH=idf.py \
    ESP_PROJECT_TEMPLATE=/app/firmware/esp32-template \
    ESP_BUILD_ROOT=/var/cache/ladderflow/esp-build \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Diretorio de trabalho das compilacoes; no compose recebe um volume nomeado
# para que o build do ESP-IDF seja incremental entre requisicoes (ver Q-6).
#
# chmod 0777: esta imagem roda tanto como root (compose/producao) quanto com
# `--user <uid>:<gid>` arbitrario e nao mapeado no /etc/passwd da imagem
# (suite `slow` da Regra 5 do CLAUDE.md, e `frontend/e2e/rodar.sh`). Um UID
# desconhecido nao pertence a nenhum grupo declarado aqui, entao nem `chown`
# nem `chmod g+rwX` bastam -- soltar "outros" e o unico jeito de garantir
# escrita para um UID que so existe em tempo de execucao, fora do nosso
# controle. Diretorio de cache de build, sem segredo algum dentro; o preco de
# 0777 e aceitavel pelo mesmo raciocinio do resto deste Dockerfile (imagem de
# build/teste, nao a superficie exposta do produto).
RUN mkdir -p "$ESP_BUILD_ROOT" && chmod 0777 "$ESP_BUILD_ROOT"

# QEMU da Espressif (target xtensa/esp32), para dar boot no firmware sem
# hardware (validacao sem ESP32 fisico — ver docs/validacao/). Ferramenta
# externa, mesmo espirito do idf.py: processo separado, nunca importada como
# codigo (constitution §10). Chamada por `backend/scripts/run_qemu.py`.
#
# A imagem `espressif/idf:v5.4.1` ja traz `qemu-xtensa` pre-instalado em
# /opt/esp/tools (verificado); este passo fica explicito mesmo assim, para que
# a dependencia conste do Dockerfile e sobreviva a uma futura troca de imagem
# base que nao inclua a ferramenta. Por isso e idempotente e nao mede
# crescimento perceptivel da imagem (registrado em `docs/validacao/`).
#
# `qemu-system-xtensa` tambem precisa de libsdl2 em tempo de link, mesmo
# rodando headless (`-nographic`); a base da Espressif ja a traz instalada
# (verificado com `ldd`), entao nenhum pacote apt adicional entra aqui.
RUN source /opt/esp/idf/export.sh > /dev/null \
    && python "$IDF_PATH/tools/idf_tools.py" install qemu-xtensa

# rsync e zip: dependencias de scripts/build-deposito.sh, a guarda do deposito
# no INPI. Sem elas, backend/tests/test_deposito.py pula em silencio (skipif
# ferramentas_disponiveis) e o controle mais sensivel do projeto fica sem
# teste no ambiente onde a suite roda.
RUN apt-get update && apt-get install -y --no-install-recommends rsync zip \
    && rm -rf /var/lib/apt/lists/*

# node: mesmo espirito da camada acima -- ferramenta do AMBIENTE DE TESTE, nao
# do produto entregue (spec 004, NFR "sem dependencia nova" no cliente). Sem
# ela, backend/tests/diferencial/executores.py::SimuladorExecutor nao tem como
# executar o segundo executor do arcabouco diferencial -- o simulador em
# TypeScript (frontend/src/ladder/simulacao-cli.ts), empacotado sob demanda
# para um .mjs unico pelo esbuild nativo (que, esse sim, roda sem node) e
# interpretado por este `node`. Sem esta camada, a metrica central do
# trabalho -- divergencia simulador x runtime em C (RF-19/RF-20 da spec 004)
# -- fica sem o segundo lado para medir: o arcabouco existe desde 2026-09-15
# esperando exatamente por isto. `nodejs` do repositorio apt da propria
# imagem base (Ubuntu 24.04 "noble", ver Q-8a do plano 004) e suficiente: o
# shim so precisa de modulos ES e leitura de stdin/stdout, nada que exija uma
# versao mais nova.
RUN apt-get update && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# As dependencias do backend vao para o venv do proprio ESP-IDF — e o
# interpretador que o entrypoint deixa no PATH.
COPY requirements.txt requirements-dev.txt ./
RUN source /opt/esp/idf/export.sh > /dev/null \
    && pip install --no-cache-dir -r requirements-dev.txt

COPY pyproject.toml ./
COPY app/ ./app/
COPY firmware/ ./firmware/

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
