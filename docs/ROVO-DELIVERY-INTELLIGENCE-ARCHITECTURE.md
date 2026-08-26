# Rovo / Forge AI Feasibility — Delivery Intelligence Architecture Assessment

**Status:** Research only — no implementation  
**Date:** 2026-08-26  
**Sources:** Current Atlassian developer docs (Forge `rovo:agent`, bridge `rovo`, Action module, Forge pricing), Atlassian Support (Rovo usage limits, Marketplace agents, data handling), and developer community confirmation of API gaps.

---

## Executive recommendation

**Rovo-first (with a constrained invocation model), not External AI-first.**

Rovo is commercially attractive for a Marketplace vendor: **customers pay Rovo credits from their org allowance; the vendor is not billed for LLM tokens**. You still pay normal **Forge compute/storage** when agent **actions** run your functions.

The critical technical constraint: **there is still no supported headless API to call a Rovo agent from a Forge function and receive a structured response into your Custom UI/UI Kit.**  
`rovo.open()` only opens the **chat sidebar** with an optional prompt. Automation can invoke agents **asynchronously**.

Therefore the viable near-term architecture is:

> **Deterministic engine in Forge (always on) → explicit AI buttons open your Forge Rovo agent with a pre-built facts payload → agent may call Forge actions (your logic) → optional action persists a briefing to KVS → UI reads cache.**

That preserves near-zero vendor AI cost, Marketplace fit, and a useful non-AI core — while accepting that “AI panel inside the dashboard” is conversational / action-mediated today, not a silent server-side LLM round-trip.

---

## 1. What Rovo can currently do

| Capability | Supported today? | Notes |
|---|---|---|
| Ship a Marketplace Forge app that **includes its own Rovo Agent** | **Yes** | `rovo:agent` in `manifest.yml`; installs with the app |
| Define agent behaviour via prompt (+ resource file) | **Yes** | Prompt inline or `resource:…;path` |
| Attach **actions** implemented as Forge functions | **Yes** | `action` module → Forge function / Remote endpoint |
| Agent invokes **your** business logic | **Yes** | Actions call your resolvers/functions; you return structured data to the agent |
| Users chat with the agent in Rovo Chat / `/ai` | **Yes** | Chat panel, editors, agent directory |
| App UI opens agent with a prefilled prompt | **Yes** | `@forge/bridge` `rovo.open({ type: "forge", agentKey, agentName, prompt })` |
| Detect if Rovo is enabled for the tenant | **Yes** | `rovo.isEnabled()` |
| Automation rules invoke agent async | **Yes** | Rule-specific extra prompt; response via smart values |
| Expose actions to customer Studio agents | **Yes (opt-in)** | `rovo:mcp` / related tooling; `read:chat:rovo` expands reuse |
| Distribute via Marketplace | **Yes** | Partner EULA/privacy on listing; agents appear after app install |

### Modules (MVP)

```yaml
modules:
  rovo:agent:
    - key: delivery-intelligence-agent
      name: Delivery Intelligence
      description: Explains sprint health, risks, and recommended actions
      prompt: resource:agent-prompts;prompts/delivery-agent.txt
      conversationStarters:
        - Explain this sprint's top risks
        - Draft a leadership brief
        - Suggest missing dependencies
      actions:
        - get-sprint-health-snapshot
        - search-related-issues
        - save-ai-briefing
        # create-issue-link only if you accept write scope later
  action:
    - key: get-sprint-health-snapshot
      name: Get sprint health snapshot
      function: getSprintHealthSnapshot
      actionVerb: GET
      description: Returns precomputed sprint health metrics and anomalies for a board/sprint
      inputs: { ... }
```

Plus existing UI modules (project page / admin page / etc.).

### Permissions / scopes (indicative)

- Existing Jira read scopes for sprint/issue data (`read:jira-work`, and whatever Agile/sprint APIs require — validate per endpoint).
- `storage:app` for cached briefings / hashes.
- Optional later: write scopes only for “create suggested link” after user approval.
- Rovo-specific: follow current Forge docs for any `read:chat:rovo` if exposing tools to customer agents.
- App-based agents only see data in the **workspace where the app is installed** (Jira-only install ≠ automatic Confluence knowledge).

---

## 2. What it cannot do (today)

| Gap | Impact on your vision |
|---|---|
| **No headless `requestRovo(prompt) → structured JSON`** from Forge backend/UI | Cannot silently fill an in-app “AI briefing” panel without chat or an action that writes results back |
| `rovo.open()` is **UI-only** | Cannot fire from scheduled Forge triggers / pure backend |
| Automation agents are **async** | Fine for digests; not for instant dashboard paint |
| App agents lack automatic cross-product memory unless multi-app install | Confluence AC / design docs not auto-visible from a Jira-only app |
| Agent quality is prompt + actions + Rovo models — **not** fine-tuned proprietary models you control | Harder to guarantee identical wording/format every time |
| Safety screening / AUP | Atlassian may block/suspend agents that violate AI Acceptable Use |
| Free Jira | **No Rovo** — AI features unavailable |

