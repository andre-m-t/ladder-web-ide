#!/usr/bin/env bash
#
# build-deposito.sh — monta o pacote de código-fonte autoral do LadderFlow para
# depósito de programa de computador no INPI (via NIT).
#
# Monta o staging, AUDITA o conteúdo contra um manifesto obrigatório e uma
# lista de artefatos proibidos e só então gera o .zip em dist/deposito/,
# calcula o SHA-256 e imprime a árvore do que foi incluído.
#
# O que entra no pacote é decidido por uma ALLOWLIST explícita (abaixo), não por
# exclusão — mais seguro para um depósito. Ajuste INCLUDE_* conforme o código do
# projeto evoluir. Os EXCLUDES servem apenas como defesa em profundidade — quem
# de fato barra material indevido é a auditoria (REQUIRED_FILES/FORBIDDEN_*).
#
# O que entra, e por quê
# -----------------------
# O depósito é do PROGRAMA DE COMPUTADOR, não do projeto. Entram o código-fonte
# autoral que compõe o software executável (frontend/src, backend/app, e o
# firmware/runtime em backend/firmware — inclusive host/Makefile, que compila o
# MESMO runtime para rodar no host em vez do ESP32: é outro alvo de build do
# mesmo programa, não teste) e os arquivos de build/configuração necessários
# para reproduzi-lo (os *.json/*.toml/Dockerfile/docker-compose.yml listados em
# INCLUDE_FILES). README.md e THIRD_PARTY.md também entram, mas não como código:
# o primeiro documenta como reproduzir o executável a partir do pacote, e o
# segundo é a identificação de componentes de terceiro exigida pelo INPI —
# ambos acompanham o programa por norma do próprio depósito, não por serem
# software.
#
# Não entram specs, documentação de método, testes automatizados, scripts de
# apoio (como este), código gerado (saída do iec2c/MATIEC, sdkconfig e demais
# artefatos de build do ESP-IDF) nem código de terceiros — este só é
# identificado em THIRD_PARTY.md, nunca copiado para dentro do pacote.
#
# Regra para arquivo novo: "faz parte do software entregue e foi escrito por
# nós?" Se sim, entra na allowlist (INCLUDE_DIRS/INCLUDE_FILES) e, se for
# crítico para o programa compilar/rodar, também em REQUIRED_FILES. Se não —
# spec, doc, teste, script — fica de fora, mesmo que more dentro de um
# INCLUDE_DIR. Hoje não há teste nem script dentro de backend/firmware; se um
# dia entrar, precisa de EXCLUDE próprio ou mudar de lugar, porque a allowlist
# atual o levaria junto por estar sob o mesmo diretório.
#
# Uso:
#   build-deposito.sh                 # monta, audita e gera o .zip + .sha256
#   build-deposito.sh --verificar     # monta, audita e sai sem gerar o .zip
#   build-deposito.sh --check         # sinônimo de --verificar (uso em CI)
#
# Dependências: bash, rsync, zip, sha256sum, find.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="empacotar"
for arg in "$@"; do
  case "$arg" in
    --verificar|--check)
      MODE="verificar"
      ;;
    *)
      echo "uso: $(basename "$0") [--verificar|--check]" >&2
      exit 2
      ;;
  esac
done

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
  # Saída de build do ESP-IDF quando alguém roda idf.py direto no template.
  --exclude "generated"    --exclude "managed_components"
  --exclude "sdkconfig"    --exclude "sdkconfig.old"
  --exclude "dependencies.lock" --exclude "*.map"
)

# --- Manifesto obrigatório: código autoral que TEM de estar no pacote --------
# Ausência de qualquer um destes é um erro fatal — não um aviso. Se o arquivo
# foi renomeado ou movido, esta lista precisa acompanhar (e o script falha até
# lá, o que é o comportamento desejado: silêncio aqui seria pior).
REQUIRED_FILES=(
  "backend/firmware/esp32-template/CMakeLists.txt"
  "backend/firmware/esp32-template/sdkconfig.defaults"
  "backend/firmware/esp32-template/main/CMakeLists.txt"
  "backend/firmware/esp32-template/main/app_main.c"
  "backend/firmware/esp32-template/main/plc_glue.c"
  "backend/firmware/esp32-template/main/plc_glue.h"
  "backend/firmware/esp32-template/main/plc_io_map.h"
  # Camada de abstracao de I/O: a interface e as duas implementacoes atras dela
  # (ESP32 e stub em memoria). E o que permite o mesmo runtime autoral compilar
  # para o dispositivo e para o host.
  "backend/firmware/esp32-template/main/plc_hal.h"
  "backend/firmware/esp32-template/main/plc_hal_stub.h"
  "backend/firmware/esp32-template/main/plc_hal_esp32.c"
  "backend/firmware/esp32-template/main/plc_hal_stub.c"
  # Runtime executavel no host: o driver que religa o C do iec2c ao runtime a
  # cada execucao, e o laco de ciclos que fala o contrato de
  # docs/validacao/contrato-runtime-host.md.
  "backend/firmware/esp32-template/main/plc_host_runner.c"
  "backend/firmware/esp32-template/main/plc_host_cycle_runner.c"
  "backend/firmware/esp32-template/host/Makefile"
  "backend/app/services/matiec.py"
  "backend/app/services/esp32.py"
  "backend/app/services/pipeline.py"
  "backend/app/api/compile.py"
  "backend/app/main.py"
  "frontend/src/lib/api.ts"
)

