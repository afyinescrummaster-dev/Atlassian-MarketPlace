#!/usr/bin/env bash
# Deploy a Forge app from a clean, origin-visible Git commit and record the revision.
# Usage: ./scripts/forge-deploy.sh <di|legacy> [development|staging|production]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/forge-common.sh
source "$ROOT/scripts/lib/forge-common.sh"
cd "$ROOT"

APP="${1:-}"
ENV="${2:-development}"

if [[ -z "$APP" ]]; then
  echo "Usage: $0 <di|legacy> [environment]" >&2
  exit 1
fi

resolve_app "$APP"
APP_DIR="$ROOT/$APP_DIR_REL"

require_clean_tree "$ROOT"

if ! command -v forge >/dev/null 2>&1 && [[ ! -x "$HOME/.local/bin/forge" ]]; then
  echo "ERROR: forge CLI not found" >&2
  exit 1
fi

BRANCH="$(git branch --show-current || echo detached)"
SHA_FULL="$(git rev-parse HEAD)"
SHA_SHORT="$(git rev-parse --short=12 HEAD)"

require_origin_sha "$ROOT" "$SHA_FULL" "$BRANCH"

echo "==> Current recorded deploy for $APP $ENV"
python3 "$ROOT/scripts/lib/deployment_history.py" current --product "$APP" --env "$ENV" || true
echo ""
echo "==> About to deploy"
echo "    Product: $APP_NAME"
echo "    Branch:  $BRANCH"
echo "    SHA:     $SHA_FULL"
echo "    Env:     $ENV"
echo ""

export PATH="$HOME/.local/bin:$PATH"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

forge settings set usage-analytics false >/dev/null 2>&1 || true

LOG="$(mktemp)"
cleanup() { rm -f "$LOG"; }
trap cleanup EXIT

if [[ "$APP" == "di" ]]; then
  cd "$APP_DIR"
  npm install
  npm test
  npm run build
  forge lint
  forge deploy -e "$ENV" --non-interactive | tee "$LOG"
else
  cd "$ROOT"
  npm install
  npm run lint:code
  npm test
  npm run build
  forge lint
  forge deploy -e "$ENV" --non-interactive | tee "$LOG"
fi

VERSION="$(parse_forge_version "$LOG")"
REVISION="$(deployment_revision_name "$APP" "$ENV" "$VERSION")"

cd "$ROOT"
create_and_push_deploy_tag "$ROOT" "$REVISION" "$SHA_FULL" \
  "Forge $APP $ENV $VERSION from $SHA_FULL"

RESULT="Deployed from clean $SHA_SHORT via scripts/forge-deploy.sh"
python3 "$ROOT/scripts/lib/deployment_history.py" record \
  --product "$APP" \
  --branch "$BRANCH" \
  --sha "$SHA_SHORT" \
  --sha-full "$SHA_FULL" \
  --env "$ENV" \
  --forge-version "$VERSION" \
  --tree clean \
  --deployment-revision "$REVISION" \
  --kind deploy \
  --result "$RESULT"

print_receipt "$APP_NAME" "$ENV" "$VERSION" "$BRANCH" "$SHA_FULL" "$REVISION"
echo "Commit the updated docs/deployments.jsonl and docs/DEPLOYMENT-HISTORY.md before you stop."
