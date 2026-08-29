# Release & rollback process (repo + Forge)

This is how **we** manage official changes end-to-end: Git first, Forge second.
Agents and humans follow the same rules so we never “guess” which files to restore.

Last updated: 2026-08-29

---

## Principles

1. **Git is the source of truth** for code. Forge only hosts what we deploy from Git.
2. **An official release = annotated Git tag** pointing at a known-good commit.
3. **Rollback = check out that tag → rebuild → redeploy.** Not manual file surgery.
4. **Experiments stay on branches / development env.** Official demos use tagged releases.
5. **Each Forge app has its own tags** (`di-*` vs `legacy-*`). Never mix apps in one tag name.

---

## What “official” means

| Term | Meaning |
|---|---|
| **WIP / agent work** | Branch + PR. May deploy to `development` for testing. Not a release. |
| **Merged to `main`** | Code accepted. Still not a release until tagged. |
| **Tagged release** | Official known-good snapshot. Listed in `docs/RELEASES.md`. |
| **Deployed release** | That tag was built and `forge deploy`’d to a named environment. |

---

## Repo layout (who owns what)

| App | Code root | Manifest | Tag prefix |
|---|---|---|---|
| Legacy (Admin Health, Project Health, Executive Preview, Issue panel) | repo root `src/`, `static/`, `manifest.yml` | root `manifest.yml` | `legacy-v*` |
| Delivery Intelligence | `apps/delivery-intelligence/` | `apps/delivery-intelligence/manifest.yml` | `di-v*` |

Shared packages (`packages/shared-jira/`) ship with whichever app imports them; tag the **app** release that includes them.

---

## Day-to-day change flow

```
branch → PR → review → merge main → (optional: tag) → deploy from tag
```

1. Create branch: `cursor/<topic>-0bfb`
2. Change **one product** when possible (see `docs/PRODUCT-INDEX.md`)
3. Open PR; do not deploy “official” from the branch unless testing
4. Merge to `main`
5. If this is a known-good milestone users rely on:
   - Tag it (script below)
   - Record it in `docs/RELEASES.md`
   - Deploy **from the tag**, not from a dirty working tree

---

## Create an official release (tag)

From a clean `main` (or the exact commit you verified):

```bash
# Delivery Intelligence
./scripts/release-tag.sh di 0.1.0 "Desktop known-good sprint dashboard"

# Legacy root app
./scripts/release-tag.sh legacy 0.4.0 "Admin Health boxed UI + existing modules"
```

This:

- Creates annotated tag `di-v0.1.0` or `legacy-v0.4.0`
- Pushes the tag to `origin`
- Reminds you to append a row in `docs/RELEASES.md`

---

## Deploy an official release

```bash
# App: di | legacy
# Version: without the prefix (e.g. 0.1.0)
# Env: development | staging | production

./scripts/release-deploy.sh di 0.1.0 development
./scripts/release-deploy.sh legacy 0.4.0 development
```

This:

1. Checks out the tag (detached HEAD is OK for deploy)
2. Installs/builds the correct app tree
3. Runs `forge deploy -e <env>`
4. Prints the tag + env for the release log

---

## Rollback to a previous official release

```bash
./scripts/release-rollback.sh di 0.1.0 development
```

Same as deploy-from-tag. That **is** the rollback.

Then open the product and confirm. Update `docs/RELEASES.md` “Currently deployed” row.

Do **not**:

- Manually re-edit files from memory
- Redeploy random `main` HEAD hoping it matches
- Mix Delivery Intelligence and legacy root deploys in one command

---

## Environments

| Env | Purpose |
|---|---|
| `development` | Experiments, agent spikes, mobile checks |
| `staging` | Candidate before production |
| `production` | Only tagged releases |

Rule: if the demo site must stay stable, either pin it to a tagged deploy, or run experiments on a different env / site.

---

## Agent / Cloud Agent rules

When an agent finishes work:

1. Commit + push the **branch**
2. Open/update PR
3. Deploy to `development` only if asked to test live
4. **Do not create release tags** unless the user says “make this official” / “tag a release”
5. After a verified known-good: user (or agent if asked) runs `release-tag.sh` + updates `docs/RELEASES.md`
6. If something breaks after a speculative deploy: **rollback via tag**, then fix on a new branch

---

## Mapping Git ↔ Forge

After each official deploy, record:

| Field | Example |
|---|---|
| Tag | `di-v0.1.0` |
| Commit SHA | `7743ec7…` |
| Forge app | Delivery Intelligence |
| Forge env | `development` |
| Forge version | `2.12.0` (from deploy output) |
| Verified | Desktop PLAT sprint OK |

Forge `deploy list` is history, not a substitute for Git tags.

---

## Related

- `docs/RELEASES.md` — registry of tags currently/previously relied on
- `docs/PRODUCT-INDEX.md` — which product to edit
- `docs/MULTI-APP-REPO-STRATEGY.md` — monorepo structure
- `scripts/release-tag.sh` / `release-deploy.sh` / `release-rollback.sh`
