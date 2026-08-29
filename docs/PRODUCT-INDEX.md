# Product index

Read **`AGENTS.md`** first (working rules). Then **`docs/CHAT-CONTEXT.md`**
for global Forge constraints. Then open **one product doc**. Check
**`docs/DEPLOYMENT-HISTORY.md`** before any deploy.

| Working on… | Read first | Code roots | Forge app |
|---|---|---|---|
| **Delivery Intelligence** (new) | `docs/products/delivery-intelligence.md` | `apps/delivery-intelligence/` | Separate app — V1 `di-v1.0.0` @ `c780ff5`. Historical recovered known-good: `di-v0.1.1` @ `4f44eb3`. |
| Jira Admin Health | `docs/products/admin-health.md` | `src/admin-health/`, `static/admin-health/` | Legacy app (`manifest.yml` at repo root) |
| Executive Preview | `docs/products/executive-preview.md` | `src/report/`, `static/executive-preview/` | Legacy app |
| Project Health | `docs/products/project-health.md` | `src/frontend/project-report.jsx` | Legacy app |
| Issue Data Test | `docs/products/issue-panel.md` | `src/frontend/index.jsx` | Legacy app |

## Monorepo layout

```
apps/delivery-intelligence/     # New Marketplace product (separate Forge app)
packages/shared-jira/           # Shared read-only Jira helpers
src/                            # Legacy Forge app backend + domain packages
static/                         # Legacy Custom UI bundles
manifest.yml                    # Legacy Forge app only — do not merge DI into this file
docs/products/                  # One product doc per surface
```

## Deploy commands

Official releases use tags — see **`docs/RELEASE-PROCESS.md`** and **`docs/RELEASES.md`**.

```bash
./scripts/release-deploy.sh di 0.1.0 development
./scripts/release-rollback.sh di 0.1.0 development
./scripts/release-deploy.sh legacy 0.4.0 development
```

**Legacy app (ad-hoc / non-tagged):**

```bash
npm run lint:code && npm test && npm run build
forge deploy -e development --non-interactive
```

**Delivery Intelligence (ad-hoc / non-tagged):**

```bash
cd apps/delivery-intelligence
npm install
npm test
npm run build
forge deploy -e development --non-interactive
```
