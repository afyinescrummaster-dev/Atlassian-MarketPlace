#!/usr/bin/env bash
# Create an official annotated release tag and push it.
# Usage: ./scripts/release-tag.sh <di|legacy> <semver> ["message"]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP="${1:-}"
VERSION="${2:-}"
MESSAGE="${3:-}"

if [[ -z "$APP" || -z "$VERSION" ]]; then
  echo "Usage: $0 <di|legacy> <semver> [\"message\"]"
  echo "Example: $0 di 0.1.0 \"Desktop known-good\""
  exit 1
fi

case "$APP" in
  di) PREFIX="di-v" ;;
  legacy) PREFIX="legacy-v" ;;
  *)
    echo "ERROR: app must be di or legacy"
    exit 1
    ;;
esac

TAG="${PREFIX}${VERSION}"
MESSAGE="${MESSAGE:-Official release ${TAG}}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is dirty. Commit or stash before tagging."
  git status --short
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "ERROR: tag $TAG already exists"
  exit 1
fi

SHA="$(git rev-parse --short HEAD)"
echo "==> Tagging $TAG at $SHA"
git tag -a "$TAG" -m "$MESSAGE"
git push origin "$TAG"

echo ""
echo "Tagged and pushed: $TAG ($SHA)"
echo "Next:"
echo "  1. Append/update docs/RELEASES.md"
echo "  2. Deploy: ./scripts/release-deploy.sh $APP $VERSION development"
