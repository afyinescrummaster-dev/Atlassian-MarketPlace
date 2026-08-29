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

## Status (2026-08-29) — 2.8.0 recovery (read first)

If you are the agent that hit “code went bad” and rolled Delivery
Intelligence back on `origin/main`: **that first rollback happened before
the release/rollback structure existed.** `7743ec7` is not the verified
2.8.0 source. Forge 2.8.0 was packaged from an uncommitted working tree;
Git never had it, so a Git revert could not restore it.

`di-v0.1.0` is **not** the accepted PLAT 2.8.0 source. Recovered source is
`recovery/delivery-intelligence-2.8.0` @ `4f44eb3` (verification deploy
Forge development **2.13.0**). Recovered **source** is not merged to
`main` yet.

**Formal process will be updated shortly.** Do not invent another rollback
or retag until that update. Full story: `docs/RECOVERY-2.8.0.md`.

**Official releases:** see `docs/RELEASES.md` (`di-v0.1.0` is provisional
and predates this recovery note; `legacy-v0.4.0` is unchanged).

1. Read the product doc first (`docs/PRODUCT-INDEX.md`).
2. Speculative deploys → `development` only; pin demos to tags.
3. Do not change registered Forge app IDs.
