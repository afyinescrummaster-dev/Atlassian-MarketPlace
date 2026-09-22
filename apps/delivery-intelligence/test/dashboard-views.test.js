import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRIEF_MODES,
  DASHBOARD_TABS,
  ROVO_POLICY,
  addedIssueRows,
  briefFacts,
  buildScopeTimeline,
  capabilityState,
  filterBriefPreview,
  filterIssueRows,
  findingsFilterOptions,
  isSprintEndPassed,
  paceFlow,
  readinessDimensions,
  readinessIssueRows,
  reliableSprintSeries,
} from "../static/dashboard/src/dashboard-ia.js";

const snapshot = {
  healthScore: 55,
  healthStatus: "Needs Attention",
  completionPercent: 0,
  currentIssueCount: 17,
  originalCommittedCount: 8,
  addedIssueCount: 9,
  addedIssueKeys: ["PLAT-10"],
  addedIssues: [
    { key: "PLAT-10", summary: "Added later", joinedAt: "2026-08-29T10:00:00.000Z", statusName: "To Do" },
  ],
  staleCount: 17,
  staleIssues: [{ key: "PLAT-1" }],
  blockedCount: 1,
  blockedIssues: [{ key: "PLAT-39" }],
  carryoverCount: 0,
  carryoverIssueKeys: [],
  openIssues: Array.from({ length: 17 }, (_, index) => ({ key: `PLAT-${index + 1}` })),
  readiness: {
    counts: {
      missingDescription: 0,
      weakDescription: 4,
      acceptanceCriteriaNotDetected: 17,
      missingEstimate: 6,
      missingAssignee: 3,
      blockers: 1,
      dependencyContext: 0,
    },
  },
  readinessFindings: [
    {
      signalType: "acceptance_criteria_not_detected",
      severity: "medium",
      issueKey: "PLAT-31",
      explanation: "No acceptance criteria detected",
    },
    {
      signalType: "weak_description",
      severity: "high",
      issueKey: "PLAT-7",
      explanation: "Short description",
    },
  ],
  sprintPace: { elapsedPercent: 100, completedPercent: 0, measurementBasis: "issues" },
  deliveryPace: { workStateCounts: { notStarted: 11, inProgress: 6, done: 0, open: 17, total: 17 } },
  sprint: { startDate: "2026-08-27T09:00:00.000Z", endDate: "2026-09-01T17:00:00.000Z" },
  capabilities: { scopeRemovals: { status: "unavailable", reason: "Removed / de-scoped is unavailable." } },
  historicalPatterns: {
    capability: { status: "partial", reason: "Only one completed sprint was available." },
    sprintSeries: [
      { sprintId: "current", isCurrent: true, scopeChangePercent: 112.5, sprintName: "Current" },
      { sprintId: 1, isCurrent: false, partial: false, scopeChangePercent: 35, sprintName: "Sprint 1" },
    ],
    patterns: [],
  },
  briefs: {
    leadershipBrief: {
      title: "Leadership brief — Sprint 1",
      plain: [
        "Leadership brief — Sprint 1",
        "Executive summary",
        "Health 55/100.",
        "Delivery risk",
        "Transparent pacing is behind elapsed time.",
        "Ask of leadership",
        "Support blocker removal.",
      ].join("\n"),
      markdown: "# Leadership brief — Sprint 1",
    },
  },
};

test("navigation stays on the six primary sections", () => {
  assert.deepEqual(
    DASHBOARD_TABS.map((tab) => tab.id),
    ["overview", "readiness", "pace", "scope", "learning", "briefs"],
  );
});

test("readiness dimensions and issue rows stay grouped and searchable", () => {
  const dimensions = readinessDimensions(snapshot);
  assert.equal(dimensions.find((row) => row.id === "acceptance").score, 0);
  assert.equal(dimensions.find((row) => row.id === "ownership").score, 82);
  const rows = readinessIssueRows(snapshot.readinessFindings, new Map());
  const filtered = filterIssueRows(rows, { query: "PLAT-31", severity: "all" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].key, "PLAT-31");
  assert.equal(filterIssueRows(rows, { severity: "high" }).length, 1);
});

test("findings filters and selected-issue detail stay issue-based", () => {
  const options = findingsFilterOptions(snapshot);
  assert.equal(options[0].id, "all");
  assert.ok(options.some((row) => row.id === "blocked"));
  assert.ok(options.some((row) => row.label.includes("Acceptance criteria")));
});

test("closed-sprint pace is a result, not an active forecast", () => {
  const now = new Date("2026-09-21T12:00:00.000Z");
  assert.equal(isSprintEndPassed(snapshot.sprint, now), true);
  const flow = paceFlow(snapshot);
  assert.equal(flow.closed, true);
  assert.equal(flow.notStarted, 11);
  assert.equal(flow.basis, "Issues");
});

test("scope timeline does not invent removals and supports added-issue selection", () => {
  const timeline = buildScopeTimeline(snapshot);
  assert.equal(timeline.removalsAvailable, false);
  assert.match(timeline.removalsNote, /unavailable/i);
  assert.ok(timeline.points[0].cumulative === 8);
  const rows = addedIssueRows(snapshot, new Map());
  assert.equal(rows[0].key, "PLAT-10");
  assert.equal(filterIssueRows(rows, { query: "added" }).length, 1);
});

test("learning series uses only reliable completed sprints", () => {
  const series = reliableSprintSeries(snapshot, 3);
  assert.equal(series.completed.length, 1);
  assert.equal(series.points.length, 2);
  assert.equal(capabilityState(snapshot.historicalPatterns.capability).status, "partial");
});

test("brief modes filter preview sections without changing metrics", () => {
  assert.deepEqual(
    BRIEF_MODES.map((row) => row.id),
    ["team", "leadership", "retro"],
  );
  const full = filterBriefPreview({
    brief: snapshot.briefs.leadershipBrief,
    includes: { health: true, pace: true, scope: true, risks: true, decisions: true, jira: true },
    detail: "executive",
  });
  assert.ok(full.sections.some((row) => row.heading === "Delivery risk"));
  const hidden = filterBriefPreview({
    brief: snapshot.briefs.leadershipBrief,
    includes: { health: true, pace: true, scope: true, risks: false, decisions: false, jira: true },
    detail: "executive",
  });
  assert.equal(hidden.sections.some((row) => row.heading === "Delivery risk"), false);
  assert.equal(briefFacts(snapshot)[0].value, "55/100");
});

test("Rovo is never auto-invoked from dashboard load", () => {
  assert.equal(ROVO_POLICY.autoInvoke, false);
  const root = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(root, "../static/dashboard/src/App.jsx"), "utf8");
  assert.match(source, /rovo\s*\n?\s*\.isEnabled/);
  for (const block of source.split("useEffect").slice(1)) {
    assert.equal(block.slice(0, 500).includes("rovo.open"), false);
  }
});
