# Delivery Intelligence for Jira

Working product name: **Delivery Intelligence for Jira**  
Version: **1.0.0** — Sprint Health + Rovo Intelligence  
Forge app location: `apps/delivery-intelligence/`  
Status: **V1 milestone `di-v1.0.0`** @ `c780ff5`. Next increment
(features 1–5: Scope Movement, attention items, drill-downs, current vs
previous sprint, distinct Rovo intents) is on
`feature/sprint-intelligence-core`. Do not merge until live Jira
acceptance. Live development deploy for this increment: **2.16.0**
from `1523b75` (`deploy/di/development/2.16.0`). Historical recovered
known-good remains `di-v0.1.1` @
`4f44eb3` — do not delete. See `docs/RECOVERY-2.8.0.md`. Working rules:
`AGENTS.md`. Deploy log: `docs/DEPLOYMENT-HISTORY.md`.

Forge app ID:

`ari:cloud:ecosystem::app/f7a87d39-d904-408d-9415-72b1052a7026`

Demo site: `https://one-atlas-qzzp.atlassian.net` — open any Jira Software project → **Delivery Intelligence** project page.

---

## Customer problem

Delivery teams need to understand sprint health quickly: what is blocked, what
scope changed after sprint start, what carried over, and what needs attention.
Leaders want concise risk explanations without manual spreadsheet work.

This product answers: **What needs attention in the current sprint, and why?**

---

## V1 milestone — Sprint Health + Rovo Intelligence

Official tag: **`di-v1.0.0`** (`c780ff5`). Future major work compares
against this baseline. `di-v0.1.1` stays as historical recovered
known-good proof.

V1 includes:

- Deterministic sprint health
- Original sprint commitment reconstruction
- Scope growth detection
- Carryover logic
- Blocked and stale work detection
- Health score
- Rovo explanation / recommendation / leadership brief
- Verified PLAT acceptance behavior
- Clean Git recovery baseline
- CMS-style Forge deployment history and rollback

---

## Product boundary (v0.1)

**In scope**

- Deterministic sprint intelligence from real Jira Agile + issue data
- Sprint Health score and ranked anomalies
- Explicit Rovo actions (Explain / Recommend / Leadership brief)
- Forge `rovo:agent` with read-only actions

**Out of scope**

- Write operations (comments, transitions, links, creation, sprint edits)
- Automatic AI on dashboard load, refresh, or navigation
- Marketplace publish / pricing
- Automation with preview/approval/audit (future v0.3)

---

## Architecture

```
Jira Agile + issue APIs
  → Forge resolver (apps/delivery-intelligence/src/resolvers/)
  → Delivery Intelligence domain engine (src/delivery-intelligence/)
  → Structured health snapshot JSON
  → Custom UI dashboard (static/dashboard/)

User clicks AI action
  → rovo.open({ type: "forge", agentKey, short natural-language prompt })
  → Delivery Intelligence agent calls get-sprint-health-snapshot
  → Agent explains the sprint from action results
```

The deterministic engine has **no Rovo dependency**. Rovo interprets facts; it
does not recalculate objective metrics.

See also: `docs/ROVO-DELIVERY-INTELLIGENCE-ARCHITECTURE.md`

---

## Code locations

| Layer | Path |
|---|---|
| Forge entry | `apps/delivery-intelligence/src/index.js` |
| Manifest | `apps/delivery-intelligence/manifest.yml` |
| Dashboard resolver | `src/resolvers/delivery-dashboard.js` |
| Rovo action handlers | `src/resolvers/rovo-actions.js` |
| Domain engine | `src/delivery-intelligence/` |
| Jira Agile client | `src/jira/agile-client.js` |
| Custom UI | `static/dashboard/` |
| Agent prompt | `resources/agent-prompts/delivery-agent.txt` |
| Unit tests | `test/analyze.test.js` |
| Shared Jira helpers | `packages/shared-jira/` |

---

## Forge modules

