# Official releases registry

Only **tagged** releases belong here. Update this file when you tag or roll back.

See process: `docs/RELEASE-PROCESS.md`

---

## Currently deployed (demo site)

| App | Tag | Commit | Forge env | Forge version | Notes |
|---|---|---|---|---|---|
| Delivery Intelligence | `di-v0.1.0` | `a29a5aa` | development | 2.12.0 | Desktop known-good; rolled back from mobile experiments |
| Legacy root app | `legacy-v0.4.0` | `a0c7df4` | development | 4.8.0 | Admin Health v0.4 + existing modules |

Site: `https://one-atlas-qzzp.atlassian.net`

---

## Delivery Intelligence (`di-v*`)

| Tag | Date | Commit | What it is |
|---|---|---|---|
| `di-v0.1.0` | 2026-08-29 | `a29a5aa` | Read-only sprint dashboard + Rovo agent; last known-good desktop build |

App ID: `ari:cloud:ecosystem::app/f7a87d39-d904-408d-9415-72b1052a7026`  
Code: `apps/delivery-intelligence/`

---

## Legacy root app (`legacy-v*`)

| Tag | Date | Commit | What it is |
|---|---|---|---|
| `legacy-v0.4.0` | 2026-08-29 | *(see tag)* | Admin Health boxed Custom UI + Project Health + Executive Preview + Issue panel |

App ID: `ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`  
Code: repo root (`manifest.yml`, `src/`, `static/`)

---

## How to roll back

```bash
./scripts/release-rollback.sh di 0.1.0 development
# or
./scripts/release-rollback.sh legacy 0.4.0 development
```

Then update the “Currently deployed” table above.
