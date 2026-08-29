# Agent chat context

This file is the handoff for Cursor mobile or a remote agent. Read it before
changing the Forge app. Do not invent missing Jira fields or sample metrics.

Last updated: 2026-08-29

## What this repo is

Monorepo for Atlassian Forge Marketplace products:

1. **Legacy Forge app** `atlassian-first-app-test` — root `manifest.yml`
2. **Delivery Intelligence for Jira** — separate app under `apps/delivery-intelligence/`

See **`docs/PRODUCT-INDEX.md`** before editing.

- Registered app ID (do not change):
  `ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`
- Demo site: `https://one-atlas-qzzp.atlassian.net` (active until 2026-11-18)
- Latest known deploy: development **4.8.0** (Jira Admin Health v0.4 boxed Custom UI)
- Delivery Intelligence (separate app): recovered 2.8.0 source is
  `recovery/delivery-intelligence-2.8.0` @ `4f44eb3`; verification
  deploy is development **2.13.0**. `origin/main` rollback `7743ec7`
  and tag `di-v0.1.0` are **not** that source. See
  `docs/RECOVERY-2.8.0.md`. Formal process will be updated shortly.
- Jira install was upgraded for `storage:app`
- Root `package.json` must **not** have `"type": "module"` — that broke
  `@forge/resolver`

## Product modules

1. **Issue Data Test** — `jira:issuePanel`, UI Kit, `src/frontend/index.jsx`
2. **Project Health Report** — `jira:projectPage`, UI Kit,
   `src/frontend/project-report.jsx`
3. **Executive Report Preview** — `jira:projectSettingsPage`, Custom UI,
   `static/executive-preview/`
4. **Jira Admin Health** — `jira:adminPage` (Configure), Custom UI boxed
   dashboard, `static/admin-health/` (see `docs/ADMIN-HEALTH-LAB.md`).
   Legacy UI Kit entry `src/frontend/admin-health.jsx` is unused.

Forge allows only one `jira:projectPage`. The executive preview stays under
Project settings. Preserve its visual design (navy header, KPI strip, donut,
attention table). Do not couple Admin Health Lab into project-report code.

## How reports get data

- Project key always comes from Forge context, never a hardcoded key
- JQL: `project = "<validated key>" ORDER BY updated DESC`
- Search: `POST /rest/api/3/search/jql` via `api.asUser()`
- Field catalog: `GET /rest/api/3/field`
- Priorities: `GET /rest/api/3/priority`
- Mappings persist in Forge KVS:
  - site default: `field-mapping:site`
  - project override: `field-mapping:project:{KEY}`
- Scopes: `read:jira-work`, `storage:app` (Admin Health Lab v0.1 adds no new
  scopes; uses project/search + field under `read:jira-work`)

## Field mapping (implemented, not yet confirmed on SALES)

Standard fields are auto-mapped: key, summary, project, status,
statusCategory, priority, assignee, due date, created, updated, resolution
date, issue type, parent, Fix versions.

Configurable concepts stay **Not configured** until a user confirms a
discovered field and saves. Do not assume PI, Team, RAG, Feature Link, or
Target End Date exist.

Open mapping from **Project settings → Executive Report Preview → Field
mapping**. Test mapping, then **Save for this project**. Returning to the
report regenerates it from the saved mapping.

A CLI token fetch could not see the SALES project or custom fields. The
in-app `asUser()` catalog is the source of truth.

## Calculation rules

- To Do / In Progress / Done use `statusCategory` `new` / `indeterminate` /
  `done`, not workflow status names
- Completion = Done / Total, or story points if that mode is saved
- Overdue = configured date is before today AND issue is not Done. Missing
  dates are not overdue
- Critical = open issues whose priority is in the configured list (default
  Critical and Highest when those names exist)
- Requires Attention = distinct union of overdue, critical, blocked,
  unassigned; one row with all reasons
- At Risk when there is at least one open critical or blocked issue, or
  overdue share is 20% or greater. Hover the badge for the exact reason.
  Otherwise On Track
- Unmapped = Not configured. Mapped but empty = No data. Never silent zero

## Chat history this file replaces

Cursor chat history does not automatically travel to mobile. This document
is the saved context from the local Forge setup chat
([Atlassian Forge app setup](d66346de-8d66-4b44-92e3-3e36f64f8df1)).

### 2026-08-20 — first push

The repo was initialized and pushed to GitHub. Last remote commit before
this update:

