# Jira Admin Health v0.3 — Marketplace readiness report

Branch: `cursor/admin-health-marketplace-ui-0bfb`

---

### Current Product

**Jira Admin Health** is a read-only Forge `jira:adminPage` that analyzes site
projects and custom fields, scores hygiene, prioritizes findings, and deep-links
admins into Jira to investigate. It does not modify configuration.

### Improvements Made (v0.3)

- Customer-facing rename from “Admin Health Lab” → **Jira Admin Health**
- Marketplace-style overview: Site Health / Needs Review / Analyzed cards
- “Why is my score?” clickable chips → filtered findings
- Recommended review cards with drill-down + Open Jira admin where relevant
- Project cards: evidence, expandable detail, Open project / Open project settings
- Duplicate field cards: expandable members, type-mismatch callout, Review field
- Configurable inactivity threshold (90/180/365) persisted in KVS
- Partial section errors (projects or fields can fail independently)
- Loading, empty, permission-friendly error, and trust footer copy
- Centralized deep-link helpers (`navigation.js`)

### User Journey

Install → Connected Apps Configure / deep link → Overview loads → Site Health +
Needs Review → pick a recommendation → filtered findings with evidence →
Open project / Review field in Jira → admin decides (app never changes Jira).

### Supported Deep Links

- Open project (`/jira/projects/{key}`)
- Open project settings (`projectSettingsDetails`)
- Open custom fields admin
- Review field (classic ConfigureCustomField with numeric id)

### Remaining Dead Ends

- Next-gen-only field configuration URLs (not faked)
- No direct “archive project” (intentional — advisory only)
- Workflows / schemes / screens not analyzed

### Current Health Checks

Project activity, empty projects, low volume, missing lead, custom-field
duplicate names, type mismatch within duplicate groups.

### Scoring Rules

100 − capped: dup groups −3 (max 30), empty −5 (max 25), inactive −4 (max 24),
missing lead −2 (max 10), low volume −1 (max 5). Clamp 0–100.

### Configurable Settings

Inactivity threshold: **90** (default), 180, 365 — KVS `admin-health:settings`.

### Jira APIs

`GET /rest/api/3/project/search?expand=insight,lead&status=live&status=archived`  
`GET /rest/api/3/field`

### Forge Scopes

`read:jira-work`, `storage:app` — no new scopes.

### Performance Assessment

Project search paginated (50 × ≤40 pages). Single field catalog call. No
per-issue fan-out. Very large sites (&gt;2000 projects) may truncate; UI surfaces
limitation. Insight expand remains experimental.

### Test Results

| Check | Result |
|---|---|
| `npm run lint:code` | pass |
| `npm test` | **47** pass |
| `npm run build` | (run at deploy) |
| Live Forge deploy | development **4.7.0** |

### Marketplace MVP Gaps

**Must fix before submission:** listing screenshots/copy; Get started module;
verify deep links on customer sites.

**Should improve:** export; large-site progress; stronger onboarding.

**Post-launch:** contexts, unused fields, workflows/schemes.

### Product Value Test

**Yes — within five minutes** an admin can open Overview, see Site Health and
prioritized recommendations, drill into inactive projects or duplicate fields
with evidence, and jump into Jira. Value depends on site having real hygiene
signals; clean sites get clear positive empty states.

### Recommendation

**Nearly ready** for Marketplace preparation — product core is credible and
actionable; listing/onboarding assets and broader site verification remain.
