# Admin Health Lab — technical notes

## Versions

- **v0.1** — Site overview, hygiene flags, score, recommendation cards
- **v0.2** — Findings model, classifications, actionable drill-downs, responsive cards

v0.2 preserves all v0.1 data retrieval. It does **not** replace the admin page.

## What was built (v0.2)

- Consistent **findings** records (`src/admin-health/findings.js`) for Projects and Custom Fields
- Deterministic **project recommendation classifications** (`src/admin-health/classify.js`)
- Expandable **duplicate custom-field groups** with type-mismatch highlighting
- Landing summary: Site Health score + findings by severity + category summaries
- Recommendation cards navigate to filtered Project / Custom Field views
- Stacked project and field **cards** (better on narrow screens than wide tables)
- Unit tests in `test/admin-health.test.js`

## Findings architecture

A finding is a plain object:

| Field | Purpose |
|---|---|
| `id` | Stable id (`project:KEY:code` or `field-dup:normalized`) |
| `category` | `Projects` or `Custom Fields` |
| `title` | Short label |
| `severity` | `High` · `Review` · `Informational` |
| `affectedObject` | Key/name/type of the Jira object |
| `reason` | Why it was flagged |
| `evidence` | Counts, ages, field lists, etc. |
| `recommendation` | Advisory next step (never destructive) |
| `classification` | Optional recommendation code |
| `filterKeys` | Keys used by UI filters |

New checks should emit findings through `createFinding` and append to the
category’s `findingRecords`. `summarizeFindings` builds totals by severity.

## Project recommendation rules (exact)

Evaluated in order; first match wins (`classifyProjectRecommendation`):

1. **Archived** → Informational  
   Project is already archived.

2. **Strong archive candidate** → High  
   - Live (not archived)  
   - Empty **or** issue count `< 5`  
   - **And** (days since last issue activity `≥ 365` **or** empty with no activity timestamp)

3. **Review for archive** → Review  
   - Live  
   - Days since activity `≥ 180`  
   - Issue count known and `< 100`

4. **Investigate inactivity** → Review  
   - Inactive (`≥ 90` days since last issue update) and not empty  
   - If issue count `≥ 100`, explanation emphasizes large history

5. **Review ownership** → Review  
   - Missing project lead on a live project

6. **Review empty project** → Review  
   - Empty but not classified as strong archive

7. **Review low volume** → Informational  
   - `0 < issues < 5` only

Admin Health Lab **never** archives, deletes, or modifies projects.

## Custom field rules

- **Duplicate name**: custom fields whose names match after trim + collapse
  whitespace + lower-case, group size `> 1`
- **Type mismatch**: within a duplicate group, more than one distinct field type
  → highlight “Different field types detected”
- Recommendation language confirms purpose; **does not** claim fields should be deleted

## Health score

Unchanged from v0.1 (findings are the primary value):

Start **100**. Subtract (each capped):

- Duplicate field groups: −3 each (max −30)
- Empty projects: −5 each (max −25)
- Inactive projects: −4 each (max −24)
- Missing leads: −2 each (max −10)
- Low-volume projects: −1 each (max −5)

Clamp to `[0, 100]`. UI still lists each deduction line.

## Jira APIs used

| API | Purpose |
|---|---|
| `GET /rest/api/3/project/search?expand=insight,lead&status=live&status=archived` | Projects; type; lead; `totalIssueCount`; `lastIssueUpdateTime` |
| `GET /rest/api/3/field` | System + custom field catalog |

No issue-level fan-out. No new endpoints in v0.2.

## Forge scopes

No new scopes.

| Scope | Why |
|---|---|
| `read:jira-work` | Project search + field catalog |
| `storage:app` | Unchanged; field mapping only (not used by Admin Health Lab) |

## Responsive UI

- Summary / Projects / Custom fields section navigation
- Project findings and duplicate groups render as **stacked cards** (readable on
  narrow screens; still usable on desktop)
- Filters use `Select` instead of dense button rows
- Duplicate groups expand to show field id + type without a wide multi-column table

## Open Admin Health Lab

Development deep link (Configure page):

`https://one-atlas-qzzp.atlassian.net/jira/settings/apps/configure/{appId}/{envId}`

Or Connected Apps → **atlassian-first-app-test** → **Configure**.

## Product discovery notes (API friction)

See also `docs/ADMIN-HEALTH-LAB-REPORT.md` for the v0.2 final report.

| Area | API sketch | Limitation | Likely scopes | Marketplace note |
|---|---|---|---|---|
| Custom field contexts | `/rest/api/3/field/{id}/context` | Per-field fan-out; slow on large catalogs | `read:jira-work` or manage fields | Unused-field detection needs contexts + screens |
| Unused custom fields | contexts + screens + issue search | Expensive; false positives without issue samples | Possibly `read:jira-work` | High admin pain if done safely |
| Workflows / schemes | `/rest/api/3/workflowscheme`, `/workflow` | Many calls; complex graphs | manage workflows / classic admin | Config complexity map is a natural wedge |
| Screens / screen schemes | `/rest/api/3/screens`, screen schemes | Fan-out; naming only without field usage | admin scopes | Pairs with unused-field story |
| Issue type schemes | `/rest/api/3/issuetypescheme` | Site-wide vs project mapping | `read:jira-work` / admin | Useful for sprawl reports |
| Permission schemes | `/rest/api/3/permissionscheme` | Sensitive; hard to summarize | admin | Trust + least privilege required |
| Status proliferation | statuses + workflows | Statuses alone lack project usage | `read:jira-work` | Combine with inactive projects |
| Archive candidates | project `insight` (experimental) | Insight may change; no boards/empty check cheaply | `read:jira-work` | v0.2 classifications are the read-only wedge |
| Config complexity | no single API | Must compose many endpoints | several admin scopes | Biggest long-term product opportunity |

## Limitations

- `expand=insight` is experimental
- No workflows, screens, schemes, field contexts, automation in v0.2
- Duplicate detection is exact normalized-name only (no fuzzy match)
- Configure/`useAsConfig` page — not listed as a Connected Apps row by itself
- Deleted projects omitted (`status=deleted` not requested)
