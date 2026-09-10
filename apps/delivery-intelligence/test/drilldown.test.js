import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeBlocked,
  computeCarryover,
  computeScopeChange,
  computeStale,
} from "../src/delivery-intelligence/metrics.js";
import { buildTopAnomalies } from "../src/delivery-intelligence/analyze.js";
import {
  cardsFromIssuesOrKeys,
  jiraPathForKeys,
  jqlForIssueKeys,
  jqlForSprint,
} from "../src/delivery-intelligence/jira-links.js";

const sprint = {
  id: 42,
  name: "Sprint 12",
  startDate: "2026-08-01T09:00:00.000Z",
};

const issue = (key, extra = {}) => ({
  key,
  summary: `${key} summary`,
  statusCategoryKey: "new",
  statusName: "To Do",
  created: "2026-07-01T09:00:00.000Z",
  updated: "2026-08-02T09:00:00.000Z",
  labels: [],
  blockedLinksCount: 0,
  ...extra,
});

test("scope movement exposes original, added, current, and growth formula", () => {
  const committed = Array.from({ length: 8 }, (_, index) => issue(`PLAT-${index + 1}`));
  const added = [
    issue("PLAT-33255", { summary: "Notifications upgrade for platform links" }),
    issue("PLAT-9"),
    issue("PLAT-10"),
    issue("PLAT-11"),
    issue("PLAT-12"),
  ];
  const changelogsByKey = {
    ...Object.fromEntries(
      committed.map((row) => [
        row.key,
        [
          {
            at: "2026-07-28T09:00:00.000Z",
            from: null,
            to: sprint.name,
            toId: String(sprint.id),
          },
        ],
      ]),
    ),
    ...Object.fromEntries(
      added.map((row) => [
        row.key,
        [
          {
            at: "2026-08-29T10:00:00.000Z",
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

  assert.equal(scope.originalCommittedCount, 8);
  assert.equal(scope.addedIssueCount, 5);
  assert.equal(scope.currentIssueCount, 13);
  assert.equal(scope.scopeChangePercent, 62.5);
  assert.deepEqual(scope.addedIssueKeys, added.map((row) => row.key));
  assert.equal(scope.addedIssues[0].reason, "Added after sprint start");
  assert.equal(scope.addedIssues[0].joinedAt, "2026-08-29T10:00:00.000Z");
  assert.equal(scope.removedIssueCount, null);
  assert.equal(scope.removals.status, "unavailable");
});

test("start-sprint writes are not listed as added issues", () => {
  const row = issue("PLAT-22");
  const scope = computeScopeChange({
    issues: [row],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey: {
      "PLAT-22": [
        {
          at: "2026-08-01T09:00:20.000Z",
          from: null,
          to: sprint.name,
          toId: String(sprint.id),
        },
      ],
    },
  });

  assert.equal(scope.originalCommittedCount, 1);
  assert.equal(scope.addedIssueCount, 0);
  assert.deepEqual(scope.addedIssueKeys, []);
  assert.deepEqual(scope.originalCommittedIssueKeys, ["PLAT-22"]);
});

test("drill-down classification covers blocked, carryover, stale, and added", () => {
  const blocked = issue("PLAT-39", {
    summary: "Fix login redirect loop",
    statusName: "Blocked",
    statusCategoryKey: "indeterminate",
    updated: "2026-08-11T12:00:00.000Z",
  });
  const stale = issue("PLAT-40", {
    updated: "2026-08-01T12:00:00.000Z",
  });
  const carryover = issue("PLAT-20");
  const added = issue("PLAT-33255");
  const now = new Date("2026-08-12T12:00:00.000Z");

  const blockedResult = computeBlocked([blocked], now);
  assert.equal(blockedResult.blockedCount, 1);
  assert.equal(blockedResult.blockedIssues[0].key, "PLAT-39");
  assert.equal(blockedResult.blockedIssues[0].reason, "Blocked");
  assert.equal(blockedResult.blockedIssues[0].ageDays, 1);

  const staleResult = computeStale([stale], now);
  assert.equal(staleResult.staleCount, 1);
  assert.equal(staleResult.staleIssues[0].key, "PLAT-40");
  assert.equal(staleResult.staleIssues[0].reason, "Stale");

  const carryoverResult = computeCarryover({
    issues: [carryover],
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
  assert.deepEqual(carryoverResult.carryoverIssueKeys, ["PLAT-20"]);
  assert.equal(carryoverResult.carryoverIssues[0].reason, "Carried from the previous completed sprint");

  const scope = computeScopeChange({
    issues: [added],
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey: {
      "PLAT-33255": [
        {
          at: "2026-08-29T10:00:00.000Z",
          from: null,
          to: sprint.name,
          toId: String(sprint.id),
        },
      ],
    },
  });
  assert.deepEqual(scope.addedIssueKeys, ["PLAT-33255"]);
});

test("attention items stay deterministic and preserve severity order", () => {
  const items = buildTopAnomalies({
    scopeChangePercent: 62.5,
    addedIssueCount: 5,
    carryoverCount: 0,
    carryoverIssueKeys: [],
    blockedIssues: [
      {
        key: "PLAT-39",
        ageDays: 1,
        blockedLinksCount: 0,
      },
    ],
    staleIssues: [],
    completionPercent: 0,
    doneCount: 0,
    totalIssueCount: 13,
  });

  assert.equal(items[0].severity, "High");
  assert.equal(items[0].title, "Blocked work");
  assert.match(items[0].explanation, /PLAT-39/);
  assert.equal(items[0].suggestedAction, "View blocked issue");
  assert.equal(items[0].drillDown, "blocked");

  const scope = items.find((item) => item.id === "scope-increase");
  assert.equal(scope.title, "Scope increased 62.5%");
  assert.equal(scope.suggestedAction, "View added issues");
  assert.equal(scope.affectedIssueCount, 5);

  const completion = items.find((item) => item.id === "low-completion");
  assert.equal(completion.title, "Low completion");
  assert.equal(completion.explanation, "0 of 13 issues are Done.");
  assert.equal(completion.suggestedAction, "View sprint issues");
});

test("one issue opens browse and several issues open a JQL list", () => {
  assert.equal(jiraPathForKeys(["PLAT-39"]), "/browse/PLAT-39");
  assert.equal(jqlForIssueKeys(["PLAT-1", "PLAT-33255"]), "key in (PLAT-1, PLAT-33255) ORDER BY key");
  assert.equal(
    jiraPathForKeys(["PLAT-1", "PLAT-33255"]),
    `/issues/?jql=${encodeURIComponent("key in (PLAT-1, PLAT-33255) ORDER BY key")}`,
  );
  assert.equal(
    jqlForSprint("PLAT", 42),
    "project = PLAT AND sprint = 42 ORDER BY key",
  );
  const fromKeys = cardsFromIssuesOrKeys([], ["PLAT-33255"], "Added after sprint start");
  assert.equal(fromKeys[0].key, "PLAT-33255");
  assert.equal(fromKeys[0].reason, "Added after sprint start");
});
