# Shared helpers for Forge deploy/rollback scripts.
# shellcheck shell=bash

forge_common_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

resolve_app() {
  local app="$1"
  case "$app" in
    di)
      APP_KEY="di"
      APP_DIR_REL="apps/delivery-intelligence"
      APP_NAME="Delivery Intelligence"
      ;;
    legacy)
      APP_KEY="legacy"
      APP_DIR_REL="."
      APP_NAME="Legacy root app"
      ;;
    *)
      echo "ERROR: app must be di or legacy" >&2
      return 1
      ;;
  esac
}

deployment_revision_name() {
  local product="$1" env="$2" version="$3"
  python3 "$(dirname "${BASH_SOURCE[0]}")/deployment_history.py" revision-name \
    --product "$product" --env "$env" --forge-version "$version"
}

require_clean_tree() {
  local root="$1"
  if [[ -n "$(git -C "$root" status --porcelain)" ]]; then
    echo "ERROR: refusing to deploy a dirty working tree." >&2
    echo "Commit first so the Forge version maps to an exact Git SHA." >&2
    git -C "$root" status --short >&2
    return 1
  fi
}

require_origin_sha() {
  local root="$1" sha="$2" branch="$3"
  git -C "$root" fetch origin --quiet --tags 2>/dev/null || git -C "$root" fetch origin --quiet || true

  if [[ -n "$branch" && "$branch" != "detached" && "$branch" != "HEAD" ]]; then
    if git -C "$root" rev-parse --verify --quiet "origin/${branch}" >/dev/null; then
      if git -C "$root" merge-base --is-ancestor "$sha" "origin/${branch}"; then
        return 0
      fi
    fi
  fi

  if git -C "$root" branch -r --contains "$sha" 2>/dev/null | grep -q .; then
    echo "NOTE: $sha is on origin, but not on origin/${branch:-unknown}." >&2
    return 0
  fi

  echo "ERROR: $sha is not on origin." >&2
  echo "Push the branch first so mobile and desktop agents can recover this revision." >&2
  echo "  git push -u origin HEAD" >&2
  return 1
}

parse_forge_version() {
  local log="$1"
  python3 - "$log" <<'PY'
import re, sys
text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
match = re.search(r"version of your app \[([0-9.]+)\]", text)
if not match:
    raise SystemExit("ERROR: could not parse Forge version from deploy output")
print(match.group(1))
PY
}

create_and_push_deploy_tag() {
  local root="$1" revision="$2" sha="$3" message="$4"
  if git -C "$root" rev-parse "$revision" >/dev/null 2>&1; then
    echo "ERROR: deployment revision $revision already exists" >&2
    return 1
  fi
  git -C "$root" tag -a "$revision" "$sha" -m "$message"
  if ! git -C "$root" push origin "$revision"; then
    echo "ERROR: deploy succeeded locally but failed to push $revision to origin." >&2
    return 1
  fi
}

print_receipt() {
  local name="$1" env="$2" version="$3" branch="$4" sha="$5" revision="$6"
  cat <<EOF

===== Deployment receipt =====
App: $name
Environment: $env
Forge version: $version
Branch: $branch
Git SHA: $sha
Deployment revision: $revision
History: recorded
Rollback: ./scripts/rollback-deployment.sh ${APP_KEY} $env $version
==============================
EOF
}
