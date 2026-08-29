#!/usr/bin/env bash
# Restore a previous Forge development revision without touching the active workspace.
# Usage: ./scripts/rollback-deployment.sh <di|legacy> <environment> <forge-version>
# Example: ./scripts/rollback-deployment.sh di development 2.13.0
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/forge-common.sh
source "$ROOT/scripts/lib/forge-common.sh"
cd "$ROOT"

APP="${1:-}"
ENV="${2:-}"
TARGET_VERSION="${3:-}"

if [[ -z "$APP" || -z "$ENV" || -z "$TARGET_VERSION" ]]; then
  echo "Usage: $0 <di|legacy> <environment> <forge-version>" >&2
  echo "Example: $0 di development 2.13.0" >&2
  exit 1
fi

resolve_app "$APP"

if ! command -v forge >/dev/null 2>&1 && [[ ! -x "$HOME/.local/bin/forge" ]]; then
  echo "ERROR: forge CLI not found" >&2
  exit 1
fi

RECORD_JSON="$(python3 "$ROOT/scripts/lib/deployment_history.py" lookup \
  --product "$APP" --env "$ENV" --forge-version "$TARGET_VERSION")"
SHA_FULL="$(printf '%s' "$RECORD_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["shaFull"])')"
SOURCE_REV="$(printf '%s' "$RECORD_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("deploymentRevision") or "")')"

if [[ -z "$SHA_FULL" || "$SHA_FULL" == "uncommitted" ]]; then
  echo "ERROR: recorded revision has no committed SHA" >&2
  exit 1
fi

git fetch origin --quiet --tags 2>/dev/null || git fetch origin --quiet || true

if ! git cat-file -t "$SHA_FULL" >/dev/null 2>&1; then
  echo "ERROR: cannot find $SHA_FULL locally. Fetch first." >&2
  exit 1
fi

WORKTREES="$ROOT/.forge-worktrees"
mkdir -p "$WORKTREES"
WT="$WORKTREES/${APP}-${ENV}-${TARGET_VERSION}-$$"

cleanup() {
  if [[ -n "${WT:-}" && -d "$WT" ]]; then
    git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || rm -rf "$WT"
  fi
}
trap cleanup EXIT

echo "==> Rolling back $APP_NAME $ENV to Forge $TARGET_VERSION"
echo "    Source revision: ${SOURCE_REV:-unknown}"
echo "    Source SHA:      $SHA_FULL"
echo "    Isolated tree:   $WT"
echo ""

git worktree add --detach "$WT" "$SHA_FULL"

APP_DIR="$WT/$APP_DIR_REL"

export PATH="$HOME/.local/bin:$PATH"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

forge settings set usage-analytics false >/dev/null 2>&1 || true

LOG="$(mktemp)"
log_cleanup() { rm -f "$LOG"; cleanup; }
trap log_cleanup EXIT

if [[ "$APP" == "di" ]]; then
  cd "$APP_DIR"
  npm install
  npm test
  npm run build
  forge lint
  forge deploy -e "$ENV" --non-interactive | tee "$LOG"
else
  cd "$WT"
  npm install
  npm run lint:code
  npm test
  npm run build
  forge lint
  forge deploy -e "$ENV" --non-interactive | tee "$LOG"
fi

VERSION="$(parse_forge_version "$LOG")"
REVISION="$(deployment_revision_name "$APP" "$ENV" "$VERSION")"
ACTIVE_BRANCH="$(git -C "$ROOT" branch --show-current || echo detached)"

cd "$ROOT"
create_and_push_deploy_tag "$ROOT" "$REVISION" "$SHA_FULL" \
  "Rollback $APP $ENV to former $TARGET_VERSION ($SHA_FULL); new Forge $VERSION"

RESULT="Rollback of $ENV $TARGET_VERSION (${SOURCE_REV:-}) via isolated worktree"
python3 "$ROOT/scripts/lib/deployment_history.py" record \
  --product "$APP" \
  --branch "$ACTIVE_BRANCH" \
  --sha "$(git rev-parse --short=12 "$SHA_FULL")" \
  --sha-full "$SHA_FULL" \
  --env "$ENV" \
  --forge-version "$VERSION" \
  --tree clean \
  --deployment-revision "$REVISION" \
  --kind rollback \
  --result "$RESULT"

print_receipt "$APP_NAME" "$ENV" "$VERSION" "$ACTIVE_BRANCH" "$SHA_FULL" "$REVISION"
echo "Active workspace was not checked out or reset."
echo "Commit the updated docs/deployments.jsonl and docs/DEPLOYMENT-HISTORY.md before you stop."
