# Product index

Read **`docs/CHAT-CONTEXT.md`** first for global Forge constraints, secrets, and the
legacy multi-module app. Then open **one product doc** for the work you are doing.

| Working on… | Read first | Code roots | Forge app |
|---|---|---|---|
| **Delivery Intelligence** (new) | `docs/products/delivery-intelligence.md` **and** `docs/RECOVERY-2.8.0.md` | `apps/delivery-intelligence/` | Separate app — recovered 2.8.0 is `recovery/delivery-intelligence-2.8.0` @ `4f44eb3`, not `origin/main` |
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

**Legacy app (unchanged):**

```bash
npm run lint:code && npm test && npm run build
forge deploy -e development --non-interactive
```

**Delivery Intelligence (after `forge register`):**

```bash
cd apps/delivery-intelligence
npm install
npm test
npm run build
forge deploy -e development --non-interactive
```
