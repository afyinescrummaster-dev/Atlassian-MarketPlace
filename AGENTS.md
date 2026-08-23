# Agent notes

Before starting work, read these in order:

1. **`docs/CHAT-CONTEXT.md`** — full product, Forge, secrets, and chat handoff
2. **`.cursor/session-history.md`** — short dated session log for this Cloud Agent thread

New Cloud Agent runs do **not** inherit prior Cursor chat UI transcripts.
Those two files are the durable memory.

When you finish meaningful work, append a dated entry to both
`.cursor/session-history.md` and the chat-history section of
`docs/CHAT-CONTEXT.md`.

## Status (2026-08-23)

Admin Health Lab **v0.2** (Findings & Recommendations) is in progress on
`cursor/admin-health-lab-v02-0bfb`. Secrets verified earlier; deploy with:

1. Safe secrets check in `docs/CHAT-CONTEXT.md` (do not print the token).
2. `npm run lint:code && npm test && npm run build && forge deploy -e development --non-interactive`
3. Open Configure deep link or Connected Apps → Configure.
4. Do not change the registered Forge app ID.
