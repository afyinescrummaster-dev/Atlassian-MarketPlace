#!/usr/bin/env bash
# Record a Forge deploy in docs/deployments.jsonl and refresh the markdown log.
# Usage:
#   ./scripts/record-deploy.sh --product di --env development --forge-version 2.13.0 \
#     [--result "tests 20/20"] [--tag di-v0.1.1] [--kind historical]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PRODUCT=""
ENV="development"
VERSION=""
RESULT=""
TAG=""
TREE="clean"
KIND="deploy"
REVISION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --product) PRODUCT="${2:-}"; shift 2 ;;
    --env) ENV="${2:-}"; shift 2 ;;
    --forge-version) VERSION="${2:-}"; shift 2 ;;
    --result) RESULT="${2:-}"; shift 2 ;;
    --tag) TAG="${2:-}"; shift 2 ;;
    --tree) TREE="${2:-}"; shift 2 ;;
    --kind) KIND="${2:-}"; shift 2 ;;
    --deployment-revision) REVISION="${2:-}"; shift 2 ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PRODUCT" || -z "$VERSION" ]]; then
  echo "Usage: $0 --product <di|legacy> --forge-version <x.y.z> [--env development] [--result text] [--tag name]" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" && "$TREE" == "clean" ]]; then
  echo "ERROR: working tree is dirty. Commit first, or pass --tree dirty only when recording a historical exception." >&2
  git status --short
  exit 1
fi

BRANCH="$(git branch --show-current || true)"
SHA_FULL="$(git rev-parse HEAD)"
SHA_SHORT="$(git rev-parse --short=12 HEAD)"

python3 "$ROOT/scripts/lib/deployment_history.py" record \
  --product "$PRODUCT" \
  --branch "${BRANCH:-detached}" \
  --sha "$SHA_SHORT" \
  --sha-full "$SHA_FULL" \
  --env "$ENV" \
  --forge-version "$VERSION" \
  --tree "$TREE" \
  --tag "$TAG" \
  --deployment-revision "$REVISION" \
  --kind "$KIND" \
  --result "$RESULT"
