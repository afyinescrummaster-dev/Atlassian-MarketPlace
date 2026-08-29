# Delivery Intelligence 2.8.0 recovery — read this first

Handoff for any agent that worked the “code went bad” / first rollback /
release-process chat, or that is about to roll back Delivery Intelligence.

Recovered 2.8.0 source is now on `main`. Working rules are in
`AGENTS.md`. Official replacement tag waits for the user. Do not invent
a tag. Do not treat `di-v0.1.0` as this source.

---

## The first rollback happened before the structure existed

On `origin/main`, the first rollback was:

`7743ec7` — *Revert Delivery Intelligence to last known-good desktop build*
(2026-08-29 16:55 UTC)

The release/rollback structure did **not** exist yet. It was added **after**
that revert:

`3ade8fd` — *Add repo-wide release and rollback process*
(2026-08-29 17:01 UTC)

So that first rollback was a manual Git revert, not a process-driven restore
from a tagged known-good SHA. It could not restore the accepted PLAT engine,
because **Forge development 2.8.0 was never committed to Git**. Forge packaged
a dirty working tree. Later Git history never contained that source.

`di-v0.1.0` on `origin/main` (recorded around `a29a5aa`) is **not** the verified
2.8.0 source. Do not deploy or roll back to that tag expecting the accepted
PLAT fingerprint.

---

## What actually happened

1. PLAT live dashboard went wrong (0 original / 9 added / 100% scope / 9
   carryover). The accepted fix used changelog reconstruction, not Jira’s
   sprint-report `issueKeysAddedDuringSprint`.
2. That source was deployed as Forge development **2.8.0** from this laptop
   working tree (ancestor `57c833c`). It was **not** committed first.
3. Later work on `origin/main` (Configure deep link, sprint-load, then
   `7743ec7` “rollback”) could not recover 2.8.0. Git never had it.
4. This workspace was forensically identified as the exact 2.8.0 tree
   (`UI_BUILD = "2.8.0"`, built bundle contained `2.8.0`, all DI sources
   predated the 2.8.0 deploy, later main commits were never checked out here).
5. That dirty tree was preserved onto
   `recovery/delivery-intelligence-2.8.0` at
   `4f44eb315d5cbd9320c42ce150a360bb522c0a44` and pushed to origin.
   No source reconstruction.
6. Verification from that exact clean commit: tests 20/20, `forge lint`
   clean, deployed Forge development **2.13.0**. UI Build string is still
   `2.8.0`. That source is now merged to `main`. Official tag waits for
   the user.

---

## Recovered source (now on `main`)

| Item | Value |
|---|---|
| Branch | `recovery/delivery-intelligence-2.8.0` |
| Commit | `4f44eb315d5cbd9320c42ce150a360bb522c0a44` |
| Ancestor | `57c833c2706708d771dc6b863d45b0624c90b3cf` |
| Forge verification deploy | development **2.13.0** (2026-08-29) |
| UI Build string | `2.8.0` |

GitHub: https://github.com/afyinescrummaster-dev/Atlassian-MarketPlace/tree/recovery/delivery-intelligence-2.8.0

---

## Expected PLAT acceptance fingerprint

- 8 original committed issues
- 1 added issue: **PLAT-33255**
- 12.5% scope growth
- 0 carryover
- health **82 / On Track**
- normal dashboard
- no classification/debug dump

Do **not** use greenhopper sprint-report `issueKeysAddedDuringSprint` for
metrics (it marked all 9 PLAT issues as added).

---

## What not to do

- Do not treat `7743ec7` or `di-v0.1.0` as known-good 2.8.0
- Do not reconstruct `membership.js` or baseline logic from memory
- Do not deploy from a dirty working tree
- Do not invent a replacement tag; wait for the user
- Follow `AGENTS.md` for all new work. Record deploys in
  `docs/DEPLOYMENT-HISTORY.md`.
