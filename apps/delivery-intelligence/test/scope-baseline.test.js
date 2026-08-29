import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCarryover, computeScopeChange } from "../src/delivery-intelligence/metrics.js";
import {
  classifyIssueSprintHistory,
  commitmentTimestamp,
  roundScopePercent,
} from "../src/delivery-intelligence/membership.js";

const sprint = {
  id: 42,
  name: "Sprint 12",
  startDate: "2026-08-01T09:00:00.000Z",
};

const issue = (key, extra = {}) => ({
  key,
  summary: key,
  statusCategoryKey: "new",
  statusName: "To Do",
  created: "2026-07-01T09:00:00.000Z",
  updated: "2026-08-02T09:00:00.000Z",
  labels: [],
  blockedLinksCount: 0,
  ...extra,
});

const assignBeforeStart = (to = sprint.name, toId = String(sprint.id)) => [
  {
    at: "2026-07-28T09:00:00.000Z",
    from: null,
    to,
    fromId: null,
    toId,
  },
];

test("roundScopePercent uses original commitment as the denominator", () => {
  assert.equal(roundScopePercent(1, 8), 12.5);
  assert.equal(roundScopePercent(5, 10), 50);
  assert.equal(roundScopePercent(0, 8), 0);
});

test("scenario 1: clean initial commitment is not added scope", () => {
  const issues = Array.from({ length: 8 }, (_, index) => issue(`PLAT-${index + 1}`));
  const changelogsByKey = Object.fromEntries(
    issues.map((row) => [row.key, assignBeforeStart()]),
  );

  const scope = computeScopeChange({
    issues,
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey,
  });

  assert.equal(scope.originalCommittedCount, 8);
  assert.equal(scope.addedIssueCount, 0);
  assert.equal(scope.scopeChangePercent, 0);
  assert.equal(scope.capability.status, "available");
});

test("scenario 2: one genuine post-start addition is 12.5% of original 8", () => {
  const committed = Array.from({ length: 8 }, (_, index) => issue(`PLAT-${index + 1}`));
  const added = issue("PLAT-9");
  const issues = [...committed, added];
  const changelogsByKey = {
    ...Object.fromEntries(committed.map((row) => [row.key, assignBeforeStart()])),
    "PLAT-9": [
      {
        at: "2026-08-03T10:00:00.000Z",
        from: null,
        to: sprint.name,
        fromId: null,
        toId: String(sprint.id),
      },
    ],
  };

  const scope = computeScopeChange({
    issues,
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey,
  });

  assert.equal(scope.originalCommittedCount, 8);
  assert.equal(scope.currentIssueCount, 9);
  assert.equal(scope.addedIssueCount, 1);
  assert.equal(scope.scopeChangePercent, 12.5);
});

test("scenario 3: five additions against original 10 is 50%", () => {
  const committed = Array.from({ length: 10 }, (_, index) => issue(`PLAT-${index + 1}`));
  const added = Array.from({ length: 5 }, (_, index) => issue(`PLAT-${index + 11}`));
  const changelogsByKey = {
    ...Object.fromEntries(committed.map((row) => [row.key, assignBeforeStart()])),
    ...Object.fromEntries(
      added.map((row) => [
        row.key,
        [
          {
            at: "2026-08-04T10:00:00.000Z",
            from: null,
            to: sprint.name,
            toId: String(sprint.id),
          },
        ],
      ]),
    ),
  };

  const scope = computeScopeChange({
    issues: [...committed, ...added],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey,
  });

  assert.equal(scope.originalCommittedCount, 10);
  assert.equal(scope.addedIssueCount, 5);
  assert.equal(scope.scopeChangePercent, 50);
});

test("scenario 4: incomplete work from a prior sprint is carryover", () => {
  const row = issue("PLAT-20");
  const carryover = computeCarryover({
    issues: [row],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey: {
      "PLAT-20": [
        {
          at: "2026-07-20T09:00:00.000Z",
          from: "Sprint A",
          to: sprint.name,
          fromId: "11",
          toId: String(sprint.id),
        },
      ],
    },
    previousSprint: { id: 11, name: "Sprint A" },
  });

  assert.equal(carryover.carryoverCount, 1);
  assert.deepEqual(carryover.carryoverIssueKeys, ["PLAT-20"]);
});

test("scenario 5: first assignment to the current sprint is not carryover or added", () => {
  const row = issue("PLAT-21");
  const changelogsByKey = { "PLAT-21": assignBeforeStart() };

  const scope = computeScopeChange({
    issues: [row],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey,
  });
  const carryover = computeCarryover({
    issues: [row],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey,
  });

  assert.equal(scope.addedIssueCount, 0);
  assert.equal(scope.originalCommittedCount, 1);
  assert.equal(carryover.carryoverCount, 0);
});

test("scenario 6: missing changelog does not treat every issue as added scope", () => {
  const issues = Array.from({ length: 8 }, (_, index) => issue(`PLAT-${index + 1}`));
  const scope = computeScopeChange({
    issues,
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey: {},
  });
  const carryover = computeCarryover({
    issues,
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey: {},
  });

  assert.equal(scope.addedIssueCount, null);
  assert.equal(scope.scopeChangePercent, null);
  assert.equal(scope.capability.status, "unavailable");
  assert.equal(carryover.carryoverCount, null);
  assert.equal(carryover.capability.status, "unavailable");
});

test("sprint-start timestamp assignment is original commitment, not added scope", () => {
  const row = issue("PLAT-22");
  const scope = computeScopeChange({
    issues: [row],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey: {
      "PLAT-22": [
        {
          at: sprint.startDate,
          from: null,
          to: sprint.name,
          toId: String(sprint.id),
        },
      ],
    },
  });

  assert.equal(scope.originalCommittedCount, 1);
  assert.equal(scope.addedIssueCount, 0);
});

