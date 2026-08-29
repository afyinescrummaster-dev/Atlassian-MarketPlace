# Deployment history (every recorded Forge deploy)

This is the **development revision log**. Record every Forge deploy here,
including branch experiments that never reach `main`.

Official tagged milestones only: **`docs/RELEASES.md`**.

How to deploy and roll back: **`docs/RELEASE-PROCESS.md`**.

Last updated: 2026-08-29

---

## Currently deployed (demo site)

| App | Branch | Git SHA | Forge env | Forge version | When (UTC) | Notes |
|---|---|---|---|---|---|---|
| Delivery Intelligence | `di-v0.1.1` @ `4f44eb3` (on `main` via `8b570a9`) | `4f44eb315d5cbd9320c42ce150a360bb522c0a44` | `development` | **2.13.0** | 2026-08-29 17:37 | Known-good. UI Build `2.8.0`. PLAT accepted. |
| Legacy root app | `main` | `a0c7df4` | `development` | **4.8.0** | 2026-08-27 | Admin Health v0.4 boxed UI |

Site: `https://one-atlas-qzzp.atlassian.net`

---

## Delivery Intelligence

App ID: `ari:cloud:ecosystem::app/f7a87d39-d904-408d-9415-72b1052a7026`  
Code: `apps/delivery-intelligence/`

| When (UTC) | Branch | Git SHA | Env | Forge version | Tree | Result |
|---|---|---|---|---|---|---|
| 2026-08-29 17:37 | `recovery/delivery-intelligence-2.8.0` | `4f44eb315d5cbd9320c42ce150a360bb522c0a44` | development | 2.13.0 | clean | Tests 20/20, lint clean. Tagged `di-v0.1.1`. On `main` via `8b570a9`. PLAT: 8 original / 1 added PLAT-33255 / 12.5% / 0 carryover / health 82. |
| 2026-08-28 02:21 | dirty working tree (ancestor `57c833c`) | **not in Git at deploy time** | development | 2.8.0 | dirty | Accepted PLAT. Later recovered as `4f44eb3`. Lesson: never deploy dirty. |
| (earlier) | various | unrecorded | development | 2.1.0–2.12.0 | mixed | Incomplete. Do not guess a rollback into this range. |

---

## Legacy root app

App ID: `ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`  
Code: repo root

| When (UTC) | Branch | Git SHA | Env | Forge version | Tree | Result |
|---|---|---|---|---|---|---|
| 2026-08-27 | `main` | `a0c7df4` / `b889874` era | development | 4.8.0 | clean | Admin Health v0.4 boxed Custom UI |

---

## How to append a row

After every `forge deploy`, add a row **before** the session is considered
complete. Required columns: product, branch, full Git SHA, environment,
Forge version, timestamp, whether the tree was clean, test/lint result.

Do not deploy unless the working tree is clean and HEAD matches the SHA
you will record.
