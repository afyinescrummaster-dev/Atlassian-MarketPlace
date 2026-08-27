# Jira Admin Health

Customer-facing name: **Jira Admin Health**  
Forge module key: `admin-health-lab-page`  
Forge app: **legacy root app** (`manifest.yml` at repository root)

## Purpose

Read-only site hygiene dashboard for Jira administrators: inactive projects,
duplicate custom fields, ownership gaps, deterministic Site Health score.

## Code locations

| Layer | Path |
|---|---|
| Domain engine | `src/admin-health/` |
| Resolvers | `src/resolvers/admin-health.js` |
| Custom UI | `static/admin-health/` |
| Legacy UI Kit (unused) | `src/frontend/admin-health.jsx` |

## Docs

- Technical detail: `docs/ADMIN-HEALTH-LAB.md`
- Mockups: `docs/screenshots/admin-health-v03/`

## Do not break

- Registered app ID on root `manifest.yml`
- Read-only behaviour (no destructive Jira actions)
- Configure deep link (`useAsConfig: true`)

## Latest version

v0.4 boxed Custom UI — development deploy **4.8.0** (see `docs/CHAT-CONTEXT.md`).
