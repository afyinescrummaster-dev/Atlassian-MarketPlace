# Admin Health Lab v0.2 — Final Report

v0.2 Findings & Recommendations release. Branch:
`cursor/admin-health-lab-v02-0bfb`. Deployed development **4.6.0**.

---

### What Changed

v0.2 keeps Admin Health Lab v0.1 retrieval and scoring, and makes findings
actionable:

- Consistent findings model (Projects + Custom Fields)
- Deterministic project recommendation classifications with explanations
- Landing page: Site Health score, findings by severity, category summaries
- Recommendation cards drill into filtered project/field views
- Expandable duplicate field groups + type-mismatch highlighting
- Stacked cards + Select filters for narrow screens
- No destructive actions; no new Forge scopes; no external AI

### Findings Architecture

`createFinding` / `summarizeFindings` in `src/admin-health/findings.js`.

Each finding: `id`, `category`, `title`, `severity`, `affectedObject`,
`reason`, `evidence`, `recommendation`, `classification`, `filterKeys`.

Project analysis and field analysis emit `findingRecords`; `analyze.js`
merges them into `report.findings`.

### Project Recommendation Rules

First match wins (`src/admin-health/classify.js`):

1. Archived → Informational  
2. Strong archive candidate (High): live + (empty or issues &lt; 5) + (age ≥ 365 or empty with no activity timestamp)  
3. Review for archive (Review): live + age ≥ 180 + issues &lt; 100  
4. Investigate inactivity (Review): inactive (≥ 90 days) and not empty; large history (≥ 100 issues) called out in copy  
5. Review ownership (Review): missing lead  
6. Review empty project (Review)  
7. Review low volume (Informational)

Never archives or modifies Jira.

### Custom Field Rules

- Duplicate: trim / collapse space / lower-case exact name match, group size &gt; 1  
- Type mismatch: &gt;1 distinct type inside a duplicate group → warning + mixed-type recommendation  
- Does not claim matching names must be deleted

### Health Score

Unchanged from v0.1:

100 − capped costs (dup groups −3/max30, empty −5/max25, inactive −4/max24,
missing lead −2/max10, low volume −1/max5); clamp 0–100. Deductions listed in UI.

### Jira APIs Used

| API | Provides |
|---|---|
| `GET /rest/api/3/project/search?expand=insight,lead&status=live&status=archived` | Projects, types, lead, issue count, last update |
| `GET /rest/api/3/field` | System + custom fields |

No per-issue fan-out. No new endpoints in v0.2.

### Forge Scopes

**None added.** Reuses `read:jira-work`. `storage:app` unchanged (mapping only).

### Responsive UI Changes

- Section nav: Summary / Projects / Custom fields  
- Project findings and duplicate groups are stacked cards (mobile-friendly)  
- Filters via Select (All / Inactive / Empty / Low volume / Missing lead /
  Strong archive / Review for archive / Investigate inactivity)  
- Duplicate groups expand to show id + type per field  
- Desktop remains usable; no wide overflowing tables for hygiene lists

### Tests

| Check | Result |
|---|---|
| `npm run lint:code` | pass |
| `npm test` | **44** pass |
| `npm run build` | pass |

Coverage added for classifications, archive-candidate rules, inactivity,
duplicate normalization, same-type vs mixed-type groups, severities, score
determinism.

### Product Opportunities Discovered

1. **Experimental insight** remains the only cheap “last activity” signal —
   productizing stable last-used would sell if insight stays fragile.  
2. **Field contexts / unused fields** need per-field fan-out + screens; not
   viable without careful pagination and scopes.  
3. **Workflows / schemes / screens** have no single complexity API — a guided
   complexity map is the natural paid wedge after findings UX matures.  
4. **Type-mismatched duplicate names** are a concrete admin confusion signal
   already visible without extra APIs.  
5. **Archive candidates** as read-only recommendations (v0.2 classifications)
   fit Marketplace without destructive permissions.

### Marketplace Readiness Assessment

Biggest remaining gaps before a first Marketplace MVP:

1. Discoverability — Configure deep link / Connected Apps only; onboarding
   Get started page and clearer app listing still needed  
2. Depth — no field contexts, unused fields, workflows, or permission schemes  
3. Trust — insight experimental; need explicit “data freshness / partial load”
   UX and exportable evidence  
4. Packaging — scoring + findings UX is promising, but needs polish,
   empty-state education, and maybe CSV export before selling to admins  
5. Least privilege story — stay on `read:jira-work` as long as possible;
   admin-write scopes would raise install friction

### How to open

```
https://one-atlas-qzzp.atlassian.net/jira/settings/apps/configure/c3817645-72ab-47cf-8c1c-a1dff1b69cff/c4313702-63d1-4894-b3ec-b09adfef958f
```

Or Connected Apps → **atlassian-first-app-test** → **Configure**.