# --- Proibidos: artefato de terceiro ou gerado que NÃO pode entrar -----------
# Nomes exatos de arquivo ou diretório (saída do iec2c/MATIEC, configuração
# gerada pelo ESP-IDF, artefatos de build).
FORBIDDEN_NAMES=(
  "POUS.c" "POUS.h" "Config0.c" "Config0.h" "Res0.c" "Res0.h"
  "GLOBALS.h" "LOCATED_VARIABLES.h" "accessor.h"
  "sdkconfig" "sdkconfig.old" "dependencies.lock"
  "build" "generated" "managed_components"
)

# Padrões glob — mesma natureza, nome varia (versão do MATIEC, arquiteturas).
FORBIDDEN_GLOBS=(
  "iec_std_lib*.h" "iec_types*.h"
  "*.bin" "*.elf" "*.map" "*.o" "*.a"
)

# --- Contaminação da árvore autoral: nomes que nunca podem estar no repo -----
# Subconjunto de FORBIDDEN_NAMES/GLOBS verificado direto na ÁRVORE DE ORIGEM, e
# não só no staging. A razão é que os EXCLUDES do rsync removem `generated` (e
# afins) antes de a auditoria olhar — bom para o pacote, cego para o problema:
# se saída do iec2c ou cabeçalho do MATIEC aparecer dentro do código autoral, o
# certo é FALHAR ALTO, não limpar em silêncio. Silêncio aqui esconderia
# exatamente o que o depósito no INPI precisa que ninguém esconda.
#
# Resíduo comum de build local (`build/`, `sdkconfig`, `*.o`) fica de fora desta
# lista de propósito: é esperado na máquina de quem desenvolve e os EXCLUDES dão
# conta. O que não é esperado é código de terceiro convivendo com o autoral.
CONTAMINACAO_NAMES=(
  "POUS.c" "POUS.h" "Config0.c" "Config0.h" "Res0.c" "Res0.h"
  "GLOBALS.h" "LOCATED_VARIABLES.h" "accessor.h" "generated"
)
CONTAMINACAO_GLOBS=( "iec_std_lib*.h" "iec_types*.h" )

verificar_origem() {
  local com_erro=0
  local achados

  for d in "${INCLUDE_DIRS[@]}"; do
    [[ -d "$d" ]] || continue
    for nome in "${CONTAMINACAO_NAMES[@]}" ; do
      achados="$(find "$d" -name "$nome" -not -path "*/node_modules/*" -print)"
      if [[ -n "$achados" ]]; then
        echo "erro: artefato de terceiro dentro da árvore autoral (nome: $nome):" >&2
        echo "$achados" >&2
        com_erro=1
      fi
    done
    for glob in "${CONTAMINACAO_GLOBS[@]}"; do
      achados="$(find "$d" -name "$glob" -not -path "*/node_modules/*" -print)"
      if [[ -n "$achados" ]]; then
        echo "erro: artefato de terceiro dentro da árvore autoral (padrão: $glob):" >&2
        echo "$achados" >&2
        com_erro=1
      fi
    done
  done

  if [[ "$com_erro" -ne 0 ]]; then
    echo >&2
    echo "a árvore autoral está contaminada — mova ou remova os arquivos acima." >&2
    echo "(o pacote até sairia limpo, graças aos EXCLUDES; o problema é o repositório.)" >&2
    exit 1
  fi
}

# --- Auditoria: roda sobre o staging, antes do zip ---------------------------
# Aborta o script com exit 1 e mensagem apontando exatamente o que faltou ou o
# que entrou indevidamente. Não é aviso — não há "empacotar mesmo assim".
verificar_staging() {
  local staging="$1"
  local com_erro=0

  for f in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$staging/$f" ]]; then
      echo "erro: arquivo obrigatório ausente do pacote de depósito: $f" >&2
      com_erro=1
    fi
  done

  local achados
  for nome in "${FORBIDDEN_NAMES[@]}"; do
    achados="$(find "$staging" -name "$nome" -print)"
    if [[ -n "$achados" ]]; then
      echo "erro: artefato proibido no pacote de depósito (nome: $nome):" >&2
      echo "$achados" | sed "s|^$staging/||" >&2
      com_erro=1
    fi
  done

  for glob in "${FORBIDDEN_GLOBS[@]}"; do
    achados="$(find "$staging" -name "$glob" -print)"
    if [[ -n "$achados" ]]; then
      echo "erro: artefato proibido no pacote de depósito (padrão: $glob):" >&2
      echo "$achados" | sed "s|^$staging/||" >&2
      com_erro=1
    fi
  done

  if [[ "$com_erro" -ne 0 ]]; then
    echo >&2
    echo "auditoria do pacote de depósito falhou — corrija antes de empacotar." >&2
    exit 1
  fi

  echo "auditoria do pacote de depósito: OK — manifesto completo, nenhum artefato proibido."
}

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

# --- Audita antes de empacotar -----------------------------------------------
verificar_origem
verificar_staging "$STAGING"

if [[ "$MODE" == "verificar" ]]; then
  echo
  echo "=== Conteúdo do staging (--verificar, nenhum .zip gerado) ==="
  ( cd "$STAGING" && find . -type f | sed 's|^\./||' | sort )
  echo
  echo "verificação concluída com sucesso."
  exit 0
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