| Module | Key | Purpose |
|---|---|---|
| `jira:projectPage` | `delivery-intelligence-dashboard` | Deterministic dashboard (Custom UI, `layout: blank`) |
| `rovo:agent` | `delivery-intelligence-agent` | Delivery Intelligence agent |
| `action` | `get-sprint-health-snapshot` | Compact health snapshot for agent |
| `action` | `get-issue-delivery-context` | One issue + sprint summary |
| `action` | `get-scope-changes` | Post-start scope metrics |
| `action` | `get-carryover-history` | Carryover metrics when changelog available |

---

## Required scopes (read-only)

| Scope | Why |
|---|---|
| `read:jira-work` | Issue changelog |
| `read:sprint:jira-software` | Sprints and sprint metadata |
| `read:board-scope:jira-software` | Board list |
| `read:project:jira` | Project context |
| `read:issue-details:jira` | Sprint issue fields |
| `read:jql:jira` | Sprint issue retrieval |

Added automatically by `forge lint --fix` after registration. All read-only — no write scopes.

---

## Deterministic metrics

All dashboard numbers come from Jira data via `loadDeliveryContext()` and
`buildHealthSnapshot()`.

| Metric | Definition | Unavailable when |
|---|---|---|
| **Completion %** | Done issues / sprint issues × 100 | No active sprint or no issues |
| **Scope change %** | Added after start / original commitment × 100 | Sprint start missing or no sprint changelog |
| **Original commitment** | Issues already in the sprint at or before start | No sprint changelog |
| **Added issue count** | First join of current sprint strictly after start | No sprint changelog |
| **Carryover count** | Open issues with a different prior sprint in changelog | No sprint changelog |
| **Blocked count** | Open issues with blocked status/label or blocking link types | Never (best-effort on link metadata) |
| **Stale count** | Open issues with no update ≥ 7 days | Never |

Capabilities object on snapshot:

- `capabilities.scopeChange.status`: `available` | `partial` | `unavailable`
- `capabilities.carryover.status`: `available` | `partial` | `unavailable`

Never fabricate unavailable metrics — UI shows `—`.

Sprint baseline rule: membership at the last sprint-field changelog with
timestamp **≤ sprint start** is original commitment. First join **strictly
after** start is added scope. Carryover requires a *different* prior sprint
in changelog plus current-sprint membership, and the issue must still not be
Done. No created-date fallback and no 24-hour carryover window.

---

## Sprint Health scoring

Start at **100**. Deductions (capped):

| Signal | Rule |
|---|---|
| Scope change | −4 per 10% increase (max 20) |
| Carryover | −3 per issue (max 15) |
| Blocked | −5 per issue (max 20) |
| Stale | −2 per issue (max 10) |
| Low completion | −10 if completion &lt; 50% |

Status bands:

- ≥ 80 → **On Track**
- ≥ 60 → **At Risk**
- &lt; 60 → **Needs Attention**

Implementation: `src/delivery-intelligence/score.js`

---

## Structured health snapshot fields

`getDeliveryHealth` / Rovo actions return:

- `healthScore`, `healthStatus`, `healthMax`
- `originalCommittedCount`, `currentIssueCount`, `addedIssueCount`, `scopeChangePercent`
- `originalCommittedIssueKeys` / `originalCommittedIssues`
- `addedIssueKeys` / `addedIssues`
- `removedIssueCount` is null until removal history is trustworthy
- `completionPercent`, `doneIssues`, `openIssues`
- `carryoverCount`, `carryoverIssueKeys`, `carryoverIssues`
- `blockedCount`, `blockedIssues`
- `staleCount`, `staleIssues`
- `topAnomalies[]` (severity, explanation, evidence, suggested action, drill-down)
- `previousSprint`, `previousSprintMetrics`, `metricDeltas`, `comparison`
- `context` (project, board)
- `sprint` (id, name, dates)
- `capabilities` (`scopeChange`, `carryover`, `scopeRemovals`, `comparison`)
- `limitations`

---

## Rovo agent behaviour

- Name: **Delivery Intelligence**
- Prompt file: `resources/agent-prompts/delivery-agent.txt`
- Must treat action output and user FACTS as quantitative truth
- Must not claim Jira was modified
- Conversation starters:
  - Explain this sprint's delivery risks.
  - Recommend the highest-priority actions for this sprint.
  - Generate a concise leadership brief for this sprint.
