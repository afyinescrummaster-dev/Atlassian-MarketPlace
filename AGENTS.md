# Agent notes

Before starting work, read **`.cursor/session-history.md`**.

That file is the project’s durable chat/session memory for Cloud Agents.
New agent runs do **not** inherit prior Cursor chat transcripts; this file does.

When you finish a meaningful chunk of work, append a dated entry to
`.cursor/session-history.md` (what changed, decisions, blockers, next steps).

Prefer continuing an existing agent conversation when the user wants full
UI chat history; use this file when spinning up a new run on the same repo.
