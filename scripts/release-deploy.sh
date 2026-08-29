#!/usr/bin/env bash
# Deploy an official tagged release to a Forge environment.
# Usage: ./scripts/release-deploy.sh <di|legacy> <semver> [development|staging|production]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP="${1:-}"
VERSION="${2:-}"
ENV="${3:-development}"

if [[ -z "$APP" || -z "$VERSION" ]]; then
  echo "Usage: $0 <di|legacy> <semver> [environment]"
  exit 1
fi

case "$APP" in
  di)
    PREFIX="di-v"
    APP_DIR="$ROOT/apps/delivery-intelligence"
    ;;
  legacy)
    PREFIX="legacy-v"
    APP_DIR="$ROOT"
    ;;
  *)
    echo "ERROR: app must be di or legacy"
    exit 1
    ;;
esac

TAG="${PREFIX}${VERSION}"

if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "ERROR: tag $TAG not found. Fetch tags: git fetch --tags"
  exit 1
fi

if ! command -v forge >/dev/null 2>&1; then
  echo "ERROR: forge CLI not found"
  exit 1
fi

echo "==> Checking out $TAG"
git fetch --tags origin 2>/dev/null || true
git checkout "$TAG"

SHA="$(git rev-parse --short HEAD)"
echo "    Commit: $SHA"
echo "    Env:    $ENV"
echo "    App:    $APP"

forge settings set usage-analytics false >/dev/null 2>&1 || true

if [[ "$APP" == "di" ]]; then
  cd "$APP_DIR"
  npm install
  npm test
  npm run build
  forge deploy -e "$ENV" --non-interactive
else
  cd "$ROOT"
  npm install
  npm run lint:code
  npm test
  npm run build
  forge deploy -e "$ENV" --non-interactive
fi

echo ""
echo "Deployed $TAG ($SHA) → Forge $ENV"
echo "Update docs/RELEASES.md Currently deployed row."
echo "Return to main when done: git checkout main"
