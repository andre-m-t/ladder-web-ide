#!/usr/bin/env bash
#
# Roda o teste ponta a ponta (e2e) do editor Ladder — spec 002, tarefa #14,
# CA-8 (RF-13, persistência do diagrama). Contra `vite preview`, num
# contêiner Playwright avulso, SEM publicar porta nenhuma (Regra 5 do
# CLAUDE.md: as portas 8000 e 5173 já estão ocupadas por outros projetos
# nesta máquina; aqui a 4173 fica só dentro do contêiner, sem `-p`).
#
# O que é verificado:
#   - CA-8: montar o diagrama IO_ESPELHO pela UI (arrastar contato NA e
#     bobina, vincular às variáveis "entrada" %IX0.1 e "saida" %QX0.1),
#     conferir "Problemas (0)", recarregar a página e confirmar que os
#     mesmos elementos continuam nas mesmas células e que o localStorage
#     guarda o envelope `{ versao: 1, diagrama }` (frontend/src/ladder/
#     persistencia.ts); a aba ST continua com o programa de exemplo intacto.
#   - Caminho de descarte: um `localStorage['ladderflow:diagrama']`
#     corrompido volta, ao recarregar, a um diagrama vazio (um degrau em
#     branco), com o aviso de descarte registrado no console da IDE.
#
# O back-end fica FORA do ar de propósito: a chamada a `/health` falha e a
# compilação não é exercida — isso é esperado, RF-13 não depende do
# servidor (cf. §6 da Constituição).
#
# Esta pasta (frontend/e2e/) fica FORA do pacote de depósito do INPI —
# scripts/build-deposito.sh só empacota frontend/src.
#
# Uso (a partir da raiz do repositório):
#   bash frontend/e2e/rodar.sh
#
# Infraestrutura pressuposta, já disponível localmente:
#   - imagem mcr.microsoft.com/playwright:v1.55.0-noble (node + navegadores,
#     nenhuma outra imagem é baixada);
#   - frontend/node_modules já instalado (o `vite build` roda sem rede).
#
# Instalar @playwright/test exige rede (registro npm); rodar o teste, não.
# Por isso são DOIS `docker run`: o primeiro, com rede, só instala
# frontend/e2e/node_modules; o segundo, com `--network none`, faz o build,
# sobe o preview e roda os testes, isolado da rede.

set -euo pipefail

IMAGEM="mcr.microsoft.com/playwright:v1.55.0-noble"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$RAIZ"

echo "==> [1/2] frontend/e2e: instalando @playwright/test (com rede, só aqui)"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -v "$RAIZ:/repo" \
  -w /repo/frontend/e2e \
  "$IMAGEM" \
  npm install

echo "==> [2/2] build + vite preview + playwright test (sem rede, sem publicar porta)"
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  --network none \
  -v "$RAIZ:/repo" \
  -w /repo/frontend \
  "$IMAGEM" \
  bash -lc '
    set -euo pipefail

    echo "-- vite build"
    npx vite build

    echo "-- vite preview em 127.0.0.1:4173 (segundo plano)"
    npx vite preview --host 127.0.0.1 --port 4173 --strictPort &
    pid_preview=$!
    trap "kill \"$pid_preview\" 2>/dev/null || true" EXIT

    echo "-- esperando 127.0.0.1:4173 responder"
    pronto=""
    for _ in $(seq 1 60); do
      if (exec 3<>/dev/tcp/127.0.0.1/4173) 2>/dev/null; then
        exec 3<&- 3>&- || true
        pronto="1"
        break
      fi
      sleep 0.5
    done
    if [ -z "$pronto" ]; then
      echo "vite preview não respondeu em 127.0.0.1:4173 a tempo" >&2
      exit 1
    fi

    echo "-- playwright test (frontend/e2e)"
    cd e2e
    npx playwright test
  '
