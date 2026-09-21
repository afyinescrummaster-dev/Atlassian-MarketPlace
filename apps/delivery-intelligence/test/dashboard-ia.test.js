import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DASHBOARD_TABS,
  allFindingsCount,
  attentionLevelLabel,
  buildCoachAttentionItems,
  groupPaceSignals,
  groupReadinessFindings,
  isInternalSignalId,
  isSprintEndPassed,
  overviewReadinessCounts,
  paceHeadline,
  paceSummaryCopy,
  pickLearningInsight,
  readableSignalTitle,
  topCoachAttention,
} from "../static/dashboard/src/dashboard-ia.js";

const fixtureSnapshot = {
  addedIssueCount: 9,
  addedIssueKeys: ["PLAT-10", "PLAT-11"],
  scopeChangePercent: 112.5,
  staleCount: 17,
  staleIssues: [{ key: "PLAT-1", ageDays: 9 }, { key: "PLAT-2", ageDays: 8 }],
  blockedCount: 1,
  blockedIssues: [{ key: "PLAT-39", ageDays: 24, summary: "Blocked item" }],
  carryoverCount: 0,
  readiness: {
    assessment: "Needs attention",
    counts: {
      totalFindings: 31,
      weakDescription: 4,
      acceptanceCriteriaNotDetected: 17,
      missingEstimate: 6,
      missingAssignee: 3,
      blockers: 1,
    },
  },
  readinessFindings: [
    { signalType: "weak_description", severity: "medium", issueKey: "PLAT-3", explanation: "Short description" },
    { signalType: "weak_description", severity: "medium", issueKey: "PLAT-4", explanation: "Short description" },
    { signalType: "weak_description", severity: "medium", issueKey: "PLAT-5", explanation: "Short description" },
    { signalType: "weak_description", severity: "medium", issueKey: "PLAT-6", explanation: "Short description" },
    {
      signalType: "acceptance_criteria_not_detected",
      severity: "medium",
      issueKey: "PLAT-7",
      explanation: "AC not detected",
    },
    { signalType: "missing_estimate", severity: "medium", issueKey: "PLAT-8", explanation: "No estimate" },
    { signalType: "existing_blocker", severity: "high", issueKey: "PLAT-39", explanation: "Blocked" },
  ],
  deliveryPace: {
    workStateCounts: { notStarted: 7, inProgress: 6, done: 0 },
    signals: [
      { id: "time_vs_completion", severity: "high", explanation: "Time is ahead of completion." },
      { id: "aging-PLAT-48", severity: "medium", issueKey: "PLAT-48", explanation: "PLAT-48 has aged in status." },
      { id: "aging-PLAT-12", severity: "medium", issueKey: "PLAT-12", explanation: "PLAT-12 has aged in status." },
      {
        id: "blocker-duration-PLAT-39",
        severity: "high",
        issueKey: "PLAT-39",
        explanation: "PLAT-39 has been blocked for 24 days.",
      },
    ],
  },
  sprintPace: {
    elapsedPercent: 100,
    completedPercent: 0,
    pacingState: "behind_current_pace",
    note: "Transparent pacing assessment — not an advanced forecast.",
  },
  sprint: {
    name: "Sprint DI Bulk Import Test 1",
    endDate: "2026-09-01T17:00:00.000Z",
  },
  coachingInterventions: [
    {
      id: "protect-sprint-focus",
      attentionLevel: "high",
      title: "Protect sprint focus after scope growth",
      evidence: "9 issues were added after sprint start.",
      interpretation: "Late additions compete with the original commitment.",
      suggestedIntervention: "Review added issues for readiness.",
      issueKeys: ["PLAT-10"],
    },
  ],
  historicalPatterns: {
    patterns: [
      {
        id: "recurring_carryover",
        title: "Carryover recurs across recent sprints",
        interpretation: "Work keeps rolling forward.",
      },
    ],
  },
};

