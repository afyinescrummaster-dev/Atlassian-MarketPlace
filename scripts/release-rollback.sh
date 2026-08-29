#!/usr/bin/env bash
# Roll back by redeploying an official tagged release.
# Usage: ./scripts/release-rollback.sh <di|legacy> <semver> [development|staging|production]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APP="${1:-}"
VERSION="${2:-}"
ENV="${3:-development}"

if [[ -z "$APP" || -z "$VERSION" ]]; then
  echo "Usage: $0 <di|legacy> <semver> [environment]"
  echo "Example: $0 di 0.1.0 development"
  exit 1
fi

echo "==> Rollback = redeploy tagged release"
echo "    This checks out the tag and runs forge deploy."
echo ""

exec "$SCRIPT_DIR/release-deploy.sh" "$APP" "$VERSION" "$ENV"
