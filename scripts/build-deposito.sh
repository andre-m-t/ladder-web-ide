#!/usr/bin/env bash
#
# build-deposito.sh — monta o pacote de código-fonte autoral do LadderFlow para
# depósito de programa de computador no INPI (via NIT).
#
# Gera um .zip em dist/deposito/, calcula o SHA-256 e imprime a árvore do que
# foi incluído, para conferência manual antes do envio.
#
# O que entra no pacote é decidido por uma ALLOWLIST explícita (abaixo), não por
# exclusão — mais seguro para um depósito. Ajuste INCLUDE_* conforme o código do
# projeto evoluir. Os EXCLUDES servem apenas como defesa em profundidade.
#
# Dependências: bash, rsync, zip, sha256sum, find.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y-%m-%d)"
OUT_DIR="dist/deposito"
ZIP_PATH="$OUT_DIR/ladderflow-fonte-$STAMP.zip"

# --- Allowlist: apenas código-fonte autoral ------------------------------------
INCLUDE_DIRS=(
  "frontend/src"
  "backend/app"
  # Projeto ESP-IDF autoral (glue entre o C gerado e os GPIOs do ESP32).
  "backend/firmware"
)

INCLUDE_FILES=(
  "README.md"
  "THIRD_PARTY.md"
  "docker-compose.yml"
  ".env.example"
  "frontend/package.json"
  "frontend/index.html"
  "frontend/vite.config.ts"
  "frontend/tsconfig.json"
  "frontend/Dockerfile"
  "backend/pyproject.toml"
  "backend/requirements.txt"
  "backend/requirements-dev.txt"
  "backend/Dockerfile"
)

# --- Nunca incluir (defesa em profundidade) -----------------------------------
EXCLUDES=(
  --exclude ".git"          --exclude "node_modules"  --exclude ".venv"
  --exclude "venv"          --exclude "__pycache__"   --exclude "*.pyc"
  --exclude "dist"          --exclude "build"         --exclude "*.egg-info"
  --exclude "vendor"        --exclude "third_party"   --exclude "matiec"
  --exclude "toolchain"
  --exclude "*.bin" --exclude "*.elf" --exclude "*.hex"
  --exclude "*.o"   --exclude "*.a"   --exclude "*.so"
  --exclude "package-lock.json" --exclude "pnpm-lock.yaml" --exclude "yarn.lock"
  --exclude "poetry.lock"       --exclude "uv.lock"       --exclude "Pipfile.lock"
)

# --- Monta o staging ---------------------------------------------------------
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

missing=()

for d in "${INCLUDE_DIRS[@]}"; do
  if [[ -d "$d" ]]; then
    mkdir -p "$STAGING/$(dirname "$d")"
    rsync -a "${EXCLUDES[@]}" "$d" "$STAGING/$(dirname "$d")/"
  else
    missing+=("$d/")
    echo "aviso: diretório ausente, ignorado: $d" >&2
  fi
done

for f in "${INCLUDE_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    mkdir -p "$STAGING/$(dirname "$f")"
    cp "$f" "$STAGING/$f"
  fi
done

if [[ -z "$(find "$STAGING" -type f -print -quit)" ]]; then
  echo "erro: nenhum arquivo autoral encontrado — nada a empacotar." >&2
  exit 1
fi

# --- Gera o pacote ---------------------------------------------------------
mkdir -p "$OUT_DIR"
rm -f "$ZIP_PATH" "$ZIP_PATH.sha256"
( cd "$STAGING" && zip -r -X -q "$ROOT/$ZIP_PATH" . )

SHA="$(sha256sum "$ZIP_PATH" | awk '{print $1}')"
echo "$SHA  $(basename "$ZIP_PATH")" > "$ZIP_PATH.sha256"

# --- Relatório para conferência manual -----------------------------------
echo
echo "=== Conteúdo incluído no pacote ==="
( cd "$STAGING" && find . -type f | sed 's|^\./||' | sort )

if [[ ${#missing[@]} -gt 0 ]]; then
  echo
  echo "--- Itens da allowlist ainda ausentes no repositório ---"
  printf '  %s\n' "${missing[@]}"
fi

echo
echo "=== Pacote gerado ==="
echo "arquivo : $ZIP_PATH"
echo "tamanho : $(du -h "$ZIP_PATH" | cut -f1)"
echo "SHA-256 : $SHA"
echo "hash    : $ZIP_PATH.sha256"
echo
echo "Confira a árvore acima antes de enviar ao NIT."
