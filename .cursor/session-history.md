# Session history

Durable stand-in for Cursor Cloud chat history across agent runs.
Full handoff: **`docs/CHAT-CONTEXT.md`** (always read that first).

Update this file at the end of meaningful sessions.

---

## 2026-08-29 — [Delivery Intelligence] Sprint intelligence increment (features 1–5)

### Goal
Deepen V1 sprint intelligence: Scope Movement, actionable attention,
drill-downs, current vs previous sprint, distinct Rovo intents.

### Done
- Branch: `feature/sprint-intelligence-core` from `main` / V1
- Deterministic snapshot now includes issue lists, attention actions,
  and previous-sprint comparison with capability states
- Dashboard UI Build `2.9.0`: Overview, Scope Movement, attention,
  trends, AI actions
- Tests: 31 passing. No official release tag. Not merged to `main`.
- Forge development **2.16.0** from `1523b75`.
  Revision: `deploy/di/development/2.16.0`.
  Rollback: `./scripts/rollback-deployment.sh di development 2.16.0`
- Waiting for live Jira acceptance. Do not merge to `main`.

### Out of scope (kept out)
- Dependency intelligence
- Automation / write scopes
- Admin Health
- Health-score formula redesign
- Invented removal/de-scope history

---

## 2026-08-29 — [Delivery Intelligence] V1 milestone `di-v1.0.0`

### Goal
Merge deployment-history automation and tag V1: Sprint Health + Rovo
Intelligence.

### Done
- Merged `feature/deployment-history-automation` into `main` (`c780ff5`)
- Tagged `di-v1.0.0` at that merge. Did not rewrite `di-v0.1.1`.
- V1 includes deterministic sprint health, commitment/scope/carryover,
  blocked/stale, health score, Rovo actions, recovered baseline, and
  CMS deploy/rollback.

---

## 2026-08-29 — [Process] CMS-style deployment history

### Why
Forge 2.8.0 was deployed dirty and uncommitted, so Git could not roll
back. Recovery closed at `di-v0.1.1` / `4f44eb3` / Forge 2.13.0.

### Done
- Kept `docs/deployments.jsonl`; added deploy tags
  `deploy/<app>/<env>/<version>`
- Origin SHA required before deploy
- Isolated worktree rollback: `./scripts/rollback-deployment.sh`
- Receipt after success; no record/tag on failure
- Branch: `feature/deployment-history-automation` (not merged)

---

## 2026-08-29 — [Delivery Intelligence] tagged known-good `di-v0.1.1`

### Goal
Close recovery with an immutable tag on the exact accepted, deployed SHA.

### Done
- Annotated tag `di-v0.1.1` → `4f44eb315d5cbd9320c42ce150a360bb522c0a44`
- Not the merge commit `8b570a9` (that only brought the source onto `main`)
- Forge development **2.13.0**, PLAT accepted
- Updated `docs/RELEASES.md` and `docs/DEPLOYMENT-HISTORY.md`
- Recovery officially closed

---

## 2026-08-29 — [Delivery Intelligence] recovered 2.8.0 merged to main

### Goal
Put the accepted 2.8.0 source on `main` after PLAT verification and lock
the Git + Forge working rules. Official tag still waits for the user.

### Done
- Merged `recovery/delivery-intelligence-2.8.0` (`4f44eb3`) into `main`
- Locked working rules in `AGENTS.md`, `docs/RELEASE-PROCESS.md`, and
  `docs/DEPLOYMENT-HISTORY.md`
- Tag `di-v0.1.0` remains a historical non-2.8.0 marker

### Expected PLAT fingerprint
8 original / 1 added (PLAT-33255) / 12.5% / 0 carryover / health 82 /
On Track / no debug dump. Live Forge development **2.13.0**.

---

## 2026-08-29 — [Delivery Intelligence] 2.8.0 recovered; first rollback predates process

### Goal
Preserve the accepted Forge 2.8.0 source and tell the other agent why the
first `origin/main` rollback could not restore it.

### What happened
- Accepted PLAT 2.8.0 was deployed from a dirty working tree and never
  committed. Git therefore had no SHA to roll back to.
