# Managing multiple apps in this repository

This document explains how to organize **multiple Forge products** in one Git
repo so humans and Cloud Agents keep context without rebuilding everything from
scratch.

Last updated: 2026-08-27

---

## What this repo is today

This repository is **one Forge app** with **four product modules**, not four
separate Forge apps.

| Layer | Role today |
|---|---|
| **One Forge app** | Single `manifest.yml`, one app ID, one deploy |
| **Product code** | `src/admin-health/`, `src/report/`, resolvers split by file |
| **UI surfaces** | UI Kit (`src/frontend/`) + Custom UI (`static/*/`) |
| **Memory for agents** | `docs/CHAT-CONTEXT.md`, `.cursor/session-history.md`, product docs |
| **Shared backend** | One resolver in `src/resolvers/index.js` registers all products |

That pattern works. Pain usually comes when everything lives in one giant
context blob and every change feels like it touches the whole app.

---

## Two ways to think about “multiple apps”

### A. Multiple modules in one Forge app (current model)

**Best for:** related Jira products that share scopes, install once, and can
share code (field mapping, Jira API helpers).

Keep one `manifest.yml`, but enforce this layout:

```
src/
  admin-health/          # pure logic — no Forge imports
  report/                # executive preview logic
  resolvers/
    admin-health.js      # thin Forge layer only
    mapping.js
    project-report.js
    issue-panel.js
  lib/                   # shared jira helpers (future)
static/
  admin-health/          # Custom UI + own package.json
  executive-preview/
docs/
  products/
    admin-health.md
    executive-preview.md
    project-health.md
  CHAT-CONTEXT.md        # index + global rules only
```

**Rule:** UI → resolver → domain package. Domain packages must not import
`@forge/api`.

### B. Multiple Forge apps in one Git repo

**Best for:** unrelated Marketplace listings, different scopes, or separate
install lifecycles.

Each app gets its own folder:

```
apps/
  admin-health/
    manifest.yml
    src/
    static/
  delivery-intelligence/
    manifest.yml
    src/
packages/
  shared-jira/           # optional shared npm workspace package
docs/
  CHAT-CONTEXT.md
```

Each app deploys independently:

```bash
cd apps/admin-health && forge deploy -e development
```

Forge does **not** support one manifest for multiple app IDs. This is the clean
split when products should ship separately.

---

## How to keep context without rebuilding from scratch

### 1. Product docs, not one mega doc

`docs/CHAT-CONTEXT.md` should stay the **index** (app ID, demo site, secrets,
global constraints). Each product gets its own doc with:

- Customer name vs Forge module key
- Entry points (Configure URL, project page, etc.)
- Scopes and KVS keys
- Version history
- “Do not break” list
- Last deploy version

Example already in repo: `docs/ADMIN-HEALTH-LAB.md`. Mirror that pattern for
Executive Preview and Project Health.

### 2. Agent entry point per task

Add a routing table (in `AGENTS.md` or `docs/PRODUCT-INDEX.md`):

| Working on… | Read first | Code roots | Deploy check |
|---|---|---|---|
| Admin Health | `docs/ADMIN-HEALTH-LAB.md` | `src/admin-health/`, `static/admin-health/` | Configure deep link |
| Executive Preview | `docs/EXECUTIVE-PREVIEW.md` | `src/report/`, `static/executive-preview/` | Project settings page |
| Project Health | `docs/PROJECT-HEALTH.md` | `src/frontend/project-report.jsx` | Project page |
| Issue panel | `docs/ISSUE-PANEL.md` | `src/frontend/index.jsx` | Issue panel |

Every agent session should start with **one product doc**, not the full repo
story.

### 3. Session log by product

In `.cursor/session-history.md`, tag entries by product:

```markdown
## 2026-08-27 — [Admin Health] v0.4 boxed UI
```

That makes history searchable without rereading everything.

### 4. Isolated builds (optional but helpful)

Today `npm run build` builds **both** Custom UIs every time. Split scripts so
work on one surface does not require a full rebuild:

```json
"build:executive": "npm run build --prefix static/executive-preview",
"build:admin-health": "npm run build --prefix static/admin-health",
"build": "npm run build:executive && npm run build:admin-health"
```

Same idea for tests: `test:admin-health`, `test:report`, etc.

### 5. Hard boundaries in code

**Things that already save rework:**

- Admin Health logic in `src/admin-health/` (pure, tested)
- Resolvers registered separately in `src/resolvers/index.js`
- Custom UI Vite apps with `@admin-health` / `@report` aliases into shared logic

**Things to avoid:**

