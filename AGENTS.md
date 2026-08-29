# Agent notes

> **Every visible Forge deployment must have an exact Git revision we can
> return to. Every accepted version must eventually flow through `main`,
> and important accepted versions receive permanent tags.**
>
> **GitHub, not either chat, is the coordination layer between agents.**

Before starting work, read these in order:

1. **This file** — working rules and current status
2. **`docs/PRODUCT-INDEX.md`** — which product doc and code roots to use
3. **`docs/DEPLOYMENT-HISTORY.md`** — every recorded Forge development deploy
4. **`docs/RELEASES.md`** — official tagged milestones only
5. **`docs/RELEASE-PROCESS.md`** — how to tag, deploy, and roll back
6. **`docs/CHAT-CONTEXT.md`** — global Forge constraints, secrets, legacy app
7. **`docs/MULTI-APP-REPO-STRATEGY.md`** — monorepo layout
8. **`.cursor/session-history.md`** — recent session log

New Cloud Agent runs do **not** inherit prior Cursor chat UI transcripts.
GitHub plus these files are the durable memory. Fetch and inspect remote
state before changing or deploying. Do not invent release tags; the user
names them.

## Status (2026-08-29) — recovery closed; `di-v0.1.1` is known-good

**Known-good Delivery Intelligence:** tag `di-v0.1.1` → Git `4f44eb3` →
contained in `main` via `8b570a9` → Forge development **2.13.0** →
PLAT accepted.

`di-v0.1.0` and `7743ec7` are **not** that source. Story:
`docs/RECOVERY-2.8.0.md`.

**Delivery Intelligence v0.1** is a **separate Forge app**
(`apps/delivery-intelligence/`), registered as
`ari:cloud:ecosystem::app/f7a87d39-d904-408d-9415-72b1052a7026`.
Installed on `one-atlas-qzzp.atlassian.net`.

**Legacy app:** Jira Admin Health v0.4 — development **4.8.0** on root manifest
(`ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`). Do not
change that ID.

1. For Delivery Intelligence: read `docs/products/delivery-intelligence.md` first.
2. DI is already registered. Deploy from `apps/delivery-intelligence/` only.
3. Legacy deploy unchanged: `npm run lint:code && npm test && npm run build && forge deploy -e development --non-interactive`
4. Do not change registered Forge app IDs.

---

## Git + Forge working rules

These rules apply to every mobile and desktop agent.

**1. `main` means accepted code.**  
Do not develop directly on `main`. New work starts from the current
accepted `main` on a separate branch.

**2. Every meaningful change gets committed before deployment.**  
Never deploy a dirty working tree. Forge deployments must always map to
an exact Git commit SHA.

**3. Every test deployment is recoverable — even before `main`.**  
Use `./scripts/forge-deploy.sh <di|legacy> development` so the SHA is
captured automatically. That writes `docs/deployments.jsonl` and
refreshes `docs/DEPLOYMENT-HISTORY.md`. Record:

- app/product
- branch
- Git SHA
- Forge environment
- Forge version
- deployment timestamp

This is the CMS/frontend-style revision history.

**4. Development branches are allowed to have many deployed revisions.**  
Example: `feature/scope-intelligence` commit A → Forge dev 2.14, B → 2.15,
C → 2.16. If 2.16 is bad, redeploy 2.15 from its recorded SHA without
merging anything to `main`.

**5. Deploying does NOT mean known-good.**  
A development deployment only means “available for testing.”

**6. Tested + accepted → merge to `main`.**  
Once the user verifies a build, that branch can be merged into `main`.

**7. `main` is the current accepted line; tags preserve historical
known-good milestones.**  
After an important accepted merge, create a product-specific tag such as
`di-v0.1.1` when the user names it. Tags are permanent save points.
`main` continues moving forward.

**8. Development history and release history are different.**  
Development history (`docs/DEPLOYMENT-HISTORY.md`): every deployed test
revision. Release history (`docs/RELEASES.md`): only accepted/tagged
milestones. Do not clutter official release tags with every experiment.

**9. Forge environments have distinct purposes.**

- `development` = active branch testing
- `staging` = release candidate testing
- `production` = accepted production build
- Marketplace publishing is separate from Forge production

Active work remains in `development` until the user says otherwise.

**10. Never guess a rollback point.**  
Rollback must reference an exact recorded Git SHA or tag and the
corresponding Forge deployment.

**11. Do not overwrite working environments blindly.**  
Before deploying, know what Git SHA and Forge version are currently
deployed so we can restore it. Read `docs/DEPLOYMENT-HISTORY.md` first.

**12. Every agent must report after deployment:**

- product
- branch
- Git SHA
- Forge version
- environment
- test/lint status
- whether the working tree was clean
- whether files changed during build

Then commit the updated `docs/deployments.jsonl` and
`docs/DEPLOYMENT-HISTORY.md`.

**13. Mobile and desktop chats must share the same source of truth.**  
Neither chat should rely solely on conversation memory. Before making
changes, read this file, the product doc, release/deployment history,
and current Git branch/HEAD. If another agent has pushed work,
fetch/inspect before proceeding.

**14. One chat must not silently invalidate another chat's work.**  
Before starting: fetch latest remote state, check active branches,
identify the current deployed SHA/version. Before merging or deploying:
make sure another agent has not advanced the same product unexpectedly.

**15. Product boundaries remain enforced.**  
Delivery Intelligence changes stay within its app unless shared
infrastructure genuinely requires otherwise. Do not modify Admin Health
as a side effect of Delivery Intelligence work.

**16. Recovery branches are exceptional.**  
`recovery/delivery-intelligence-2.8.0` exists because we rescued an
uncommitted Forge deployment. Normal development uses `feature/…`,
`fix/…`, or `chore/…`.

**17. No source reconstruction during rollback.**  
If something breaks, restore a known recorded revision. Do not recreate
“what we think it looked like.”

**18. Successful manual acceptance closes the loop.**  
When the user says a deployment is correct: record that acceptance,
merge if appropriate, tag if it is an important milestone the user
names, and update release/deployment records.

When you finish meaningful work, append a dated entry to both
`.cursor/session-history.md` and the chat-history section of
`docs/CHAT-CONTEXT.md`.
