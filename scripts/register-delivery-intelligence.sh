#!/usr/bin/env bash
# One-time Forge setup for Delivery Intelligence for Jira (separate app).
# Safe to re-run: skips register if app.id already exists in manifest.yml.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/apps/delivery-intelligence"
MANIFEST="$APP_DIR/manifest.yml"

echo "==> Delivery Intelligence Forge setup"
echo "    Directory: $APP_DIR"

if ! command -v forge >/dev/null 2>&1; then
  echo "ERROR: forge CLI not found. Install: npm install -g @forge/cli"
  exit 1
fi

forge settings set usage-analytics false >/dev/null 2>&1 || true

echo "==> Forge account"
forge whoami

cd "$APP_DIR"

echo "==> Install dependencies"
npm install
npm run build

if grep -q "^  id: ari:cloud:ecosystem::app/" "$MANIFEST" 2>/dev/null; then
  echo "==> App already registered (app.id present in manifest.yml)"
else
  echo "==> Register new Forge app"
  SPACE_ID="${FORGE_DEVELOPER_SPACE_ID:-}"
  if [[ -z "$SPACE_ID" ]]; then
    SPACE_ID="$(forge developer-spaces list 2>/dev/null | rg -o '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
  fi
  if [[ -z "$SPACE_ID" ]]; then
    echo "ERROR: Could not detect Developer Space ID."
    echo "Run: forge developer-spaces list"
    echo "Then: export FORGE_DEVELOPER_SPACE_ID=<id>"
    exit 1
  fi
  echo "    Developer Space: $SPACE_ID"
  forge register "Delivery Intelligence for Jira" \
    --developer-space-id "$SPACE_ID" \
    --accept-terms
fi

echo "==> Lint manifest"
forge lint --fix
forge lint

echo "==> Deploy to development"
forge deploy -e development --non-interactive

echo "==> Install / upgrade on site"
SITE="${FORGE_INSTALL_SITE:-one-atlas-qzzp.atlassian.net}"
forge install --upgrade -e development --site "$SITE" --product jira --non-interactive 2>/dev/null || \
  forge install -e development --site "$SITE" --product jira --non-interactive

echo ""
echo "Done. Open a Jira Software project → Apps → Delivery Intelligence."
echo "App ID is in: $MANIFEST"