`383e08d` Add Forge app file: src/resolvers/index.js

### 2026-08-20 to 2026-08-21 — live reports

Built the issue panel, Project Health Report, and Executive Report Preview
on one resolver. Live Jira search works. Executive preview visual design
should be preserved. Known projects mentioned in chat: CLSD, MC, SALES.

Important bugs already fixed:

- Do not add `"type": "module"` to the root `package.json`
- Do not define two `jira:projectPage` modules
- Custom UI lives under `static/executive-preview/` with Vite `base: './'`
- Do not log tokens, raw API errors, or stack traces in the UI

### 2026-08-21 — field mapping layer

Implemented field discovery, mapping UI, KVS persistence, Test mapping
diagnostics, configurable health, and report regeneration. Validation:

- `npm run lint:code` passed
- `npm test` 28 passed
- `npm run build` passed
- Deployed development 4.0.0
- `forge install --upgrade` added `storage:app`

No SALES mapping was saved from the CLI because that token could not see
SALES. The user still needs to confirm mappings in the UI.

### 2026-08-23 — this handoff

User asked when code was last pushed (August 20) and asked to push current
work plus chat context so a mobile/remote agent has history.

### 2026-08-23 — mobile secrets

User added Cursor Cloud Agent secrets so mobile can run Forge without a
local `.env`. Secrets are not in this repo.

### 2026-08-23 — secrets verification on existing agent

Agent run `bc-01a02b40-6a55-7f66-9af7-dd036d4bf172` ("Known code context")
re-checked the VM:

- `FORGE_EMAIL` — unset
- `FORGE_API_TOKEN` — unset

User said the secrets were already configured in the Cursor dashboard.
They were probably not wrong. **Existing Cloud Agent chats do not receive
secrets added after the run started** (or secrets only present in another
scope). That chat could not deploy.

Local checks on that run (no secrets needed):

- `npm run lint:code` — passed
- `npm test` — 28/28 passed
- `npm run build` — passed

Blocked on that run: `forge deploy -e development --non-interactive`

### 2026-08-23 — visible change-check banner

Added a discovery `SectionMessage` at the top of **Issue Data Test** so a
human can confirm a live UI deploy without reading logs. Deployed development
**4.2.0**.

### 2026-08-23 — new agent: secrets work + deploy 4.1.0

Agent run `bc-01a02d23-ed0b-7089-9fa7-d2dadab90bfb` ("Secrets testing code")
pulled `main` (handoff at `ffe64b9`) and re-checked:

- `FORGE_EMAIL` — set
- `FORGE_API_TOKEN` — set (length reported only; value not printed)

Then:

- `npm run lint:code` / `npm test` (28) / `npm run build` — passed
- `forge settings set usage-analytics false` (required for non-interactive)
- `forge deploy -e development --non-interactive` — **Deployed 4.1.0**

Conclusion: dashboard secrets were fine; starting a **new** agent after they
exist was the fix.

### 2026-08-23 — Admin Health Lab v0.2

Built **Findings & Recommendations** on top of v0.1 without replacing it:

- Findings model + project classifications + duplicate type-mismatch
- Actionable recommendation drill-downs + stacked responsive cards
- Docs: `docs/ADMIN-HEALTH-LAB.md`, `docs/ADMIN-HEALTH-LAB-REPORT.md`
- Tests: 44 passing; no new Forge scopes

### 2026-08-26 — Jira Admin Health v0.3 Marketplace UI

Polished existing Admin Health toward Marketplace quality without expanding
scope: product naming, overview cards, deep links, inactivity threshold (KVS),
partial errors, trust copy. Branch
`cursor/admin-health-marketplace-ui-0bfb`.

### 2026-08-27 — Jira Admin Health v0.4 Cleanup Control Center boxes

Converted Admin Health to Custom UI (`static/admin-health/`) to match the
mockup box layout: sidebar, equal summary cards, why-score chips,
recommended review cards, boxed Project / Custom Field modules with tables.
Branch `cursor/admin-health-box-ui-0bfb`.

### 2026-08-27 — Delivery Intelligence local laptop deploy 2.1.0

Laptop ran Forge setup for the **separate** DI app (not the legacy app ID).
DI app ID already existed:
`ari:cloud:ecosystem::app/f7a87d39-d904-408d-9415-72b1052a7026`.
Did not register a third app. Built dashboard, deployed development **2.1.0**,
install on `one-atlas-qzzp.atlassian.net` already current.

