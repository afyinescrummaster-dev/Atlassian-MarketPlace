import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROVO_NO_SPRINT_NOTE,
  ROVO_UNAVAILABLE_NOTE,
  resolveRovoHandoff,
} from "../static/dashboard/src/rovo-handoff.js";
import { compactSnapshotForRovo } from "../src/resolvers/rovo-actions.js";

test("resolveRovoHandoff blocks when sprint snapshot is missing", () => {
  const result = resolveRovoHandoff({ snapshot: null, rovoEnabled: true });
  assert.equal(result.proceed, false);
  assert.equal(result.message, ROVO_NO_SPRINT_NOTE);
});

test("resolveRovoHandoff blocks with clear note when Rovo is disabled", () => {
  const result = resolveRovoHandoff({
    snapshot: { sprint: { id: 1, name: "Sprint A" } },
    rovoEnabled: false,
  });
  assert.equal(result.proceed, false);
  assert.equal(result.message, ROVO_UNAVAILABLE_NOTE);
});

test("resolveRovoHandoff proceeds while Rovo availability is still unknown", () => {
  const result = resolveRovoHandoff({
    snapshot: { sprint: { id: 1, name: "Sprint A" } },
    rovoEnabled: null,
  });
  assert.equal(result.proceed, true);
  assert.equal(result.message, null);
});

test("resolveRovoHandoff proceeds when Rovo is enabled", () => {
  const result = resolveRovoHandoff({
    snapshot: { sprint: { id: 1, name: "Sprint A" } },
    rovoEnabled: true,
  });
  assert.equal(result.proceed, true);
  assert.equal(result.message, null);
});

test("compactSnapshotForRovo keeps agent payload fields without inventing metrics", () => {
  const compact = compactSnapshotForRovo({
    generatedAt: "2026-09-10T12:00:00.000Z",
    context: { projectKey: "PLAT" },
    sprint: { id: 42, name: "Sprint 12", startDate: "2026-08-01", endDate: "2026-08-14", goal: "Ship" },
    healthScore: 55,
    healthStatus: "Needs Attention",
    completionPercent: 40,
    scopeChangePercent: 62.5,
    originalCommittedCount: 8,
    currentIssueCount: 13,
    addedIssueCount: 5,
    originalCommittedIssueKeys: ["PLAT-1", "PLAT-2"],
    addedIssueKeys: ["PLAT-9"],
    carryoverCount: 1,
    carryoverIssueKeys: ["PLAT-20"],
    blockedCount: 0,
    blockedIssues: [],
    staleCount: 0,
    staleIssues: [],
    topAnomalies: [],
    readiness: { assessment: "Needs attention" },
    readinessFindings: [],
    sprintPace: {
      elapsedPercent: 50,
      completedPercent: 40,
      pacingState: "behind_current_pace",
      measurementBasis: "issue_count",
      openWorkRemaining: 8,
    },
    compoundRisks: { counts: { critical: 0 }, items: [] },
    coachingInterventions: [],
    historicalPatterns: { patterns: [] },
    retrospectiveQuestions: [],
    briefs: {
      teamUpdate: { plain: "Team update body" },
      leadershipBrief: { plain: "Leadership body" },
      retrospectiveSummary: { plain: "Retro body" },
    },
    previousSprint: null,
    previousSprintMetrics: null,
    metricDeltas: null,
    comparison: null,
    capabilities: {},
    limitations: [],
  });

  assert.equal(compact.sprint.name, "Sprint 12");
  assert.equal(compact.sprint.goal, undefined);
  assert.equal(compact.scopeChangePercent, 62.5);
  assert.equal(compact.sprintPace.pacingState, "behind_current_pace");
  assert.equal(compact.briefs.teamUpdate, "Team update body");
  assert.equal(compactSnapshotForRovo(null), null);
});
