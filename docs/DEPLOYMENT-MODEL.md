# Why we automate Forge deployment history

We just completed a recovery incident that exposed a gap in our Git/Forge
workflow.

Delivery Intelligence Forge **2.8.0** was once deployed successfully from an
uncommitted dirty working tree. That build was the verified working version
with:

- 8 original sprint issues
- 1 added issue: PLAT-33255
- 12.5% scope growth
- 0 carryover
- health 82 / On Track

Because the source had never been committed, Git could not truly roll back to
it later. We recovered that exact source from the old workspace, committed it,
redeployed it cleanly as Forge development **2.13.0**, verified the PLAT
fingerprint again, merged the recovered source into `main`, and created the
known-good tag `di-v0.1.1`.

Current verified baseline:

- release tag: `di-v0.1.1`
- source SHA: `4f44eb315d5cbd9320c42ce150a360bb522c0a44`
- merged to main via: `8b570a9`
- registry update on main: `153d452`
- Forge development: 2.13.0
- PLAT accepted: 8 original / 1 added PLAT-33255 / 12.5% / 0 carryover / health 82

That recovery is now closed. Product milestone **V1 — Sprint Health +
Rovo Intelligence** is `di-v1.0.0` @ `c780ff5`. `di-v0.1.1` remains
the historical recovered known-good tag.

The lesson: Git itself was not the problem. The problem was that a visible
Forge deployment could exist without an immutable Git revision behind it.

## CMS-style model

Every deployment should automatically become a recoverable revision, even
before it is merged to `main`.

- `main` remains the accepted code line
- Official release tags (`di-v0.1.1`, `legacy-v0.4.0`) remain manually accepted
  known-good milestones
- Development deployment history is granular and automatic
- GitHub is the coordination layer between mobile and desktop chats

## Commands

```bash
./scripts/forge-deploy.sh di development
./scripts/rollback-deployment.sh di development 2.13.0
```

Deployment revisions (not official releases):

```
deploy/di/development/2.14.0
deploy/legacy/development/4.9.0
```

Structured history: `docs/deployments.jsonl`  
Readable view: `docs/DEPLOYMENT-HISTORY.md`
