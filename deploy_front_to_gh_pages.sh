#!/bin/bash

# Deploiement du frontend soc360-front-react sur GitHub Pages (branche main, dossier docs/).
# Deux sites distincts (dev et prod) pour appeler chacun leur backend Azure.
#
# Usage (depuis la racine du projet) :
#   ./deploy_front_to_gh_pages.sh            # site DEV (defaut)
#   ./deploy_front_to_gh_pages.sh dev        # site DEV
#   ./deploy_front_to_gh_pages.sh prod       # site PROD (deploie vers soc360-front-react-prod)
#
# Pour le site PROD, definir PROD_PAGES_REPO si le depot du site prod n'est pas
# soc360-front-react-prod : PROD_PAGES_REPO=git@github.com:USER/REPO.git ./deploy_front_to_gh_pages.sh prod

set -euo pipefail

# Vite 8 requiert Node.js 20.19+ ou 22.12+ : on privilégie l'installation nvm épinglée du
# workspace (v22.12.0) puis le PATH.
NODE_VERSION_MIN_PATH="/c/pgm/nvm/v22.12.0"

# Fonction pour trouver npm
find_npm() {
  # Installation nvm épinglée (Node 22.12+, compatible Vite 8)
  for path in \
    "/cygdrive/c/pgm/nvm/v22.12.0/npm.cmd" \
    "/c/pgm/nvm/v22.12.0/npm.cmd" \
    "/cygdrive/c/pgm/nvm/v22.12.0/npm" \
    "/c/pgm/nvm/v22.12.0/npm"; do
    if [ -f "$path" ] && [ -x "$path" ]; then
      echo "$path"
      return 0
    fi
  done
  # Repli sur le PATH (Windows/MobaXterm)
  if command -v npm.cmd >/dev/null 2>&1; then
    echo "npm.cmd"
    return 0
  elif command -v npm >/dev/null 2>&1; then
    echo "npm"
    return 0
  fi
  return 1
}

# Vérifie qu'une version de Node satisfait l'exigence de Vite 8 (20.19+ ou 22.12+).
node_supported() {
  local v="${1#v}" major minor
  [ -n "$v" ] || return 1
  major="${v%%.*}"
  minor="${v#*.}"; minor="${minor%%.*}"
  case "$major" in ''|*[!0-9]*) return 1 ;; esac
  case "$minor" in ''|*[!0-9]*) return 1 ;; esac
  if [ "$major" -eq 20 ]; then
    [ "$minor" -ge 19 ]
  elif [ "$major" -eq 22 ]; then
    [ "$minor" -ge 12 ]
  else
    [ "$major" -ge 23 ]
  fi
}

# Trouver npm
NPM_CMD=$(find_npm)
if [ -z "$NPM_CMD" ]; then
  echo "ERROR: npm introuvable. Veuillez installer Node.js/npm."
  exit 1
fi

# Résoudre le binaire node associé (même dossier que npm) et contrôler sa version.
NODE_DIR="$(dirname "$NPM_CMD")"
if [ -x "$NODE_DIR/node" ]; then
  NODE_BIN="$NODE_DIR/node"
else
  NODE_BIN="node"
fi
NODE_VERSION="$("$NODE_BIN" -v 2>/dev/null || true)"
if ! node_supported "$NODE_VERSION"; then
  echo "ERROR: Node.js ${NODE_VERSION:-introuvable} détecté, mais Vite 8 requiert Node 22.12+ (ou 20.19+)."
  echo "       Utilisez l'installation du workspace : $NODE_VERSION_MIN_PATH (nvm use 22.12.0)."
  exit 1
fi

# Log des chemins utilisés
echo "npm utilisé : $NPM_CMD"
echo "node utilisé : $NODE_BIN ($NODE_VERSION)"

TARGET="${1:-dev}"

