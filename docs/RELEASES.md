# Official releases registry

Only **tagged** releases belong here. Update this file when you tag or roll back.

Every Forge deploy (including untagged branch tests): **`docs/DEPLOYMENT-HISTORY.md`**.

See process: `docs/RELEASE-PROCESS.md`

---

## Currently deployed (demo site)

| App | Tag | Commit | Forge env | Forge version | Notes |
|---|---|---|---|---|---|
| Delivery Intelligence | `di-v1.0.0` | `c780ff5` | development | **2.15.0** | V1 — Sprint Health + Rovo Intelligence. Live verify was `deploy/di/development/2.15.0`. |
| Legacy root app | `legacy-v0.4.0` | `a0c7df4` | development | **4.8.0** | Admin Health v0.4 + existing modules |

Site: `https://one-atlas-qzzp.atlassian.net`

---

## Delivery Intelligence (`di-v*`)

| Tag | Date | Commit | What it is |
|---|---|---|---|
| `di-v1.0.0` | 2026-08-29 | `c780ff5462fb9c74fa8cbba37f5a104d5401a524` | **V1 — Sprint Health + Rovo Intelligence.** Deterministic sprint health, original-commitment reconstruction, scope growth, carryover, blocked/stale, health score, Rovo explain/recommend/brief, verified PLAT acceptance behavior, recovered Git baseline, and CMS-style Forge deploy/rollback. Compare future major work against this tag. |
| `di-v0.1.1` | 2026-08-29 | `4f44eb315d5cbd9320c42ce150a360bb522c0a44` | Historical recovered known-good 2.8.0 source. Tests 20/20, lint clean, Forge development 2.13.0, PLAT accepted (8 original / 1 added PLAT-33255 / 12.5% / 0 carryover / health 82). Contained in `main` via `8b570a9`. **Keep. Do not delete or rewrite.** |
| `di-v0.1.0` | 2026-08-29 | `a29a5aa` | Historical only. Tagged after a manual revert that predates recovery. **Not** the verified 2.8.0 source. |

App ID: `ari:cloud:ecosystem::app/f7a87d39-d904-408d-9415-72b1052a7026`  
Code: `apps/delivery-intelligence/`

---

## Legacy root app (`legacy-v*`)

| Tag | Date | Commit | What it is |
|---|---|---|---|
| `legacy-v0.4.0` | 2026-08-29 | `a0c7df4` | Admin Health boxed Custom UI + Project Health + Executive Preview + Issue panel |

App ID: `ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`  
Code: repo root (`manifest.yml`, `src/`, `static/`)

---

## How to roll back

```bash
# Official V1 product milestone
./scripts/release-rollback.sh di 1.0.0 development

# Recovered known-good source only (historical)
./scripts/release-rollback.sh di 0.1.1 development

./scripts/release-rollback.sh legacy 0.4.0 development
```

Development revisions (not official releases):

```bash
./scripts/rollback-deployment.sh di development 2.15.0
```

Then update the “Currently deployed” table above and append
`docs/DEPLOYMENT-HISTORY.md`.