- Importing Admin Health into `project-report.jsx`
- Shared global state between products
- One frontend file that grows forever (e.g. legacy
  `src/frontend/admin-health.jsx` once Custom UI is stable)

### 6. Manifest as product registry

Add `docs/MANIFEST-MAP.md` (or keep it in this doc) as a living registry:

| Module key | Product | UI type | Resource path | Resolver |
|---|---|---|---|---|
| `admin-health-lab-page` | Jira Admin Health | Custom UI | `static/admin-health/build` | `getAdminHealthReport` |
| `executive-report-preview-page` | Executive Report Preview | Custom UI | `static/executive-preview/build` | mapping + report resolvers |
| `project-health-report-page` | Project Health Report | UI Kit | `src/frontend/project-report.jsx` | project report resolvers |
| `atlassian-first-app-test-hello-world-panel` | Issue Data Test | UI Kit | `src/frontend/index.jsx` | issue panel resolvers |

When you add a fifth module, extend the map instead of rediscovering wiring.

---

## Recommended strategy for this repo

### Short term (stay on one Forge app)

1. Add `docs/products/*.md` — one per module
2. Slim `CHAT-CONTEXT.md` to global facts + links
3. Add `docs/MANIFEST-MAP.md` (or section in this doc)
4. Split build/test scripts by product
5. Remove or archive dead entry points (e.g. unused `src/frontend/admin-health.jsx`)
   so agents do not load the wrong UI

### Long term (Marketplace-ready separate apps)

When Admin Health or Delivery Intelligence should be its own listing:

- Move to `apps/<product-name>/` with its own `manifest.yml` and app ID
- Extract shared Jira helpers to `packages/shared-jira/`
- Keep this repo as a **monorepo**, or split repos only when a product has its
  own team/release cadence

---

## What “context” means for Cursor Cloud Agents

Chat history does **not** carry over between runs. Durable context is:

1. **Git** — the code and docs
2. **`docs/CHAT-CONTEXT.md`** — what to read first
3. **Product docs** — deep detail per module
4. **`.cursor/session-history.md`** — what changed recently

For tighter routing, add Cursor rules such as
`.cursor/rules/admin-health.mdc`:

> When editing `static/admin-health/**`, read `docs/ADMIN-HEALTH-LAB.md` first.

---

## Practical rule of thumb

| Question | Answer |
|---|---|
| Same install, shared scopes, related products? | **One Forge app, multiple modules** (current approach) |
| Separate Marketplace app, billing, lifecycle? | **Separate Forge app folder** in monorepo |
| Agent keeps forgetting prior work? | **Product doc + session log**, not longer chat |
| Avoid rebuilding UI from scratch? | **Custom UI + domain package + mockups in `docs/screenshots/`** |

---

## Current product modules (reference)

Registered Forge app ID (do not change):

`ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`

| # | Product | Forge module | UI | Code |
|---|---|---|---|---|
| 1 | Issue Data Test | `jira:issuePanel` | UI Kit | `src/frontend/index.jsx` |
| 2 | Project Health Report | `jira:projectPage` | UI Kit | `src/frontend/project-report.jsx` |
| 3 | Executive Report Preview | `jira:projectSettingsPage` | Custom UI | `static/executive-preview/` |
| 4 | Jira Admin Health | `jira:adminPage` (Configure) | Custom UI | `static/admin-health/` |

Shared scopes today: `read:jira-work`, `storage:app`.

Forge constraint: only **one** `jira:projectPage` per app (Executive Preview
correctly lives under project settings).

---

## Suggested next steps (for review)

1. **Approve** one-Forge-app vs multi-app monorepo direction
2. **Create** `docs/products/` with one markdown file per module
3. **Add** `docs/PRODUCT-INDEX.md` routing table for agents
4. **Split** npm scripts for per-product build/test
5. **Archive** legacy UI Kit Admin Health entry once Custom UI is accepted
6. **Decide** whether Rovo / delivery intelligence is a new module or a new
   Forge app under `apps/`

---

## Related docs

- `docs/CHAT-CONTEXT.md` — global handoff, secrets, demo site
- `docs/RELEASE-PROCESS.md` — official tags, deploy, rollback (repo + Forge)
- `docs/RELEASES.md` — tagged release registry
- `docs/ADMIN-HEALTH-LAB.md` — Admin Health product detail
- `docs/ROVO-DELIVERY-INTELLIGENCE-ARCHITECTURE.md` — future product research
- `AGENTS.md` — agent entry point and deploy checklist
- `.cursor/session-history.md` — dated session log