Community consensus (early 2025 → still open as of 2026 discussions): partners want a programmatic invoke API; it is **not** shipped. Design as if it may arrive later, but **do not depend on it for MVP**.

---

## 3. Pricing / usage implications

### Who pays for AI?

From current **Forge platform pricing** guidance:

- **Rovo credits** for agent/chat usage → **customer org’s pooled allowance**
- **Marketplace partners are not billed for those Rovo credits**
- When an agent calls a Forge **action**, **Forge compute/storage/logs** for that function → **developer (you)** under Forge consumption pricing
- Paid Marketplace license (if any) → customer, as usual

### Customer Rovo credits (current published allowances)

Pooled monthly, per paid Cloud seat (approx.):

| Plan | Credits / user / month (Jira) |
|---|---|
| Free | **No Rovo** |
| Standard | **25** |
| Premium | **70** |
| Enterprise | **150** |

Published agent chat cost order-of-magnitude: on the order of **~10 credits per agent request** (confirm against latest usage-limits page before packing pricing copy).

Atlassian states they are **not currently billing overages**; ≥90 days notice + explicit opt-in before charging extras.

### What you still pay

- Forge invocations for resolvers that power the **deterministic dashboard** (every refresh)
- Forge invocations when Rovo **actions** run
- KVS storage for caches
- Normal Marketplace / support costs

### Exhausted allowance / AI off / Free

- `rovo.isEnabled()` → false or agent fails → **show Core Delivery Intelligence only**
- Do not hard-fail the app
- Message: “AI insights need Rovo (paid Jira plan with AI enabled). Metrics below still work.”

---

## 4. Recommended MVP architecture

### Principle

**Jira data → deterministic calculation → (optional) Rovo interpretation**

AI never owns arithmetic. AI owns language, prioritization narrative, soft inference, and recommendations.

