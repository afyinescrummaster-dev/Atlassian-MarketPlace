# Agent notes

Before starting work, read these in order:

1. **`docs/PRODUCT-INDEX.md`** — which product doc and code roots to use
2. **`docs/CHAT-CONTEXT.md`** — global Forge constraints, secrets, legacy app
3. **`docs/MULTI-APP-REPO-STRATEGY.md`** — monorepo layout
4. **`.cursor/session-history.md`** — recent session log

New Cloud Agent runs do **not** inherit prior Cursor chat UI transcripts.
Those two files are the durable memory.

When you finish meaningful work, append a dated entry to both
`.cursor/session-history.md` and the chat-history section of
`docs/CHAT-CONTEXT.md`.

## Status (2026-08-27)

**Delivery Intelligence v0.1** is a **separate Forge app**
(`apps/delivery-intelligence/`), registered as
`ari:cloud:ecosystem::app/f7a87d39-d904-408d-9415-72b1052a7026`.
Latest local laptop deploy: development **2.8.0**, installed on
`one-atlas-qzzp.atlassian.net`.

**Legacy app:** Jira Admin Health v0.4 — development **4.8.0** on root manifest
(`ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff`). Do not
change that ID.

1. For Delivery Intelligence: read `docs/products/delivery-intelligence.md` first.
2. DI is already registered. Deploy from `apps/delivery-intelligence/` only.
   Re-running `scripts/register-delivery-intelligence.sh` skips register when
   `app.id` is present; it still builds, deploys, and upgrades the install.
3. Legacy deploy unchanged: `npm run lint:code && npm test && npm run build && forge deploy -e development --non-interactive`
4. Do not change the registered legacy Forge app ID.
