# Agent chat context

This file is the handoff for Cursor mobile or a remote agent. Read it before
changing the Forge app. Do not invent missing Jira fields or sample metrics.

Last updated: 2026-08-23

## What this repo is

Forge test app `atlassian-first-app-test` for Jira Cloud.

- Registered app ID (do not change):
  `ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`
- Demo site: `https://one-atlas-qzzp.atlassian.net` (active until 2026-11-18)
- Latest known deploy before this push: development **4.0.0**
- Jira install was upgraded for `storage:app`
- Root `package.json` must **not** have `"type": "module"` — that broke
  `@forge/resolver`

## Product modules

1. **Issue Data Test** — `jira:issuePanel`, UI Kit, `src/frontend/index.jsx`
2. **Project Health Report** — `jira:projectPage`, UI Kit,
   `src/frontend/project-report.jsx`
3. **Executive Report Preview** — `jira:projectSettingsPage`, Custom UI,
   `static/executive-preview/`

Forge allows only one `jira:projectPage`. The executive preview stays under
Project settings. Preserve its visual design (navy header, KPI strip, donut,
attention table).

## How reports get data

- Project key always comes from Forge context, never a hardcoded key
- JQL: `project = "<validated key>" ORDER BY updated DESC`
- Search: `POST /rest/api/3/search/jql` via `api.asUser()`
- Field catalog: `GET /rest/api/3/field`
- Priorities: `GET /rest/api/3/priority`
- Mappings persist in Forge KVS:
  - site default: `field-mapping:site`
  - project override: `field-mapping:project:{KEY}`
- Scopes: `read:jira-work`, `storage:app`

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
