# atlassian-first-app-test

For Cursor mobile or a remote agent, start with
[docs/CHAT-CONTEXT.md](docs/CHAT-CONTEXT.md). That file is the saved chat
handoff for this repo.

A Forge app with four modules:

- **Issue Data Test** (`jira:issuePanel`, UI Kit) — live fields for the open issue
- **Project Health Report** (`jira:projectPage`, UI Kit) — project-level metrics
  from a bounded JQL search
- **Executive Report Preview** (`jira:projectSettingsPage`, Custom UI) — a
  one-page executive-status proof of concept using the same live report data.
  Forge allows only one `jira:projectPage` per app, so this preview is a
  separate project-level page under Project settings and does not replace
  Project Health Report.
- **Admin Health Lab** (`jira:adminPage`, UI Kit) — experimental read-only site
  hygiene dashboard under Jira Administration → Apps. See
  [docs/ADMIN-HEALTH-LAB.md](docs/ADMIN-HEALTH-LAB.md).

All modules share one registered app ID and one resolver function. The existing
Project Health Report is unchanged.

## Architecture

- `src/frontend/index.jsx` — issue panel UI Kit resource (`main`)
- `src/frontend/project-report.jsx` — Project Health Report UI Kit resource
  (`project-report`)
- `src/frontend/admin-health.jsx` — Admin Health Lab UI Kit resource
- `static/executive-preview/` — Executive Report Preview Custom UI source
- `src/admin-health/` — pure site hygiene analysis (projects, fields, score)
- `src/resolvers/issue-panel.js` — `getIssueData`
- `src/resolvers/project-report.js` — `getProjectHealthReport`
- `src/resolvers/admin-health.js` — `getAdminHealthReport`
- `src/resolvers/mapping.js` — field catalog, mapping save, and mapping test
- `src/resolvers/index.js` — registers resolver methods
- `src/report/metrics.js` — pure metric calculations used by both report UIs
  and Node tests
- `src/report/field-catalog.js` — standard mappings and configurable concepts

Both project pages use Forge project-page context for the project key, then
`POST /rest/api/3/search/jql` as the viewing user (`api.asUser()`). JQL is
always `project = "<validated project key>" ORDER BY updated DESC`, using the
current page’s project — never a hardcoded key. Pages are at most 100 issues,
up to 500 total, following `nextPageToken`. Field mappings are stored in the
Forge Key-Value Store, scoped as a site default or as a per-project override.

Neither project-level module has a project-key or project-type display
condition, so both appear in every compatible Jira project: Software, Service
Management, and Business (for example Marketing Content).

## What this test validates

- The issue panel still loads the open issue’s real data, including ADF
  description rendering.
- **Project Health Report** still appears and works as before.
- **Executive Report Preview** is a separate project-level page under Project
  settings, so both versions can be compared without replacing the existing
  report.
- Both pages derive the project key from Forge context and rebuild JQL when
  the project changes.
- Metrics (To Do / In Progress / Completed / unassigned / overdue /
  Critical or Highest) are calculated from Jira status category keys and
  actual priority names.
- Client-side filters on Project Health Report change only the issue table,
  not Jira data.
- Empty metrics and sections use empty states. Nothing is fabricated.
- Permission, empty-project, filter-empty, API failure, invalid project,
  truncation, and partial-data states are handled without exposing internals.

## Required Forge scopes

- `read:jira-work` — `GET /rest/api/3/issue/{issueIdOrKey}`,
  `GET /rest/api/3/project/{key}`, `GET /rest/api/3/field`,
  `GET /rest/api/3/priority`, and `POST /rest/api/3/search/jql`
- `storage:app` — Forge Key-Value Store for field mapping configuration

Open **Project settings → Executive Report Preview → Field mapping** to
discover site fields, confirm custom-field matches, save a project or site
mapping, and run Test mapping. Then return to the executive report to
regenerate it from the saved configuration.

## Prerequisites

- Node.js 22 or 24 (this project uses Node.js 22)
- A Forge CLI installation
- An Atlassian Cloud developer or demo site with Jira
- `FORGE_EMAIL` and `FORGE_API_TOKEN` stored as environment secrets (for
  example in a gitignored `.env`)

Never commit or copy credentials into this repository. The CLI reads them from
the environment.

## Validation commands

```bash
npm run lint:code
npm test
npm run build
forge lint
forge deploy -e development --non-interactive
```

Upgrade the site install only if Forge reports that the new project-page module
(or a permission change) requires it:

```bash
forge install --upgrade --demo-site -p Jira -e development --confirm-scopes --non-interactive
```

Do not change the registered app ID in `manifest.yml`.

## Manual verification

### Issue panel

1. Open `https://one-atlas-qzzp.atlassian.net/browse/CLSD-6`.
2. Select **Issue Data Test**.
3. Confirm live fields and description rendering still work.

### Project Health Report

1. Open **Commercial Legal Service Desk (CLSD)** on
   `https://one-atlas-qzzp.atlassian.net`.
2. Open **Project Health Report** and confirm it still loads live CLSD data.
3. Open **Marketing Content (MC)** and confirm the heading, JQL, and issues
   change. Do not reinstall.

### Executive Report Preview

Forge allows only one `jira:projectPage`, so this proof of concept is installed
as a project settings page and uses the same resolver and live Jira data.

1. In CLSD, open **Project settings**, then **Executive Report Preview**.
2. Confirm the one-page report shows the CLSD name/key, generated date, live
   metrics, query `project = "CLSD"`, and CLSD issue keys.
3. In MC, open **Project settings**, then **Executive Report Preview**.
4. Confirm the heading, query, and displayed issues change to MC.
5. Confirm **Project Health Report** still works in the same projects.
