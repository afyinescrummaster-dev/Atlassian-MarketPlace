# Laptop agent takeover — Delivery Intelligence Forge setup

Copy everything below the line into Cursor on your **laptop** (repo checked out, Forge logged in).

---

## Prompt (paste this)

You are on my laptop with Forge CLI access. Complete first-time setup for **Delivery Intelligence for Jira** — a separate Forge app under `apps/delivery-intelligence/`. Do not modify the legacy root app ID in the root `manifest.yml`.

1. Read `docs/products/delivery-intelligence.md` and `AGENTS.md`.
2. Confirm Forge login: `forge whoami` (do not print tokens).
3. Pull latest `main`.
4. Run the automated setup script:
   ```bash
   chmod +x scripts/register-delivery-intelligence.sh
   ./scripts/register-delivery-intelligence.sh
   ```
5. If `forge install` asks for a site, choose `one-atlas-qzzp.atlassian.net`.
6. Report back: new `app.id` from `apps/delivery-intelligence/manifest.yml`, deploy version, install URL/path to open Delivery Intelligence on a project, and any scope upgrade prompts.
7. Commit only if the script wrote a new `app.id` — commit message: `Register Delivery Intelligence Forge app id`. Push to `main` if I asked to keep main updated.

Do not publish to Marketplace. Do not add write scopes.

---

## What the script does

| Step | Purpose |
|---|---|
| `npm install` / `npm run build` | Build the Custom UI dashboard bundle |
| `forge register` | Creates a **new** Atlassian app ID (one-time) |
| `forge lint` | Validates manifest + Rovo modules |
| `forge deploy -e development` | Uploads to Forge development environment |
| `forge install` | Installs on your Jira Cloud site |

This is **only for Delivery Intelligence**. Admin Health still deploys from the **repo root**:

```bash
npm run build && forge deploy -e development --non-interactive
```

---

## If register fails

List developer spaces and retry:

```bash
forge developer-spaces list
export FORGE_DEVELOPER_SPACE_ID=<your-space-uuid>
./scripts/register-delivery-intelligence.sh
```

---

## Secrets on laptop

Ensure `FORGE_EMAIL` / `FORGE_API_TOKEN` are set, or run `forge login` once interactively.
