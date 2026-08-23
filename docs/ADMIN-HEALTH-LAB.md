# Admin Health Lab v0.1 — technical notes

## What was built

- `jira:adminPage` titled **Admin Health Lab** (Apps section in Jira admin)
- Site overview (project counts by type, active vs potentially inactive)
- Custom field overview (counts by type, duplicate-name groups)
- Project hygiene findings with explanations
- Deterministic Site Health Score + Recommended Review cards
- Extensible `src/admin-health/` analysis modules
- Unit tests in `test/admin-health.test.js`

## Jira APIs used

| API | Purpose |
|---|---|
| `GET /rest/api/3/project/search?expand=insight,lead&status=live&status=archived` | Paginated projects; type; lead; `totalIssueCount`; `lastIssueUpdateTime` |
| `GET /rest/api/3/field` | System + custom field catalog |

No issue-level fan-out. Activity uses experimental project **insight**, not one JQL per project.

## Forge scopes

No new scopes. Continues to use:

| Scope | Why |
|---|---|
| `read:jira-work` | Project search + field catalog (also existing project reports) |
| `storage:app` | Unchanged; field mapping only (not used by Admin Health Lab) |

## Health rules

- **Duplicate fields**: custom fields whose names match after trim + collapse whitespace + lower-case
- **Empty project**: `insight.totalIssueCount === 0`
- **Potentially inactive**: `lastIssueUpdateTime` age ≥ 90 days (and not empty)
- **Missing lead**: `expand=lead` returned no lead object
- **Low volume**: `0 < totalIssueCount < 5`
- **Archived**: listed via `status=archived` / `archived === true` (informational)

## Score formula

Start **100**. Subtract (each capped):

- Duplicate field groups: −3 each (max −30)
- Empty projects: −5 each (max −25)
- Inactive projects: −4 each (max −24)
- Missing leads: −2 each (max −10)
- Low-volume projects: −1 each (max −5)

Clamp to `[0, 100]`. UI shows each deduction line.

## Limitations

- `expand=insight` is experimental
- No workflows, screens, schemes, field contexts, automation
- Duplicate detection is exact normalized-name only (no fuzzy match)
- Admin page visibility requires Jira Administration access (product role)
- Deleted projects not included (`status=deleted` omitted on purpose for v0.1)

## Future Marketplace opportunities (API friction discovered)

1. **Insight is experimental** — admins need “last used” project hygiene; Atlassian marks insight experimental. A productized “Project last activity” view with clear SLAs would be valuable if insight stays unstable.
2. **No single “config complexity” API** — workflows, schemes, and field contexts require many endpoints. A guided complexity map is a natural v0.2+ product wedge.
3. **Duplicate fields are name-only** — Jira does not expose “semantically same field used in different contexts” cheaply. Context-aware unused-field detection is a strong admin pain.
4. **Lead expand can be empty** for some project shapes — ownership hygiene is harder than the UI suggests.
5. **Archived vs inactive live projects** are different problems; packaging “safe archive candidates” (inactive + empty + no boards?) as read-only recommendations is Marketplace-friendly without destructive actions.
