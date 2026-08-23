# Admin Health Lab v0.1 — Final Report

Saved for copy/paste handoff from Cloud Agent work on
`cursor/admin-health-lab-v01-f172`.
PR: https://github.com/afyinescrummaster-dev/Atlassian-MarketPlace/pull/3

---

### What Was Built
- New `jira:adminPage`: **Admin Health Lab** (Jira Admin → Apps)
- Site overview, custom-field hygiene, project hygiene, health score, recommended review
- Pure analysis under `src/admin-health/`; resolver `getAdminHealthReport`; UI Kit page
- Docs: `docs/ADMIN-HEALTH-LAB.md`
- Branch/PR: `cursor/admin-health-lab-v01-f172` — https://github.com/afyinescrummaster-dev/Atlassian-MarketPlace/pull/3
- Existing Project Health / Executive Preview left alone

### Jira APIs Used
| API | Provides |
|---|---|
| `GET /rest/api/3/project/search?expand=insight,lead&status=live&status=archived` | Projects, types, lead, issue count, last update (paginated) |
| `GET /rest/api/3/field` | System + custom fields |

No per-issue fan-out.

### Forge Scopes Added
**None.** Reuses `read:jira-work`. `storage:app` unchanged (mapping only).

### Current Health Rules
- **Duplicate fields:** custom fields with same name after trim / collapse space / lower-case
- **Empty:** `totalIssueCount === 0`
- **Inactive:** last issue update ≥ **90 days** (not empty)
- **Missing lead:** no lead from `expand=lead`
- **Low volume:** `0 < issues < 5`
- **Archived:** informational flag

### Health Score Formula
Start **100**; subtract capped costs: dup groups −3 (max 30), empty −5 (max 25), inactive −4 (max 24), missing lead −2 (max 10), low volume −1 (max 5); clamp 0–100. UI lists each deduction.

### Limitations
- `insight` is experimental
- No workflows / screens / schemes / field contexts / automation
- Name-only duplicates (no fuzzy match)
- Page only visible to Jira admins
- Deleted projects omitted in v0.1

### Future Opportunities Discovered
1. **Experimental insight** — “last used” hygiene is valuable; productizing stable last-activity would sell if insight stays fragile
2. **No config-complexity API** — schemes/workflows need many calls → guided complexity map is a v0.2+ wedge
3. **Semantic duplicates / unused fields** need context data Jira doesn’t expose cheaply
4. **Lead expand gaps** — ownership hygiene is messier than the UI implies
5. **Archive candidates** (inactive + empty) as read-only recommendations fit Marketplace without destructive actions

### Verification Results
| Check | Result |
|---|---|
| typecheck | N/A (JS repo, no typecheck script) |
| `npm run lint:code` | pass |
| `npm test` | **37** pass |
| `npm run build` | pass |
| Live Jira / admin page / existing reports | **needs deploy** — start a **new** agent with secrets, then `forge deploy -e development --non-interactive` (+ install upgrade if prompted) |

Manual after deploy: confirm Project Health + Executive Preview still work, then open **Settings → Apps → Admin Health Lab**.
