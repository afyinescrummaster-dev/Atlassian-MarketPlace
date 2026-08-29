# Deployment history (every recorded Forge deploy)

We just completed a recovery incident that exposed a gap in our Git/Forge
workflow: Forge 2.8.0 was deployed from an uncommitted dirty tree, so Git
could not roll back to it later. Recovery is closed. Known-good baseline is
`di-v0.1.1` → `4f44eb3` → Forge development **2.13.0**.

This file is the **readable development revision log**. Every successful
Forge deploy must be recorded here. Official milestones stay in
`docs/RELEASES.md`.

Why this exists: **`docs/DEPLOYMENT-MODEL.md`**  
Machine log (source of truth): **`docs/deployments.jsonl`**

```bash
# Deploy from a clean SHA that is already on origin; auto-record + tag
./scripts/forge-deploy.sh di development

# Restore a previous Forge version without touching the active workspace
./scripts/rollback-deployment.sh di development 2.13.0
```

Deployment revisions are Git tags such as `deploy/di/development/2.13.0`.
They are CMS snapshots, not official release tags.

Do not guess a rollback into unrecorded 2.1.0–2.12.0 deploys.

<!-- BEGIN DEPLOYMENT-LOG -->

## Currently deployed (demo site)

| App | Deployment revision | Git SHA | Forge env | Forge version | When (UTC) | Notes |
|---|---|---|---|---|---|---|
| Delivery Intelligence | `deploy/di/development/2.15.0` | `ad140e5eaa53` | `development` | **2.15.0** | 2026-08-29T21:14:32Z | Deployed from clean ad140e5eaa53 via scripts/forge-deploy.sh |
| Legacy root app | `deploy/legacy/development/4.8.0` | `a0c7df4` | `development` | **4.8.0** | 2026-08-27T00:00:00Z | Admin Health v0.4 boxed Custom UI |

Site: `https://one-atlas-qzzp.atlassian.net`

## Delivery Intelligence

App ID: `ari:cloud:ecosystem::app/f7a87d39-d904-408d-9415-72b1052a7026`  
Code: `apps/delivery-intelligence/`

| When (UTC) | Kind | Branch | Git SHA | Env | Forge version | Revision | Result |
|---|---|---|---|---|---|---|---|
| 2026-08-29T21:14:32Z | deploy | feature/deployment-history-automation | `ad140e5eaa53` | development | 2.15.0 | `deploy/di/development/2.15.0` | Deployed from clean ad140e5eaa53 via scripts/forge-deploy.sh |
| 2026-08-29T18:42:25Z | deploy | feature/deployment-history-automation | `f30e2e9c132d` | development | 2.14.0 | `deploy/di/development/2.14.0` | Deployed from clean f30e2e9c132d via scripts/forge-deploy.sh |
| 2026-08-29T17:37:39Z | historical | recovery/delivery-intelligence-2.8.0 | `4f44eb3` | development | 2.13.0 | `deploy/di/development/2.13.0` | Tests 20/20, lint clean. PLAT accepted: 8 original / 1 added PLAT-33255 / 12.5% / 0 carryover / health 82. Contained in main via 8b570a9. Official known-good: di-v0.1.1. |
| 2026-08-28T02:21:06Z | historical | dirty-working-tree | `uncommitted` | development | 2.8.0 | `` | Accepted PLAT from uncommitted tree. Recovered later as 4f44eb3. Do not repeat. |

## Legacy root app

App ID: `ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`  
Code: repo root

| When (UTC) | Kind | Branch | Git SHA | Env | Forge version | Revision | Result |
|---|---|---|---|---|---|---|---|
| 2026-08-27T00:00:00Z | historical | main | `a0c7df4` | development | 4.8.0 | `deploy/legacy/development/4.8.0` | Admin Health v0.4 boxed Custom UI |

<!-- END DEPLOYMENT-LOG -->
