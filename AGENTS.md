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

**Delivery Intelligence v0.1** monorepo foundation on
`cursor/delivery-intelligence-monorepo-0bfb`.

**Legacy app:** Jira Admin Health v0.4 — development **4.8.0** on root manifest.

1. For Delivery Intelligence: read `docs/products/delivery-intelligence.md` first.
2. Register the new app interactively before first DI deploy (`forge register`).
3. Legacy deploy unchanged: `npm run lint:code && npm test && npm run build && forge deploy -e development --non-interactive`
4. Do not change the registered legacy Forge app ID.