### 2026-08-27 — Delivery Intelligence PLAT scope baseline live

Live PLAT Sprint 2025-04-18H12 accepted at **2.7.0**: 8 original commitment,
1 added (PLAT-33255), 12.5% scope, 0 carryover, health 82 On Track. Jira's
sprint report marked all 9 as added because Start-sprint changelog writes
landed 1–19s after `startDate`. Engine now uses changelog + 2-minute start
window; carryover only matches the board's previous closed sprint.
Debug evidence panel removed in **2.8.0**.

### 2026-08-29 — 2.8.0 was never in Git; first rollback predates process

Accepted 2.8.0 was deployed from a dirty working tree and not committed.
Later `origin/main` work could not restore it. The first rollback
(`7743ec7` *Revert Delivery Intelligence to last known-good desktop
build*) happened **before** the release/rollback structure
(`3ade8fd`, `docs/RELEASE-PROCESS.md`). That revert was not a restore
from a tagged 2.8.0 SHA — Git never had that SHA.

Recovered exact tree onto `recovery/delivery-intelligence-2.8.0` at
`4f44eb315d5cbd9320c42ce150a360bb522c0a44`. Verification: tests 20/20,
`forge lint` clean, Forge development **2.13.0**. No merge to `main`.
No new tag. Full handoff: `docs/RECOVERY-2.8.0.md`.

**Formal process will be updated shortly.** Until then, do not treat
`di-v0.1.0` / `origin/main` as known-good 2.8.0, and do not invent
another rollback.

## Secrets for mobile and Cloud Agents

Do not ask the user to paste the token into chat. Do not print
`FORGE_API_TOKEN`. Do not commit `.env`.

Add these in [cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents)
under **Secrets**, then start a **new** Cloud Agent. An existing chat will
not pick up newly added secrets.

| Name | Cursor secret type | Why |
|---|---|---|
| `FORGE_EMAIL` | Environment Variable | Agent can see which Atlassian account to use |
| `FORGE_API_TOKEN` | Runtime Secret | Injected for `forge`, redacted from chat, tool output, and commits |

Do not use Build Secret. That exists only during a Docker image build.

If Environment-scoped secrets are unset on the VM, add the same keys under
**Personal** scope and start another new agent.

On a Cloud Agent VM, prefer the injected environment variables. If a `.env`
file is required, create it on the VM from those variables and keep it
gitignored.

### How to verify secrets without leaking the token

```bash
# Email may be printed.
if [ -n "$FORGE_EMAIL" ]; then echo "FORGE_EMAIL is set: $FORGE_EMAIL"; else echo "FORGE_EMAIL is unset"; fi

# Token: only report set/unset and length. Never echo the value.
if [ -n "$FORGE_API_TOKEN" ]; then echo "FORGE_API_TOKEN is set; length=${#FORGE_API_TOKEN}"; else echo "FORGE_API_TOKEN is unset"; fi
```

Success: email prints, token is set (or appears as `[REDACTED]` if a tool
tries to read it). Failure: one or both unset. Then try Personal scope and
a new agent.

## CLI notes

On the laptop, Forge CLI is not global. Use:

```bash
export PATH="$HOME/.local/bin:$PATH"
set -a; . ./.env; set +a
```

`.env` is gitignored. It holds `FORGE_EMAIL` and `FORGE_API_TOKEN`. Never
print or commit the token. `.env.example` is the placeholder file.

On mobile / Cloud Agents, use the injected environment variables instead of
a committed file.

```bash
npm run lint:code
npm test
npm run build
forge deploy -e development --non-interactive
```

Upgrade the install only if Forge says a new scope is required.

## Do not do

- Do not add an external backend or database
- Do not hardcode custom field IDs or the SALES project as the only scope
- Do not fabricate custom fields or sample values
- Do not replace Project Health Report
- Do not change the registered Forge app ID
- Do not commit `.env` or tokens
- Do not print `FORGE_API_TOKEN` or ask the user to paste it into chat

## Related docs

- `docs/MULTI-APP-REPO-STRATEGY.md` — managing multiple products/modules in
  one repo without losing context
- `docs/PRODUCT-INDEX.md` — agent routing table per product
- `docs/products/delivery-intelligence.md` — new Marketplace app (v0.1)
- `docs/ADMIN-HEALTH-LAB.md` — Jira Admin Health product detail
- `docs/ROVO-DELIVERY-INTELLIGENCE-ARCHITECTURE.md` — future product research
