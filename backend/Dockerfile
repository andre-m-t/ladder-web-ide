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
# Ponto de extensao: a toolchain do ESP32 (C -> firmware) entra aqui, como um
# terceiro estagio ou uma imagem base da Espressif, quando a etapa de geracao
# de firmware for implementada.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
        libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=matiec-builder /src/matiec/iec2c /usr/local/bin/iec2c
COPY --from=matiec-builder /src/matiec/lib/ /usr/local/share/matiec/lib/

ENV MATIEC_IEC2C_PATH=/usr/local/bin/iec2c \
    MATIEC_LIB_DIR=/usr/local/share/matiec/lib \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

COPY pyproject.toml ./
COPY app/ ./app/
COPY tests/ ./tests/

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
