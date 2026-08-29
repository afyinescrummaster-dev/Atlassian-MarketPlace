# Release & rollback process (repo + Forge)

This is how **we** manage official changes end-to-end: Git first, Forge second.
Agents and humans follow the same rules so we never “guess” which files to restore.

Last updated: 2026-08-29

Working rules (required): **`AGENTS.md`**.  
Every deploy: **`docs/DEPLOYMENT-HISTORY.md`**.  
Official tags only: **`docs/RELEASES.md`**.

> Current DI milestone is `di-v1.0.0` @ `c780ff5` (Sprint Health + Rovo
> Intelligence). `di-v0.1.1` @ `4f44eb3` is the historical recovered
> known-good — keep it. `di-v0.1.0` is not that source.

---

## Principles

1. **Git is the source of truth** for code. Forge only hosts what we deploy from a recorded Git SHA.
2. **Never deploy a dirty working tree.** Every visible Forge version must map to an exact commit.
3. **Development history ≠ release history.** Record every test deploy in `docs/DEPLOYMENT-HISTORY.md`. Record only accepted/tagged milestones in `docs/RELEASES.md`.
4. **An official release = annotated Git tag** pointing at a known-good commit on (or merged to) `main`. The user names the tag.
5. **Rollback = restore a recorded SHA or tag → rebuild → redeploy.** Not manual file surgery and not “what we think it looked like.”
6. **A branch may have many development deploys** before it is accepted onto `main`. Redeploy an earlier SHA on that branch without merging.
7. **Each Forge app has its own tags** (`di-*` vs `legacy-*`). Never mix apps in one tag name.

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
fetch → branch from accepted main → commit → (optional: deploy development from that SHA)
  → record deploy → user tests → accepted → merge main → (user-named tag if milestone)
```

1. Fetch and inspect remote state. Read `docs/DEPLOYMENT-HISTORY.md` so you know what is live.
2. Create a branch from current accepted `main` (`feature/…`, `fix/…`, `chore/…`). Do not develop on `main`.
3. Change **one product** when possible (see `docs/PRODUCT-INDEX.md`)
4. Commit before any Forge deploy. Tree must be clean.
5. Push the branch to origin. Then
   `./scripts/forge-deploy.sh di development` (or `legacy`).
   It refuses a dirty tree, requires the SHA on origin, deploys, creates
   `deploy/<app>/<env>/<version>`, pushes that tag, and records jsonl.
   Then commit the updated log files.
6. Deploying is not known-good. Wait for user acceptance.
7. After acceptance: merge to `main`. If the user names a milestone tag, create it and update `docs/RELEASES.md`.

---

## Create an official release (tag)

From a clean `main` (or the exact commit you verified):

```bash
# Tag current HEAD
./scripts/release-tag.sh di 0.1.1 "Known-good recovered 2.8.0"

# Tag the exact accepted SHA (required when HEAD is a later merge)
./scripts/release-tag.sh di 0.1.1 "Known-good recovered 2.8.0" 4f44eb3

./scripts/release-tag.sh legacy 0.4.0 "Admin Health boxed UI + existing modules"
```

This:

- Creates an annotated tag at HEAD, or at the optional SHA
- Pushes the tag to `origin`
- Reminds you to update `docs/RELEASES.md` and `docs/DEPLOYMENT-HISTORY.md`

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

## Rollback

**Preferred for an official milestone:**

```bash
./scripts/release-rollback.sh di 0.1.0 development
```

**Preferred for a development revision that never reached `main`:**

```bash
./scripts/rollback-deployment.sh di development 2.14.0
```

This uses an isolated git worktree. It does not checkout or reset the
active workspace. It records a new deployment event and a new
`deploy/<app>/<env>/<newVersion>` tag.

Do **not**:

- Guess a rollback point
- Manually re-edit files from memory
- Redeploy random `main` HEAD hoping it matches
- Mix Delivery Intelligence and legacy root deploys in one command

---

## Environments

| Env | Purpose |
|---|---|
| `development` | Active branch testing (current default) |
| `staging` | Release-candidate testing |
| `production` | Accepted production build |
| Marketplace | Separate from Forge production |

Active work stays in `development` until the user says otherwise.

---

## Agent / Cloud Agent rules

When an agent finishes work:

1. Fetch/inspect GitHub first. Do not rely on chat memory alone.
2. Commit + push the **branch**. Never deploy dirty.
3. Deploy to `development` only if asked, using `./scripts/forge-deploy.sh`.
4. Commit the generated log files. Report product / branch / SHA / Forge version / env / test+lint / clean tree / build file changes.
5. **Do not create release tags** unless the user names the tag.
6. If something breaks: restore the recorded SHA or tag. Do not reconstruct source.

---

## Mapping Git ↔ Forge

After **every** deploy, record a row in `docs/DEPLOYMENT-HISTORY.md`.
After an official tagged deploy, also update `docs/RELEASES.md`.

Forge `deploy list` is not a substitute for Git SHAs or this log.

---

## Related

- `AGENTS.md` — working rules
- `docs/DEPLOYMENT-HISTORY.md` — every recorded deploy
- `docs/RELEASES.md` — official tags only
- `docs/PRODUCT-INDEX.md` — which product to edit
- `docs/MULTI-APP-REPO-STRATEGY.md` — monorepo structure
- `docs/DEPLOYMENT-MODEL.md` — why this process exists
- `scripts/forge-deploy.sh` / `rollback-deployment.sh`
- `scripts/release-tag.sh` / `release-deploy.sh` / `release-rollback.sh`