- Visible user prompts stay natural language. Do not put raw JSON or FACTS blocks in the Rovo open prompt.

---

## Rovo actions (read-only)

| Action key | Handler | Returns |
|---|---|---|
| `get-sprint-health-snapshot` | `getSprintHealthSnapshot` | Compact snapshot |
| `get-issue-delivery-context` | `getIssueDeliveryContext` | Issue row + sprint summary |
| `get-scope-changes` | `getScopeChanges` | Scope metrics + capability |
| `get-carryover-history` | `getCarryoverHistory` | Carryover metrics + capability |

Responses are intentionally small (top anomalies capped, no full backlog dump).

---

## Rovo limitations (MVP)

1. **No headless Rovo invoke** — dashboard cannot silently receive structured AI JSON.
2. Supported flow: deterministic dashboard → user clicks AI → `rovo.open()` → chat.
3. Free Jira sites have no Rovo — dashboard still works; AI panel shows fallback copy.
4. Customer Rovo credits apply to agent usage (not vendor LLM billing).

---

## Rovo availability fallback

- Dashboard always loads deterministic metrics first.
- `rovo.isEnabled()` checked once on mount (not on every render action).
- If false: show note; do not fail the page.
- AI buttons still attempt `rovo.open()` with graceful error message if open fails.

**Never** call Rovo on load, refresh, filter change, or metric calculation.

---

## Manual Forge app registration

**Done** for the demo site via `scripts/register-delivery-intelligence.sh`.

For a fresh clone or new environment, run:

```bash
chmod +x scripts/register-delivery-intelligence.sh
./scripts/register-delivery-intelligence.sh
```

See `docs/DELIVERY-INTELLIGENCE-LAPTOP-SETUP.md` for a laptop agent takeover prompt.

---

## Testing

**Domain engine (no Forge):**

```bash
cd apps/delivery-intelligence
npm test
```

**Build Custom UI:**

```bash
cd apps/delivery-intelligence
npm run build
```

**Manifest (after registration):**

```bash
cd apps/delivery-intelligence
forge lint
```

**Manual UI verification**

1. Open a Jira Software project with an active sprint.
2. Navigate to **Apps → Delivery Intelligence** project page (after install).
3. Confirm KPI cards match sprint data.
4. Confirm dashboard loads with Rovo **not** invoked.
5. Click **Explain sprint** — Rovo sidebar opens with a natural-language prompt. No raw JSON.
6. Confirm legacy Admin Health Configure link still works (root app unchanged).

---

## Deployment

Deploy only from `apps/delivery-intelligence/` after registration.

Do **not** run root `forge deploy` expecting Delivery Intelligence to ship — the
root manifest still targets the legacy app only.

---

## Known limitations (v0.1)

- Changelog fetched for first 40 sprint issues only (cost control)
- Sprint issues capped at 200
- Carryover requires sprint field changelog history
- Board API may need scope adjustment on some sites
- Soft dependency inference not implemented (formal links/status only)
- No briefing cache in KVS yet

---

## Do-not-break constraints

- Do not change legacy root `manifest.yml` app ID
- Do not add write scopes without an approved automation phase
- Do not merge Delivery Intelligence into Admin Health modules
- Do not hardcode demo metrics in UI or tests beyond synthetic unit fixtures

---

## Recommended next phase (v0.2)

- KVS cache for snapshots and optional AI briefings
- Dependency intelligence (formal links + explicit investigate CTA)
- Board picker when multiple boards exist
- `forge lint --fix` scope audit on demo site

---

## Related docs

- `AGENTS.md` — Git + Forge working rules
- `docs/DEPLOYMENT-HISTORY.md` — every recorded Forge deploy
- `docs/RECOVERY-2.8.0.md` — 2.8.0 recovery handoff (read before rollback)
- `docs/PRODUCT-INDEX.md`
- `docs/MULTI-APP-REPO-STRATEGY.md`
- `docs/ROVO-DELIVERY-INTELLIGENCE-ARCHITECTURE.md`