test("join 30 seconds after start with no prior sprint is original commitment", () => {
  const row = issue("PLAT-23");
  const scope = computeScopeChange({
    issues: [row],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey: {
      "PLAT-23": [
        {
          at: "2026-08-01T09:00:30.000Z",
          from: null,
          to: sprint.name,
          toId: String(sprint.id),
        },
      ],
    },
  });

  assert.equal(scope.originalCommittedCount, 1);
  assert.equal(scope.addedIssueCount, 0);
});

test("join hours after start is added scope", () => {
  const row = issue("PLAT-24");
  const scope = computeScopeChange({
    issues: [row],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey: {
      "PLAT-24": [
        {
          at: "2026-08-01T15:00:00.000Z",
          from: null,
          to: sprint.name,
          toId: String(sprint.id),
        },
      ],
    },
  });

  assert.equal(scope.originalCommittedCount, 0);
  assert.equal(scope.addedIssueCount, 1);
});

test("join after planned startDate but before activation is original commitment", () => {
  const liveSprint = {
    ...sprint,
    startDate: "2025-04-18T12:00:00.000Z",
    activatedDate: "2026-08-01T15:00:00.000Z",
  };
  const classification = classifyIssueSprintHistory({
    changes: [
      {
        at: "2026-08-01T15:00:08.000Z",
        from: null,
        to: sprint.name,
        toId: String(sprint.id),
      },
    ],
    sprintStart: commitmentTimestamp(liveSprint),
    sprintName: liveSprint.name,
    sprintId: liveSprint.id,
  });

  assert.equal(classification.committed, true);
  assert.equal(classification.added, false);
});

test("Java sprint toString for the current sprint is not carryover", () => {
  const blob = `com.atlassian.greenhopper.service.sprint.Sprint@abc[id=${sprint.id},rapidViewId=1,state=ACTIVE,name=${sprint.name},startDate=2026-08-01T09:00:00.000Z,completeDate=<null>,sequence=1]`;
  const classification = classifyIssueSprintHistory({
    changes: [
      {
        at: "2026-07-28T09:00:00.000Z",
        from: blob,
        to: blob,
        fromId: String(sprint.id),
        toId: String(sprint.id),
      },
    ],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
  });

  assert.equal(classification.committed, true);
  assert.equal(classification.added, false);
  assert.equal(classification.carryover, false);
});

test("start-sprint write that keeps closed sprint IDs is original commitment", () => {
  const row = issue("PLAT-31");
  const scope = computeScopeChange({
    issues: [row],
    sprintStart: "2026-08-28T00:46:00.673Z",
    sprintName: "Sprint 2025-04-18H12",
    sprintId: 5205,
    changelogsByKey: {
      "PLAT-31": [
        {
          at: "2026-08-27T20:46:17.977-0400",
          from: "2021-08-18T12:57:20+0000, 2021-08-18T17:04:06+0000",
          to: "2021-08-18T12:57:20+0000, 2021-08-18T17:04:06+0000, Sprint 2025-04-18H12",
          fromId: "6, 7",
          toId: "6, 7, 5205",
        },
      ],
    },
  });
  const carryover = computeCarryover({
    issues: [row],
    sprintStart: "2026-08-28T00:46:00.673Z",
    sprintName: "Sprint 2025-04-18H12",
    sprintId: 5205,
    changelogsByKey: {
      "PLAT-31": [
        {
          at: "2026-08-27T20:46:17.977-0400",
          from: "2021-08-18T12:57:20+0000, 2021-08-18T17:04:06+0000",
          to: "2021-08-18T12:57:20+0000, 2021-08-18T17:04:06+0000, Sprint 2025-04-18H12",
          fromId: "6, 7",
          toId: "6, 7, 5205",
        },
      ],
    },
    previousSprint: { id: 4000, name: "Some later closed sprint" },
  });

  assert.equal(scope.originalCommittedCount, 1);
  assert.equal(scope.addedIssueCount, 0);
  assert.equal(scope.capability.source, "changelog");
  assert.equal(carryover.carryoverCount, 0);
});

test("join 12 minutes after start is added scope", () => {
  const row = issue("PLAT-33255");
  const scope = computeScopeChange({
    issues: [row],
    sprintStart: "2026-08-28T00:46:00.673Z",
    sprintName: "Sprint 2025-04-18H12",
    sprintId: 5205,
    changelogsByKey: {
      "PLAT-33255": [
        {
          at: "2025-02-26T22:05:37.215-0500",
          from: "Sprint 2025-02-24H12",
          to: null,
          fromId: "3093",
          toId: null,
        },
        {
          at: "2026-08-27T20:58:09.793-0400",
          from: null,
          to: "Sprint 2025-04-18H12",
          fromId: null,
          toId: "5205",
        },
      ],
    },
  });

  assert.equal(scope.originalCommittedCount, 0);
  assert.equal(scope.addedIssueCount, 1);
});

test("carryover only matches the board's previous closed sprint", () => {
  const row = issue("PLAT-20");
  const changes = {
    "PLAT-20": [
      {
        at: "2026-07-20T09:00:00.000Z",
        from: "Sprint A",
        to: sprint.name,
        fromId: "11",
        toId: String(sprint.id),
      },
    ],
  };

  const matched = computeCarryover({
    issues: [row],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey: changes,
    previousSprint: { id: 11, name: "Sprint A" },
  });
  const unmatched = computeCarryover({
    issues: [row],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey: changes,
    previousSprint: { id: 99, name: "Some other sprint" },
  });

  assert.equal(matched.carryoverCount, 1);
  assert.equal(unmatched.carryoverCount, 0);
});
