#!/usr/bin/env bash
# Deploy a Forge app from a clean Git commit and record the revision.
# Usage: ./scripts/forge-deploy.sh <di|legacy> [development|staging|production]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP="${1:-}"
ENV="${2:-development}"

if [[ -z "$APP" ]]; then
  echo "Usage: $0 <di|legacy> [environment]" >&2
  exit 1
fi

case "$APP" in
  di)
    APP_DIR="$ROOT/apps/delivery-intelligence"
    NAME="Delivery Intelligence"
    ;;
  legacy)
    APP_DIR="$ROOT"
    NAME="Legacy root app"
    ;;
  *)
    echo "ERROR: app must be di or legacy" >&2
    exit 1
    ;;
esac

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: refusing to deploy a dirty working tree." >&2
  echo "Commit first so the Forge version maps to an exact Git SHA." >&2
  git status --short
  exit 1
fi

if ! command -v forge >/dev/null 2>&1; then
  echo "ERROR: forge CLI not found" >&2
  exit 1
fi

BRANCH="$(git branch --show-current || echo detached)"
SHA_FULL="$(git rev-parse HEAD)"
SHA_SHORT="$(git rev-parse --short HEAD)"

echo "==> Current recorded deploy for $APP"
python3 "$ROOT/scripts/lib/deployment-history.py" current --product "$APP" || true
echo ""
echo "==> About to deploy"
echo "    Product: $NAME"
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
  forge deploy -e "$ENV" --non-interactive | tee "$LOG"
else
  cd "$ROOT"
  npm install
  npm run lint:code
  npm test
  npm run build
  forge deploy -e "$ENV" --non-interactive | tee "$LOG"
fi

VERSION="$(python3 - "$LOG" <<'PY'
import re, sys
text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
match = re.search(r"version of your app \[([0-9.]+)\]", text)
if not match:
    raise SystemExit("ERROR: could not parse Forge version from deploy output")
print(match.group(1))
PY
)"

cd "$ROOT"
RESULT="Deployed from clean $SHA_SHORT via scripts/forge-deploy.sh"
python3 "$ROOT/scripts/lib/deployment-history.py" record \
  --product "$APP" \
  --branch "$BRANCH" \
  --sha "$SHA_SHORT" \
  --sha-full "$SHA_FULL" \
  --env "$ENV" \
  --forge-version "$VERSION" \
  --tree clean \
  --result "$RESULT"

echo ""
echo "Recorded $NAME $SHA_FULL → Forge $ENV $VERSION"
echo "Commit the updated docs/deployments.jsonl and docs/DEPLOYMENT-HISTORY.md before you stop."