test("dashboard tabs match the requested information architecture", () => {
  assert.deepEqual(
    DASHBOARD_TABS.map((tab) => tab.label),
    ["Overview", "Readiness", "Delivery Pace", "Scope & Risk", "Learning", "Briefs"],
  );
});

test("readiness findings are grouped by type with counts instead of one card per issue", () => {
  const groups = groupReadinessFindings(fixtureSnapshot.readinessFindings);
  const weak = groups.find((row) => row.groupId === "weak_description");
  assert.equal(weak.count, 4);
  assert.equal(weak.title, "Weak descriptions");
  assert.deepEqual(weak.issueKeys, ["PLAT-3", "PLAT-4", "PLAT-5", "PLAT-6"]);
  assert.equal(groups.some((row) => row.title.includes("PLAT-3")), false);
});

test("overview readiness uses category counts, not individual issue cards", () => {
  const counts = overviewReadinessCounts(fixtureSnapshot.readiness);
  assert.deepEqual(
    counts.map((row) => [row.label, row.count]),
    [
      ["Weak descriptions", 4],
      ["AC not detected", 17],
      ["Missing estimates", 6],
      ["Unassigned", 3],
      ["Blockers", 1],
    ],
  );
});

test("pace signals group aging work and never expose internal ids", () => {
  const groups = groupPaceSignals(fixtureSnapshot.deliveryPace.signals);
  const aging = groups.find((row) => row.groupId === "aging_work");
  assert.equal(aging.title, "Aging work");
  assert.equal(aging.count, 2);
  assert.deepEqual(aging.issueKeys, ["PLAT-48", "PLAT-12"]);
  assert.equal(readableSignalTitle("aging-PLAT-48"), "Aging work");
  assert.equal(isInternalSignalId("aging-PLAT-48"), true);
  assert.equal(
    groups.some((row) => String(row.title).includes("aging-PLAT")),
    false,
  );
});

test("coach attention consolidates stale and blocked work and keeps only the top 3", () => {
  const all = buildCoachAttentionItems(fixtureSnapshot);
  const top = topCoachAttention(fixtureSnapshot, 3);
  assert.equal(top.length, 3);
  assert.deepEqual(
    top.map((row) => row.title),
    [
      "PLAT-39 blocked for 24 days",
      "Scope increased 112.5%",
      "Stale work affecting 17 issues",
    ],
  );
  assert.equal(all.some((row) => row.id === "stale"), true);
  assert.equal(all.filter((row) => row.id.startsWith("stale-")).length, 0);
  assert.equal(all.some((row) => row.id === "coach:protect-sprint-focus"), true);
  assert.equal(top.some((row) => String(row.id).startsWith("coach:")), false);
  assert.equal(allFindingsCount(fixtureSnapshot), 31);
});

test("sprint end date passed replaces active pacing forecast copy", () => {
  const now = new Date("2026-09-21T23:00:00.000Z");
  assert.equal(isSprintEndPassed(fixtureSnapshot.sprint, now), true);
  assert.equal(paceHeadline(fixtureSnapshot.sprintPace, fixtureSnapshot.sprint, now), "Sprint end date passed");
  assert.match(
    paceSummaryCopy(fixtureSnapshot.sprintPace, fixtureSnapshot.sprint, now),
    /The sprint has ended/,
  );
  assert.equal(
    paceHeadline(
      fixtureSnapshot.sprintPace,
      { endDate: "2026-12-01T17:00:00.000Z" },
      now,
    ),
    "Behind current pace",
  );
});

test("learning insight uses one readable pattern instead of a full comparison dump", () => {
  const insight = pickLearningInsight(fixtureSnapshot);
  assert.equal(insight.title, "Carryover recurs across recent sprints");
  assert.match(insight.summary, /rolling forward/);
  assert.equal(attentionLevelLabel("high"), "High");
  assert.equal(attentionLevelLabel("medium"), "Review");
});
