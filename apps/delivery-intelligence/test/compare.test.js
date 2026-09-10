import { test } from "node:test";
import assert from "node:assert/strict";
import { compareSprintMetrics } from "../src/delivery-intelligence/compare.js";
import { buildHealthSnapshot } from "../src/delivery-intelligence/analyze.js";

test("compares current and previous sprint values with polarity-aware deltas", () => {
  const result = compareSprintMetrics({
    current: {
      healthScore: 65,
      scopeChangePercent: 62.5,
      completionPercent: 0,
      carryoverCount: 0,
      blockedCount: 1,
      staleCount: 0,
    },
    previous: {
      healthScore: 78,
      scopeChangePercent: 20,
      completionPercent: 87,
      carryoverCount: 3,
      blockedCount: 2,
      staleCount: 1,
    },
    previousSprint: { id: 11, name: "Sprint 11" },
  });

  assert.equal(result.capability.status, "available");
  assert.equal(result.previousSprint.name, "Sprint 11");
  assert.equal(result.metricDeltas.healthScore.delta, -13);
  assert.equal(result.metricDeltas.healthScore.direction, "deteriorated");
  assert.equal(result.metricDeltas.scopeChangePercent.delta, 42.5);
  assert.equal(result.metricDeltas.scopeChangePercent.direction, "deteriorated");
  assert.equal(result.metricDeltas.completionPercent.direction, "deteriorated");
  assert.equal(result.metricDeltas.carryoverCount.delta, -3);
  assert.equal(result.metricDeltas.carryoverCount.direction, "improved");
  assert.equal(result.metricDeltas.blockedCount.direction, "improved");
  assert.equal(result.metricDeltas.staleCount.direction, "improved");
});

test("unavailable previous sprint does not invent comparison metrics", () => {
  const result = compareSprintMetrics({ previousSprint: null });
  assert.equal(result.capability.status, "unavailable");
  assert.equal(result.previousSprintMetrics, null);
  assert.equal(result.metricDeltas, null);
  assert.equal(result.rows.length, 0);
});

test("partial historical data keeps available values and marks the rest", () => {
  const result = compareSprintMetrics({
    current: {
      healthScore: 65,
      scopeChangePercent: 62.5,
      completionPercent: 0,
      carryoverCount: 0,
      blockedCount: 1,
      staleCount: 0,
    },
    previous: {
      healthScore: 78,
      scopeChangePercent: null,
      completionPercent: 87,
      carryoverCount: null,
      blockedCount: 2,
      staleCount: 1,
    },
    previousSprint: { id: 11, name: "Sprint 11" },
  });

  assert.equal(result.capability.status, "partial");
  const scope = result.rows.find((row) => row.key === "scopeChangePercent");
  assert.equal(scope.delta, null);
  assert.equal(scope.direction, "unknown");
  const blocked = result.rows.find((row) => row.key === "blockedCount");
  assert.equal(blocked.delta, -1);
  assert.equal(blocked.direction, "improved");
});

test("buildHealthSnapshot compares with previous sprint facts when context is supplied", () => {
  const previousIssues = [
    {
      key: "PLAT-1",
      summary: "Done last sprint",
      statusCategoryKey: "done",
      statusName: "Done",
      created: "2026-07-01T09:00:00.000Z",
      updated: "2026-07-28T09:00:00.000Z",
      labels: [],
      blockedLinksCount: 0,
    },
    {
      key: "PLAT-2",
      summary: "Also done",
      statusCategoryKey: "done",
      statusName: "Done",
      created: "2026-07-01T09:00:00.000Z",
      updated: "2026-07-29T09:00:00.000Z",
      labels: [],
      blockedLinksCount: 0,
    },
  ];
  const currentIssues = [
    {
      key: "PLAT-10",
      summary: "Open now",
      statusCategoryKey: "new",
      statusName: "To Do",
      created: "2026-08-01T09:00:00.000Z",
      updated: "2026-08-12T09:00:00.000Z",
      labels: [],
      blockedLinksCount: 0,
    },
  ];

  const snapshot = buildHealthSnapshot({
    context: { projectKey: "PLAT", boardId: 1, boardName: "PLAT board" },
    sprint: {
      id: 42,
      name: "Sprint 12",
      startDate: "2026-08-01T09:00:00.000Z",
    },
    issues: currentIssues,
    changelogsByKey: {
      "PLAT-10": [
        {
          at: "2026-07-28T09:00:00.000Z",
          from: null,
          to: "Sprint 12",
          toId: "42",
        },
      ],
    },
    previousSprint: {
      id: 11,
      name: "Sprint 11",
      startDate: "2026-07-15T09:00:00.000Z",
      completeDate: "2026-07-30T17:00:00.000Z",
    },
    previousSprintContext: {
      issues: previousIssues,
      changelogsByKey: {
        "PLAT-1": [
          {
            at: "2026-07-14T09:00:00.000Z",
            from: null,
            to: "Sprint 11",
            toId: "11",
          },
        ],
        "PLAT-2": [
          {
            at: "2026-07-14T09:00:00.000Z",
            from: null,
            to: "Sprint 11",
            toId: "11",
          },
        ],
      },
      previousPreviousSprint: null,
    },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });

  assert.equal(snapshot.comparison.capability.status, "available");
  assert.equal(snapshot.previousSprintMetrics.completionPercent, 100);
  assert.equal(snapshot.completionPercent, 0);
  assert.equal(snapshot.metricDeltas.completionPercent.direction, "deteriorated");
});

test("buildHealthSnapshot stays honest when previous sprint issues are missing", () => {
  const snapshot = buildHealthSnapshot({
    context: { projectKey: "PLAT", boardId: 1, boardName: "PLAT board" },
    sprint: {
      id: 42,
      name: "Sprint 12",
      startDate: "2026-08-01T09:00:00.000Z",
    },
    issues: [
      {
        key: "PLAT-10",
        summary: "Open now",
        statusCategoryKey: "new",
        statusName: "To Do",
        created: "2026-08-01T09:00:00.000Z",
        updated: "2026-08-12T09:00:00.000Z",
        labels: [],
        blockedLinksCount: 0,
      },
    ],
    changelogsByKey: {
      "PLAT-10": [
        {
          at: "2026-07-28T09:00:00.000Z",
          from: null,
          to: "Sprint 12",
          toId: "42",
        },
      ],
    },
    previousSprint: { id: 11, name: "Sprint 11" },
    previousSprintContext: { issues: null, changelogsByKey: {} },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });

  assert.equal(snapshot.comparison.capability.status, "unavailable");
  assert.equal(snapshot.previousSprintMetrics, null);
  assert.ok(snapshot.limitations.some((item) => /previous sprint/i.test(item)));
});
