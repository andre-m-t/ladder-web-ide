#!/usr/bin/env bash
#
# deploy.sh — sobe o LadderFlow em modo de produção/demonstração na VPS.
#
# Uso (a partir de qualquer diretório):
#   deploy/deploy.sh
#
# Pré-requisitos:
#   - deploy/.env preenchido: cp deploy/.env.example deploy/.env && editar
#   - Docker e Docker Compose v2 instalados
#   - DNS do domínio já apontando para esta VPS (ver deploy/README.md, §2)
#
# O que faz:
#   1. Confere deploy/.env e as variáveis obrigatórias.
#   2. Avisa (sem abortar) se as portas do host já parecem ocupadas.
#   3. `docker compose ... up -d --build` com o compose de produção — portas
#      publicadas só em 127.0.0.1, vindas estritamente de deploy/.env.
#   4. Espera o backend ficar healthy e testa /health.
#   5. Imprime o bloco pronto para colar no Caddyfile do host (§4 do README) —
#      este script NÃO toca no Caddy do host, que serve outros projetos.
#
# Não é o depósito de código do INPI: scripts/build-deposito.sh não inclui
# deploy/ (allowlist explícita), então este arquivo não muda o pacote.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --project-directory "$ROOT" "$@"
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "erro: $ENV_FILE não existe." >&2
  echo "  cp deploy/.env.example deploy/.env" >&2
  echo "  # edite DOMINIO, PUBLIC_URL, portas e CORS_ORIGINS" >&2
  exit 1
fi

# Carregado só para as checagens de pré-voo abaixo — `docker compose` lê
# --env-file por conta própria, isto não substitui isso.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

for var in DOMINIO PUBLIC_URL BACKEND_PORT FRONTEND_PORT CORS_ORIGINS; do
  if [[ -z "${!var:-}" ]]; then
    echo "erro: variável obrigatória ausente em $ENV_FILE: $var" >&2
    exit 1
  fi
done

echo "=== Pré-voo ==="
for porta in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${porta}\$"; then
    echo "aviso: a porta ${porta} já parece estar em uso no host — 'docker compose up' vai falhar se for verdade." >&2
  fi
done
if command -v df >/dev/null 2>&1; then
  df -h /var/lib/docker 2>/dev/null || true
fi

echo
echo "=== Subindo ${DOMINIO} (backend em 127.0.0.1:${BACKEND_PORT}, frontend em 127.0.0.1:${FRONTEND_PORT}) ==="
compose up -d --build

echo
echo "=== Aguardando o backend ficar healthy (build frio pode levar minutos) ==="
BACKEND_CID="$(compose ps -q backend)"
TENTATIVAS=60
while [[ "$(docker inspect -f '{{.State.Health.Status}}' "$BACKEND_CID" 2>/dev/null || echo desconhecido)" != "healthy" ]]; do
  TENTATIVAS=$((TENTATIVAS - 1))
  if [[ "$TENTATIVAS" -le 0 ]]; then
    echo "aviso: o backend não ficou healthy a tempo — confira: docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs backend" >&2
    break
  fi
  sleep 10
done

echo
echo "=== Contêineres ==="
compose ps

echo
echo "=== Teste local (127.0.0.1:${BACKEND_PORT}/health) ==="
curl -sf "http://127.0.0.1:${BACKEND_PORT}/health" && echo || echo "aviso: /health ainda não respondeu — confira os logs." >&2

cat <<EOF

=== Próximo passo (manual): Caddy do host ===

Este script não mexe no Caddy do host de propósito — ele serve outros
projetos na mesma VPS. Gere o bloco e cole no fim de /etc/caddy/Caddyfile:

  sed -e "s/__DOMINIO__/${DOMINIO}/g" \\
      -e "s/__BACKEND_PORT__/${BACKEND_PORT}/g" \\
      -e "s/__FRONTEND_PORT__/${FRONTEND_PORT}/g" \\
      "${SCRIPT_DIR}/Caddyfile.exemplo"

Troque SUBSTITUA_PELO_HASH pelo resultado de "caddy hash-password", depois:

  caddy validate --config /etc/caddy/Caddyfile
  systemctl reload caddy

Detalhes em deploy/README.md. Para remover tudo depois: deploy/remover.sh
EOF
