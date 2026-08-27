# Agent chat context

This file is the handoff for Cursor mobile or a remote agent. Read it before
changing the Forge app. Do not invent missing Jira fields or sample metrics.

Last updated: 2026-08-27

## What this repo is

Forge test app `atlassian-first-app-test` for Jira Cloud.

- Registered app ID (do not change):
  `ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`
- Demo site: `https://one-atlas-qzzp.atlassian.net` (active until 2026-11-18)
- Latest known deploy: development **4.7.0** (Jira Admin Health v0.3; v0.4 boxed UI pending deploy on this branch)
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
