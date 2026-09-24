#!/usr/bin/env bash
#
# remover.sh — derruba o LadderFlow e devolve a VPS ao estado anterior.
#
# Uso (a partir de qualquer diretório):
#   deploy/remover.sh
#
# O que faz:
#   1. `docker compose ... down -v --rmi all` — contêineres, rede, o volume
#      nomeado (esp-build-cache) e as duas imagens construídas por este
#      projeto (ladderflow-backend:dev, ladderflow-frontend:prod).
#   2. Remove as imagens BASE de terceiros baixadas só para este deploy
#      (espressif/idf:v5.4.1, node:22-bookworm-slim, caddy:2-alpine) — SÓ SE
#      nenhum outro contêiner do host ainda as usa, para não afetar os
#      projetos vizinhos na mesma VPS.
#   3. Lembra os dois passos manuais que este script não faz: tirar o bloco
#      do Caddy do host e apagar deploy/.env.
#
# Propositalmente NÃO roda `docker system prune` nem `docker builder prune`:
# são globais e apagariam cache de build de outros projetos no mesmo host.

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
  echo "Se o deploy foi feito com um .env que você já apagou, recrie-o com" >&2
  echo "os mesmos DOMINIO/portas antes de rodar este script — o compose" >&2
  echo "precisa dele para saber quais portas/nomes derrubar." >&2
  exit 1
fi

echo "=== Derrubando contêineres, rede, volume e imagens do projeto ==="
compose down -v --rmi all

# Imagens base de terceiros baixadas pelo build. Só removidas se nenhum
# outro contêiner (de qualquer projeto no host) ainda as usa — critério
# objetivo, não "eu acho que não usa".
BASES=(
  "espressif/idf:v5.4.1"
  "node:22-bookworm-slim"
  "caddy:2-alpine"
)

echo
echo "=== Imagens base de terceiros ==="
for img in "${BASES[@]}"; do
  if ! docker image inspect "$img" >/dev/null 2>&1; then
    echo "  $img — já não está no disco, nada a fazer."
    continue
  fi
  EM_USO="$(docker ps -a --filter "ancestor=$img" --format '{{.Names}}' | tr '\n' ' ')"
  if [[ -n "${EM_USO// /}" ]]; then
    echo "  $img — MANTIDA: em uso por outro contêiner ($EM_USO)."
    continue
  fi
  echo "  $img — removendo (nenhum outro contêiner a usa)..."
  docker image rm "$img"
done

echo
echo "=== Verificação ==="
RESTANTES="$(docker ps -a --filter 'name=ladderflow' --format '{{.Names}}')"
if [[ -n "$RESTANTES" ]]; then
  echo "aviso: ainda existem contêineres com 'ladderflow' no nome:" >&2
  echo "$RESTANTES" >&2
else
  echo "OK: nenhum contêiner 'ladderflow' restante."
fi

IMAGENS_RESTANTES="$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^ladderflow-' || true)"
if [[ -n "$IMAGENS_RESTANTES" ]]; then
  echo "aviso: ainda existem imagens ladderflow-* no disco:" >&2
  echo "$IMAGENS_RESTANTES" >&2
else
  echo "OK: nenhuma imagem ladderflow-* restante."
fi

cat <<'EOF'

=== Falta fazer manualmente (fora do Docker; este script não mexe nisso) ===

  1. Remova o bloco do domínio colado em /etc/caddy/Caddyfile (o que veio
     de deploy/Caddyfile.exemplo).
  2. caddy validate --config /etc/caddy/Caddyfile
  3. systemctl reload caddy
  4. Apague deploy/.env se não for repetir o teste — não é versionado e
     guarda o domínio e a configuração deste deploy.

NÃO rode "docker system prune" nem "docker builder prune -af" neste
servidor: são globais e apagam cache de build de outros projetos no host.
EOF
