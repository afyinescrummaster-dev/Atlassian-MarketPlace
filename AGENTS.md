# Agent notes

Before starting work, read these in order:

1. **`docs/PRODUCT-INDEX.md`** — which product doc and code roots to use
2. **`docs/RELEASE-PROCESS.md`** — official tags, deploy, rollback (repo + Forge)
3. **`docs/CHAT-CONTEXT.md`** — global Forge constraints, secrets, legacy app
4. **`docs/MULTI-APP-REPO-STRATEGY.md`** — monorepo layout
5. **`.cursor/session-history.md`** — recent session log

New Cloud Agent runs do **not** inherit prior Cursor chat UI transcripts.
Product docs + session history are the durable memory.

When you finish meaningful work, append a dated entry to both
`.cursor/session-history.md` and the chat-history section of
`docs/CHAT-CONTEXT.md`.

**Do not invent release tags.** Only tag when the user asks to make a release
official. Prefer rollback via `./scripts/release-rollback.sh` over manual reverts.

## Status (2026-08-29)

**Official releases:** see `docs/RELEASES.md` (`di-v0.1.0`, `legacy-v0.4.0`).

1. Read the product doc first (`docs/PRODUCT-INDEX.md`).
2. Speculative deploys → `development` only; pin demos to tags.
3. Do not change registered Forge app IDs.