- The first rollback (`7743ec7`) happened **before** `3ade8fd` added
  `docs/RELEASE-PROCESS.md`. That revert is not verified 2.8.0.
  `di-v0.1.0` is not that source either.
- Exact tree committed as `4f44eb3` on `recovery/delivery-intelligence-2.8.0`.
- Verification: 20/20 tests, `forge lint` clean, Forge **2.13.0**.
  Later merged to `main`. Tag still waits for the user.

---

## 2026-08-27 — [Delivery Intelligence] PLAT live baseline accepted

### Goal
Fix 0 committed / 9 added / 9 carryover on PLAT.

### Done
- Live evidence: Jira sprint report listed all 9 as added; changelog showed 8 joins 1–19s after start and PLAT-33255 at +12 min
- Scope uses changelog + start-sprint window, not sprint-report
- Carryover only if the board's previous closed sprint appears in history
- Live accept: 8 original, 1 added, 12.5% scope, 0 carryover, health 82
- Removed classification-evidence debug UI in 2.8.0

---

## 2026-08-27 — [Delivery Intelligence] sprint baseline + Rovo prompt

### Goal
Stop over-classifying PLAT scope/carryover; hide JSON FACTS from Rovo chat.

### Done
- Reconstruct sprint membership from changelog; added = first join strictly after start
- Scope % = added / original commitment
- Carryover requires a different prior sprint and still-open issue
- Rovo `rovo.open()` now sends a short natural-language prompt; agent fetches snapshot via action
- Unit tests for commitment, 12.5% PLAT case, carryover, missing history

---

## 2026-08-27 — [Delivery Intelligence] sprint analyze error

### Goal
Fix “We couldn’t analyze this sprint right now” on the project page.

### Done
- Removed `"type": "module"` from the DI Forge `package.json` (same Resolver/`api.asUser` trap as the legacy app)
- Jira Agile client now uses `import api, { route } from "@forge/api"` directly
- Board HTTP 400 treated as “no Software board” instead of a hard failure
- Sprint issue fetch limited to needed fields; changelogs fetched in parallel
- Error UI shows a safe error code

---

## 2026-08-27 — [Delivery Intelligence] local laptop deploy 2.1.0

### Goal
Run Delivery Intelligence Forge setup on the laptop (separate app ID, not
the legacy Admin Health app).

### Done
- Confirmed Forge login as Akeem (`afyineagilecoach@gmail.com`)
- Did **not** mint a third app ID: DI was already registered as
  `ari:cloud:ecosystem::app/f7a87d39-d904-408d-9415-72b1052a7026`
- Installed `static/dashboard` deps (setup script missed this) and built UI
- `forge lint` clean; deployed development **2.1.0**
- Install on `one-atlas-qzzp.atlassian.net` already at latest (upgrade no-op)

### Open
- Open a Jira Software project → **Delivery Intelligence** to verify live UI
- Setup script should `npm install --prefix static/dashboard` before build

---

## 2026-08-27 — [Delivery Intelligence] v0.1 monorepo foundation

### Goal
Approve multi-app monorepo direction; scaffold separate Delivery Intelligence Forge app.

### Done
- `apps/delivery-intelligence/` with domain engine, Agile client, Custom UI, Rovo agent/actions
- `packages/shared-jira/` shared read helpers
- `docs/products/` + `docs/PRODUCT-INDEX.md`
- Unit tests for deterministic engine; legacy root app untouched
- Manual `forge register` documented (non-TTY blocked registration here)

---

## 2026-08-27 — [Admin Health] v0.4 boxed Custom UI

### Goal
Match Cleanup Control Center mockup more closely (sidebar + box format).

### Done
- Moved Admin Health from UI Kit to Custom UI (`static/admin-health/`)
- Sidebar, equal summary cards, why-score chips, recommendation cards
- Boxed Project / Custom Field hygiene modules with tables on overview
- Manifest `layout: blank` + resource points at Vite build
- Docs updated; lint/tests/build green
- Deployed development **4.8.0**

---

## 2026-08-26 — Jira Admin Health v0.3 Marketplace UI

