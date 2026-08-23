# Agent notes

Before starting work, read these in order:

1. **`docs/CHAT-CONTEXT.md`** — full product, Forge, secrets, and chat handoff
2. **`.cursor/session-history.md`** — short dated session log for this Cloud Agent thread

New Cloud Agent runs do **not** inherit prior Cursor chat UI transcripts.
Those two files are the durable memory.

When you finish meaningful work, append a dated entry to both
`.cursor/session-history.md` and the chat-history section of
`docs/CHAT-CONTEXT.md`.

## Immediate next step (2026-08-23)

1. Run the safe secrets check in `docs/CHAT-CONTEXT.md` (do not print the token).
2. If secrets are set, install Forge CLI if needed, then:
   `npm run lint:code && npm test && npm run build && forge deploy -e development --non-interactive`
3. Upgrade the install only if Forge says scopes changed.
4. Do not change the registered Forge app ID.
