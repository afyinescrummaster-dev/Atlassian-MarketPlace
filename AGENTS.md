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

Secrets verified on agent `bc-01a02d23…`. Development deploy **4.1.0** succeeded.

Before further deploys:

1. Run the safe secrets check in `docs/CHAT-CONTEXT.md` (do not print the token).
2. If secrets are set, ensure Forge CLI is on `PATH` (`$HOME/.local/bin`), then:
   `npm run lint:code && npm test && npm run build && forge deploy -e development --non-interactive`
3. First non-interactive session may need:
   `forge settings set usage-analytics false`
4. Upgrade the install only if Forge says scopes changed.
5. Do not change the registered Forge app ID.