### Practical flow (works with today’s APIs)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Dashboard load (NO AI)                               │
│    UI → invoke(getDeliveryHealth)                       │
│    Resolver → Jira APIs → rules engine → JSON metrics   │
│    UI renders healthScore, tables, anomalies            │
│    Optional: read KVS lastBriefing if hash matches      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ user clicks “Explain risks”
┌─────────────────────────────────────────────────────────┐
│ 2. Explicit AI trigger                                  │
│    Build compact FACTS payload (metrics + top N issues) │
│    if (!await rovo.isEnabled()) → graceful CTA          │
│    else rovo.open({ type:"forge", agentKey, prompt })   │
│    Prompt embeds FACTS + instruction template           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ Rovo agent (customer credits)
┌─────────────────────────────────────────────────────────┐
│ 3. Agent reasoning                                      │
│    May call action: get-sprint-health-snapshot (GET)    │
│    May call action: search-related-issues (GET)         │
│    Produces explanation / brief in Chat                 │
│    Optional action: save-ai-briefing → KVS              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 4. UI refresh                                           │
│    Shows cached briefing + timestamp + “Regenerate”     │
└─────────────────────────────────────────────────────────┘
```

This is **not** exactly `… → Rovo → UI` as a single synchronous pipeline, but it achieves the product intent with supported primitives.

### Ideal future flow (when/if headless API exists)

```
Jira → resolver → deterministic engine → requestRovo(structured) → cache → UI
```

Keep interfaces such that swapping chat-open for headless invoke is localized.

---

## 5. Recommended Forge / Rovo modules

| Module | Role |
|---|---|
| Existing UI (`jira:projectPage` / settings / etc.) | Deterministic Delivery Intelligence dashboard |
| `rovo:agent` | Delivery Intelligence agent |
| `action` × N | Snapshot fetch, Jira search helpers, save briefing, (later) create link |
| Forge function + pure JS engine package | Sprint math, aging, carryover, etc. |
| `storage:app` (KVS) | Settings, analysis cache, briefing store |
| Optional later `rovo:mcp` | Let customer Studio agents reuse your tools |

---

## 6. Required permissions / scopes

**MVP (read-heavy):**

- Jira read scopes sufficient for boards, sprints, issues, changelogs, issue links, comments (exact set TBD per API — keep least privilege)
- `storage:app`

**AI path:**

- No vendor OpenAI key
- Customer must have Rovo enabled
- Disclose AI use on Marketplace listing; partner EULA/privacy

**Later (dependency approve → create link):**

- Write scope for issue links only after explicit user confirmation in UI/agent

---

## 7. Recommended AI-trigger design

**Never call AI on dashboard render.**

Explicit CTAs only, e.g.:

- Analyze Sprint  
- Explain Risk  
- Recommend Actions  
- Generate Leadership Brief  
- Investigate Dependency  
- Summarize Project  
- Review Epic / Feature Health  

Each CTA:

1. Ensures deterministic snapshot is fresh (or recomputes cheaply)  
2. Checks `rovo.isEnabled()`  
3. Opens agent with **bounded** prompt (token discipline: top anomalies, not whole backlog)  
4. Logs trigger time / input hash locally in KVS for cache invalidation  

Aligns with credit scarcity on Standard (25/user/month).

---

## 8. Recommended caching strategy

| Store | Contents | Key ideas |
|---|---|---|
| KVS `delivery-health:{projectKey}:{sprintId}` | Deterministic metrics JSON + `inputHash` + `computedAt` | Invalidate when sprint issue set / updated watermark changes |
| KVS `delivery-brief:{projectKey}:{sprintId}` | AI briefing text/markdown, `agentVersion`, `factsHash`, `createdAt`, `createdBy` | Show until `factsHash` differs or user hits Regenerate |
| Optional entity property | Only if you need issue-level sticky notes — prefer KVS for site hygiene |

**Safe rules:**

- Cache AI aggressively; regenerate only on demand or hash change  
- Never store secrets  
- Treat briefings as advisory; show “Generated by Rovo · not verified”  
- Size-limit payloads (KVS limits) — store summary, not raw comment dumps  

---

## 9. Deterministic vs AI responsibility matrix

| Capability | Deterministic (Forge) | Rovo |
|---|---|---|
| Sprint scope added/removed vs start | **Primary** | Explain impact |
| Carryover count | **Primary** | Narrative |
| Completion % / burndown facts | **Primary** | Leadership wording |
| Blocked count / time-in-status | **Primary** | Prioritize which blocked items matter |
| Stale / aging thresholds | **Primary** | Soften/contextualize |
| Formal issue links graph | **Primary** | Suggest missing links |
| “Waiting on Payments API…” in description | Weak NLP rules possible later | **Primary** inference |
| Ranking “what should leadership care about?” | Heuristic scoring OK | **Primary** for nuanced ranking |
| Executive briefing prose | Template OK | **Primary** |
| Creating Jira links | After user confirm | Can propose; action performs |

**Long-term:** use Rovo offline (or Studio experiments) to discover recurring patterns → encode as deterministic rules → shrink runtime AI. That matches your “AI as R&D for the rules engine” strategy and improves Free/no-Rovo UX over time.

---

## 10. Dependency detection (special topic)

### What works

1. **Deterministic:** traverse `issuelinks`, epic children, parent, components, labels.  
2. **Rovo:** given issue text (summary/description/comments) + candidate search results from a Forge **action** that runs JQL/`search/jql`, infer likely missing dependency.  
3. **Human-in-the-loop:** UI/agent proposes “Link to PAY-123?” → user approves → Forge action creates link.

### What does not work reliably

- Fully automatic link creation without confirmation (trust + Marketplace risk)  
- Guaranteed discovery of all soft dependencies  
- Cross-site / uninstalled Confluence context for app agents  
- Silent high-volume LLM scan of every comment on every dashboard load (credits + latency)

### Recommended MVP for dependencies

- Show formal link graph always (no AI)  
- Button **Investigate possible missing dependencies** on a selected issue or sprint anomaly  
- Action returns top N candidates (JQL by project/team keywords + recent issues)  
- Agent ranks/explains; user approves link  

---

## 11. Security, privacy, Marketplace

| Topic | Assessment |
|---|---|
| Data to LLMs | Rovo uses Atlassian + third-party hosted LLMs; Atlassian states **no training** on customer data by third-party providers; ZDR agreements claimed |
| Residency | Rovo data residency GA; pin with product residency — still verify in-scope vs out-of-scope AI artifacts for regulated buyers |
| Permissions | Agent/actions run as user context for Jira ops — respect existing ACLs |
| Marketplace | Disclose AI features; partner privacy/EULA; safety screening of agents |
| Enterprise adoption risk | Org may disable AI; Free has no Rovo; credit exhaustion; residency questionnaires |
| Vendor external OpenAI | Higher disclosure + DPA burden; you pay tokens; often harder enterprise sell |

**Flag:** Sending full comment history into prompts increases sensitivity. Prefer **redacted structured facts + short excerpts**.

---

## 12. Graceful non-AI mode

| Layer | Always | When Rovo available |
|---|---|---|
| Health score, scope change, carryover, aging, blocked | Yes | Same |
| Anomaly list | Yes | + Explain / Prioritize |
| Leadership brief | Template stub or hidden | Rovo generate + cache |
| Dependency suggestions | Formal links only | Soft inference CTA |

Detection: `rovo.isEnabled()` + catch open/action failures.  
UI: metrics first; AI as upgrade lane — never a blank dashboard.

---

## 13. Rovo vs external LLM vs hybrid

| | Rovo-first | External API | Hybrid |
|---|---|---|---|
| **Vendor AI $** | Near zero (credits on customer) | High / unpredictable | Medium |
| **Forge $** | Actions + resolvers | Resolvers + egress | Both |
| **In-Jira UX** | Native chat + agents | Custom panels | Custom + Rovo |
| **Structured in-UI AI** | Weak today (no headless) | Strong | Strong via external |
| **Privacy / Marketplace** | Best aligned | Heavier | Dual disclosure |
| **Jira context** | Strong via actions + permissions | You re-fetch & send | Split |
| **Lock-in** | Atlassian | Model vendor | Managed |
| **Free / no AI tenants** | Core still works | Core still works | Same |

**Recommendation:** **Rovo-first** for Marketplace economics and trust. Revisit **hybrid** only if (a) headless Rovo never arrives and (b) in-panel structured AI becomes a hard GTM requirement — then isolate behind an interface.

---

## 14. Proposed MVP feature set

**Core (no AI):**

- Sprint health metrics (scope change, carryover, completion, blocked, stale/aging)  
- Deterministic health score + anomaly list  
- Formal dependency / epic structure views  

**AI (explicit triggers):**

- Explain top risks  
- Leadership brief  
- Recommend actions  
- Investigate missing dependency (propose only)  

**Platform:**

- Cache metrics + briefings in KVS  
- `rovo.isEnabled()` gating  
- Marketplace AI disclosure  

**Out of MVP:** auto-link creation, always-on AI, workflow AI, Confluence-wide reasoning without multi-app install.

---

## 15. Phased implementation plan

### Phase 0 — Architecture spike (1–2 weeks)

- Hello-world `rovo:agent` + one GET action returning fake metrics  
- UI button → `rovo.open` with facts blob  
- Action `save-ai-briefing` → KVS → UI readback  
- Validate credits behaviour on Standard test site  

### Phase 1 — Deterministic Delivery Intelligence

- Real sprint/issue fetch + rules engine  
- Dashboard without AI  
- Hash-based metric cache  

### Phase 2 — Rovo agent productization

- Prompt engineering for risk explain / brief / actions  
- Conversation starters aligned to CTAs  
- Credit-aware UX copy  

### Phase 3 — Soft dependency assistant

- Candidate search action + propose UI  
- Optional write path behind confirm  

### Phase 4 — Rules distillation

- Mine recurring AI recommendations → encode thresholds  
- Shrink AI dependency for common cases  

### Phase 5 — Reassess headless / hybrid

- If Atlassian ships invoke API → in-panel briefs  
- Else decide hybrid only with clear enterprise packaging  

---

## 16. Risks / limitations (summary)

1. No synchronous structured Rovo response into Custom UI today  
2. Customer credit limits (especially Standard) constrain AI frequency  
3. Free / AI-disabled orgs get metrics only  
4. Experimental/changing Rovo packaging and credit enforcement  
5. Agent safety review can block distribution  
6. Insight/sprint API quality and permissions vary by project type  
7. Soft dependency NLP will false-positive — must stay suggestive  

---

## 17. Clear recommendation

### **Rovo-first**

**Why**

- Matches your primary constraint: **near-zero ongoing vendor LLM cost**  
- Native Marketplace distribution of agents  
- Actions let Rovo call **your** deterministic engine (facts stay yours)  
- Privacy/Marketplace story cleaner than shipping OpenAI keys  
- Product remains valuable without AI  

**Why not External AI-first**

- You become the metered party; enterprise DPAs harder; weaker “included with Jira” story  

**Why not Hybrid yet**

- Extra complexity and dual compliance before the headless gap is proven fatal  

### Proposed technical flow (today)

```
Jira APIs
  → Forge resolver
  → Deterministic intelligence engine (structured facts)
  → Jira UI (always)
  → [User CTA]
  → rovo.open(Forge agent + facts prompt)
  → Rovo Agent (customer credits)
  → optional Forge actions (your logic / save cache)
  → KVS cached briefing
  → Jira UI shows cache
```

**Do not implement the AI layer until Phase 0 spike validates agent + action + cache on a real Standard/Premium site.** Deterministic Delivery Intelligence can proceed independently and should ship first.

---

## Appendix — Key references (verify before build)

- https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-agent/  
- https://developer.atlassian.com/platform/forge/manifest-reference/modules/rovo-action/  
- https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/rovo/  
- https://developer.atlassian.com/platform/forge/forge-platform-pricing/  
- https://support.atlassian.com/rovo/docs/rovo-usage-limits/  
- https://support.atlassian.com/rovo/docs/marketplace-agents/  
- https://www.atlassian.com/software/rovo/guides/admin-guide/rovo-data-usage-privacy  
