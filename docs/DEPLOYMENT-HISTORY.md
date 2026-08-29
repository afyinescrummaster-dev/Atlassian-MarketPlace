# Deployment history (every recorded Forge deploy)

This is the **development revision log**. Every Forge deploy must be
recorded here before the work session is considered complete.

Machine log (source of truth): **`docs/deployments.jsonl`**

```bash
# Preferred: deploy from a clean SHA and auto-record
./scripts/forge-deploy.sh di development

# Record a deploy that already happened
./scripts/record-deploy.sh --product di --forge-version 2.13.0 --env development \
  --tag di-v0.1.1 --result "PLAT accepted"
```

Official tagged milestones only: **`docs/RELEASES.md`**.  
How to tag / roll back: **`docs/RELEASE-PROCESS.md`**.

Do not guess a rollback into unrecorded 2.1.0–2.12.0 deploys.

<!-- BEGIN DEPLOYMENT-LOG -->

## Currently deployed (demo site)

| App | Branch / tag | Git SHA | Forge env | Forge version | When (UTC) | Notes |
|---|---|---|---|---|---|---|
| Delivery Intelligence | di-v0.1.1 | `4f44eb3` | `development` | **2.13.0** | 2026-08-29T17:37:39Z | Tests 20/20, lint clean. PLAT accepted: 8 original / 1 added PLAT-33255 / 12.5% / 0 carryover / health 82. Contained in main via 8b570a9. |
| Legacy root app | legacy-v0.4.0 | `a0c7df4` | `development` | **4.8.0** | 2026-08-27T00:00:00Z | Admin Health v0.4 boxed Custom UI |

Site: `https://one-atlas-qzzp.atlassian.net`

## Delivery Intelligence

App ID: `ari:cloud:ecosystem::app/f7a87d39-d904-408d-9415-72b1052a7026`  
Code: `apps/delivery-intelligence/`

| When (UTC) | Branch | Git SHA | Env | Forge version | Tree | Result |
|---|---|---|---|---|---|---|
| 2026-08-29T17:37:39Z | recovery/delivery-intelligence-2.8.0 | `4f44eb3` | development | 2.13.0 | clean | Tests 20/20, lint clean. PLAT accepted: 8 original / 1 added PLAT-33255 / 12.5% / 0 carryover / health 82. Contained in main via 8b570a9. |
| 2026-08-28T02:21:06Z | dirty-working-tree | `uncommitted` | development | 2.8.0 | dirty | Accepted PLAT from uncommitted tree. Recovered later as 4f44eb3. Do not repeat. |

## Legacy root app

App ID: `ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`  
Code: repo root

| When (UTC) | Branch | Git SHA | Env | Forge version | Tree | Result |
|---|---|---|---|---|---|---|
| 2026-08-27T00:00:00Z | main | `a0c7df4` | development | 4.8.0 | clean | Admin Health v0.4 boxed Custom UI |

<!-- END DEPLOYMENT-LOG -->
