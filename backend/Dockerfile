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
RUN mkdir -p "$ESP_BUILD_ROOT"

WORKDIR /app

# As dependencias do backend vao para o venv do proprio ESP-IDF — e o
# interpretador que o entrypoint deixa no PATH.
COPY requirements.txt requirements-dev.txt ./
RUN source /opt/esp/idf/export.sh > /dev/null \
    && pip install --no-cache-dir -r requirements-dev.txt

COPY pyproject.toml ./
COPY app/ ./app/
COPY firmware/ ./firmware/
COPY tests/ ./tests/

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
