# Jira Admin Health — technical notes

Customer-facing product name: **Jira Admin Health**  
Internal module key remains `admin-health-lab-page` (Forge app ID unchanged).

## Versions

- **v0.1** — Site overview, hygiene flags, score, recommendation cards
- **v0.2** — Findings model, classifications, drill-downs, responsive cards
- **v0.3** — Marketplace UI polish: product naming, summary cards, deep links,
  inactivity threshold setting, partial section errors, trust language

## Current product

Read-only Jira administration health / cleanup assistant.

**Promise:** Find Jira cleanup opportunities in minutes.  
**Workflow:** Detect → Explain → Prioritize → Navigate to Fix

Checks today:

- Project activity (inactive threshold; default **90** days, configurable 90/180/365)
- Empty projects
- Low-volume projects
- Missing project lead (when Jira returns lead expand data)
- Custom field duplicate names (+ type mismatch within a group)
- Deterministic Site Health score

Does **not** modify Jira. Does **not** archive, delete, or bulk-update.

## Findings architecture

`createFinding` / `summarizeFindings` in `src/admin-health/findings.js`.

| Field | Purpose |
|---|---|
| `id` | Stable id |
| `category` | `Projects` or `Custom Fields` |
| `title` | Short label |
| `severity` | `High` · `Review` · `Informational` |
| `affectedObject` | Key/name/type |
| `reason` | Why flagged |
| `evidence` | Counts, ages, field lists |
| `recommendation` | Advisory next step |
| `classification` | Optional recommendation code |
| `filterKeys` | UI filter keys |

## Project recommendation rules

First match wins (`classify.js`):

1. Archived → Informational  
2. Strong archive candidate (High): live + (empty or issues &lt; 5) + (age ≥ 365 or empty with no activity timestamp)  
3. Review for archive (Review): live + age ≥ 180 + issues &lt; 100  
4. Investigate inactivity (Review): inactive (≥ threshold) and not empty  
5. Review ownership (Review): missing lead  
6. Review empty / low volume fallbacks  

## Custom field rules

- Duplicate: trim / collapse space / lower-case exact name; group size &gt; 1  
- Type mismatch: &gt;1 type in a group → warning  
- Does not claim matching names must be deleted  

## Health score

Unchanged formula: start 100; subtract capped costs (dup −3/max30, empty −5/max25,
inactive −4/max24, missing lead −2/max10, low volume −1/max5); clamp 0–100.

UI presents score + “Why?” chips + expandable calculation details.

## Configurable settings

| Setting | Values | Storage |
|---|---|---|
| Inactivity threshold | 90 (default), 180, 365 | Forge KVS `admin-health:settings` via `storage:app` |

Changing the threshold reloads analysis so counts, findings, recommendations, and score stay consistent.

## Supported deep links

Centralized in `src/admin-health/navigation.js`:

| Action | Target | Reliable? |
|---|---|---|
| Open project | `{siteUrl}/jira/projects/{key}` | Yes |
| Open project settings | Forge `NavigationTarget.projectSettingsDetails` | Yes |
| Open custom fields | `{siteUrl}/jira/settings/issues/custom-fields` | Yes |
| Review field | Classic `ConfigureCustomField!default.jspa?customFieldId={n}` | Yes for `customfield_NNNNN` |

Not faked: next-gen-only field config URLs, workflow/scheme/screen admin links.

## Jira APIs

| API | Purpose |
|---|---|
| `GET /rest/api/3/project/search?expand=insight,lead&status=live&status=archived` | Projects + activity + lead |
| `GET /rest/api/3/field` | System + custom fields |

No per-issue fan-out. Pagination: 50/page, max 40 pages.

## Forge scopes

| Scope | Why |
|---|---|
| `read:jira-work` | Project search + field catalog |
| `storage:app` | Field mapping (existing) + Admin Health inactivity setting |

No new scopes in v0.3.

## UI structure (v0.3)

- Header: product name, tagline, last analyzed, Re-run analysis  
- Nav: Overview · Projects · Custom fields · Settings  
- Overview: Site Health / Needs Review / Analyzed cards, Why score chips, Recommended review, module previews  
- Projects: counters, filters, stacked finding cards with Open project / settings  
- Custom fields: expandable duplicate groups with Review field  
- Settings: inactivity threshold  
- Trust footer  

Loading / section errors / positive empty states included. Partial API failure keeps successful sections visible.

## Open the app

```
https://one-atlas-qzzp.atlassian.net/jira/settings/apps/configure/c3817645-72ab-47cf-8c1c-a1dff1b69cff/c4313702-63d1-4894-b3ec-b09adfef958f
```

Or Connected Apps → app → **Configure**.

## Marketplace gaps (honest)

**Must fix before submission:** polished Marketplace listing assets; confirm deep links on target Cloud sites; install/onboarding Get started page.

**Should improve:** CSV export of findings; stronger empty-state education; scan progress messaging on very large sites.

**Post-launch:** field contexts / unused fields, workflows/schemes complexity, scheduled scans — not MVP.
