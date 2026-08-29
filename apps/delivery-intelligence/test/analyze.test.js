import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHealthSnapshot } from "../src/delivery-intelligence/analyze.js";
import { calculateHealthScore } from "../src/delivery-intelligence/score.js";
import { computeScopeChange, computeCarryover } from "../src/delivery-intelligence/metrics.js";

const sprint = {
  id: 42,
  name: "Sprint 12",
  startDate: "2026-08-01T09:00:00.000Z",
  endDate: "2026-08-14T17:00:00.000Z",
};

const issues = [
  {
    key: "PAY-1",
    summary: "Done item",
    statusCategoryKey: "done",
    statusName: "Done",
    created: "2026-07-20T09:00:00.000Z",
    updated: "2026-08-10T09:00:00.000Z",
    labels: [],
    blockedLinksCount: 0,
  },
  {
    key: "PAY-2",
    summary: "Blocked item",
    statusCategoryKey: "indeterminate",
    statusName: "Blocked",
    created: "2026-07-25T09:00:00.000Z",
    updated: "2026-08-05T09:00:00.000Z",
    labels: [],
    blockedLinksCount: 2,
  },
  {
    key: "PAY-3",
    summary: "Added after start",
    statusCategoryKey: "new",
    statusName: "To Do",
    created: "2026-08-05T09:00:00.000Z",
    updated: "2026-08-06T09:00:00.000Z",
    labels: [],
    blockedLinksCount: 0,
  },
];

test("calculateHealthScore deducts for blocked and scope metrics", () => {
  const result = calculateHealthScore({
    completionPercent: 33,
    scopeChangePercent: 33,
    carryoverCount: 1,
    blockedCount: 1,
    staleCount: 0,
  });
  assert.ok(result.score < 100);
  assert.equal(result.max, 100);
  assert.ok(result.deductions.length >= 3);
});

test("computeScopeChange is unavailable without sprint changelog", () => {
  const scope = computeScopeChange({
    issues,
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    changelogsByKey: {},
  });
  assert.equal(scope.addedIssueCount, null);
  assert.equal(scope.scopeChangePercent, null);
  assert.equal(scope.capability.status, "unavailable");
});

test("computeCarryover unavailable without changelog", () => {
  const carryover = computeCarryover({
    issues,
    sprintStart: sprint.startDate,
    sprintName: sprint.name,
    changelogsByKey: {},
  });
  assert.equal(carryover.carryoverCount, null);
  assert.equal(carryover.capability.status, "unavailable");
});

test("buildHealthSnapshot returns structured fields from real-shaped issue data", () => {
  const snapshot = buildHealthSnapshot({
    context: { projectKey: "PAY", boardId: 7, boardName: "PAY board" },
    sprint,
    issues,
    changelogsByKey: {
      "PAY-2": [
        {
          at: "2026-07-28T09:00:00.000Z",
          from: "Sprint 11",
          to: "Sprint 12",
        },
      ],
    },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });

  assert.equal(typeof snapshot.healthScore, "number");
  assert.ok(snapshot.healthScore >= 0 && snapshot.healthScore <= 100);
  assert.equal(snapshot.completionPercent, 33);
  assert.equal(snapshot.blockedCount, 1);
  assert.ok(Array.isArray(snapshot.topAnomalies));
  assert.ok(snapshot.topAnomalies.length > 0);
  assert.equal(snapshot.context.projectKey, "PAY");
});

test("buildHealthSnapshot uses activatedDate so backdated startDate is not added scope", () => {
  const snapshot = buildHealthSnapshot({
    context: { projectKey: "PLAT", boardId: 1, boardName: "PLAT board" },
    sprint: {
      id: 42,
      name: "Sprint 12",
      startDate: "2025-04-18T12:00:00.000Z",
      activatedDate: "2026-08-01T09:00:00.000Z",
      endDate: "2026-08-14T17:00:00.000Z",
    },
    issues: [
      {
        key: "PLAT-1",
        summary: "Planned",
        statusCategoryKey: "new",
        statusName: "To Do",
        created: "2026-07-01T09:00:00.000Z",
        updated: "2026-08-02T09:00:00.000Z",
        labels: [],
        blockedLinksCount: 0,
      },
    ],
    changelogsByKey: {
      "PLAT-1": [
        {
          at: "2026-08-01T09:00:20.000Z",
          from: null,
          to: "Sprint 12",
          toId: "42",
        },
      ],
    },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });

  assert.equal(snapshot.originalCommittedCount, 1);
  assert.equal(snapshot.addedIssueCount, 0);
  assert.equal(snapshot.scopeChangePercent, 0);
});