### Goal
Polish existing Admin Health toward Marketplace-ready UX (not a rebuild).

### Done
- Product name **Jira Admin Health**; overview summary cards; deep links
- Inactivity threshold setting (90/180/365) in KVS
- Partial section errors; trust footer; stacked cards
- Docs + readiness report; 47 tests

---

## 2026-08-23 — Admin Health Lab v0.2 Findings & Recommendations

### Goal
Make existing Admin Health findings actionable without adding destructive
actions or broad new Jira admin APIs.

### Done
- Findings model (`findings.js`) + project classifications (`classify.js`)
- Duplicate groups with type-mismatch signal
- Summary landing + drill-down recommendation cards + stacked cards UI
- Docs + report updated; lint/tests/build green (44 tests)

### Open
- Deployed development **4.6.0** — open Configure deep link to verify

---

## 2026-08-23 — visible Issue Data Test banner (4.2.0 / 4.3.0 Sparky)

Added a blue discovery banner titled **Cloud Agent change check** to the
Issue Data Test issue panel so the user can open any issue and confirm a
live UI change. Deployed development **4.2.0**.

---

## 2026-08-23 — secrets verified + development deploy 4.1.0

### Agent
https://cursor.com/agents/bc-01a02d23-ed0b-7089-9fa7-d2dadab90bfb
("Secrets testing code")

### Goal
Pull the secrets-testing handoff from `main` and verify Cloud Agent secrets
so Forge deploy works.

### Secrets check (this run) — **passed**
- `FORGE_EMAIL` — set (`afyineagilecoach@gmail.com`)
- `FORGE_API_TOKEN` — set (length 192; value not printed)
- `CLOUD_AGENT_INJECTED_SECRET_NAMES` included `FORGE_API_TOKEN`
- Confirms: secrets inject on **new** agent start; prior chat
  (`bc-01a02b40…`) could not see them because it started earlier.

### Validation
- `npm run lint:code` — passed
- `npm test` — 28/28 passed
- `npm run build` — passed
- `forge deploy -e development --non-interactive` — **Deployed 4.1.0**

### Notes
- Installed `@forge/cli` to `$HOME/.local` (no global root install)
- Required once: `forge settings set usage-analytics false` for
  `--non-interactive`

---

## 2026-08-23 — secrets test + handoff for new agent

### Goal
Test whether Cloud Agent secrets work so the Forge app can be updated
(`forge deploy`).

### Secrets check (this run)
- `FORGE_EMAIL` — **unset**
- `FORGE_API_TOKEN` — **unset**
- User confirmed secrets were already added in the Cursor dashboard earlier.
- Conclusion: secrets were probably fine; **this existing chat started before
  they were available / cannot pick up secrets added later**.
- Fix: start a **new** Cloud Agent after secrets exist.
  - Names: `FORGE_EMAIL`, `FORGE_API_TOKEN`
  - Types: Environment Variable + Runtime Secret (not Build Secret)
  - Prefer **Personal** scope for this Personal environment

### Local validation (no secrets required) — passed
- `npm run lint:code` — passed
- `npm test` — 28/28 passed
- `npm run build` — passed (after `npm install --prefix static/executive-preview`)

### Blocked
- `forge deploy` / install upgrade — needs injected secrets

### Repo state at handoff
- Branch worked: `cursor/session-history-memory-f172` (includes merged `main`)
- App ID (do not change): `ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`
- Demo site: `https://one-atlas-qzzp.atlassian.net`
- Latest known deploy before this: development **4.0.0**
- Modules: Issue Data Test, Project Health Report, Executive Report Preview

### What the new agent should do
1. Read `docs/CHAT-CONTEXT.md`
2. Verify secrets with the safe check (email ok to print; token length only)
3. If set → deploy development non-interactively
4. If unset → ask user to fix secret name/type/scope and start another new agent
5. Do not ask the user to paste the API token into chat

---

## 2026-08-22 — Known code context

Started from Hello World scaffold; later `main` gained full reporting work and
`docs/CHAT-CONTEXT.md`. See that file for product rules and chat history.