case "$TARGET" in
  dev)
    BRANCH_REQUIRED="main"
    VITE_MODE="production"
    OUT_DIR="docs"
    PAGES_URL="https://mzamouneisi.github.io/soc360-front-react/"
    BASE_EXPECTED="/soc360-front-react/"
    ENV_FILE=".env.production"
    ;;
  prod)
    BRANCH_REQUIRED="main"
    VITE_MODE="production-prod"
    OUT_DIR="dist-prod"
    PAGES_URL="https://mzamouneisi.github.io/soc360-front-react-prod/"
    BASE_EXPECTED="/soc360-front-react-prod/"
    ENV_FILE=".env.production-prod"
    PROD_PAGES_REPO="${PROD_PAGES_REPO:-git@github.com:mzamouneisi/soc360-front-react-prod.git}"
    ;;
  *)
    echo "ERROR: Cible inconnue '$TARGET' (valeurs possibles : dev, prod)."
    exit 1
    ;;
esac

SCRIPT_NAME="$(basename "$0")"
LOG_FILE="${SCRIPT_NAME%.sh}.log"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

if [ ! -f "package.json" ]; then
  log "ERROR: package.json introuvable. Lancez ce script depuis la racine du projet soc360-front-react."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  log "ERROR: Fichier '$ENV_FILE' introuvable. Creez-le (voir DOC_DEPLOY_FRONT_TO_GH_PAGES.md)."
  exit 1
fi

BRANCH_NAME="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH_NAME" != "$BRANCH_REQUIRED" ]; then
  log "ERROR: GitHub Pages est configuré sur la branche '$BRANCH_REQUIRED' (branche actuelle : '$BRANCH_NAME')."
  exit 1
fi

# Vérification de git
if ! command -v git >/dev/null 2>&1; then
  log "ERROR: git introuvable."
  exit 1
fi

log "=== Deploiement GitHub Pages '$TARGET' (branche '$BRANCH_NAME', dossier '$OUT_DIR/') ==="
log "URL publique : $PAGES_URL"
log "npm utilisé : $NPM_CMD"

log "Lint..."
$NPM_CMD run lint

log "Tests..."
$NPM_CMD test

log "Build vers '$OUT_DIR/' (base et URL API lues dans $ENV_FILE, mode $VITE_MODE)..."
if [ "$TARGET" = "prod" ]; then
  $NPM_CMD run build:pages:prod
else
  $NPM_CMD run build:pages
fi

if [ ! -f "$OUT_DIR/index.html" ]; then
  log "ERROR: Build invalide : $OUT_DIR/index.html absent."
  exit 1
fi

BASE_OK="$(grep -o 'src="[^"]*"\|href="[^"]*"' "$OUT_DIR/index.html" | grep -c "$BASE_EXPECTED" || true)"
if [ "$BASE_OK" -lt 1 ]; then
  log "ERROR: Le build n'utilise pas la base '$BASE_EXPECTED'. Verifier $ENV_FILE."
  exit 1
fi

if [ "$TARGET" = "prod" ]; then
  log "Copie de '$OUT_DIR/' vers le depot du site prod ($PROD_PAGES_REPO)..."
  TMP_DIR="$(mktemp -d)"
  git clone --quiet --depth 1 "$PROD_PAGES_REPO" "$TMP_DIR/pages-prod" || {
    log "ERROR: Clonage impossible de '$PROD_PAGES_REPO' (verifiez l'URL et les droits)."
    exit 1
  }
  rm -rf "$TMP_DIR/pages-prod/docs"
  cp -r "$OUT_DIR" "$TMP_DIR/pages-prod/docs"
  (
    cd "$TMP_DIR/pages-prod"
    git add docs/
    if git diff --cached --quiet; then
      log "Aucun changement dans docs/ : rien a pousser."
    else
      git commit -m "GitHub Pages prod : build docs/ ($(date +'%Y-%m-%d %H:%M:%S'))"
      git push origin "$BRANCH_REQUIRED"
      log "Push effectue."
    fi
  )
  rm -rf "$TMP_DIR"
else
  log "Envoi du dossier docs/ vers git..."
  git add docs/
  if git diff --cached --quiet; then
    log "Aucun changement dans docs/ : rien a pousser."
  else
    git commit -m "GitHub Pages : build docs/ ($(date +'%Y-%m-%d %H:%M:%S'))"
    git push origin "$BRANCH_NAME"
    log "Push effectue."
  fi
fi

log "Termine. Le site '$TARGET' est en ligne quelques instants plus tard :"
log "  $PAGES_URL"
