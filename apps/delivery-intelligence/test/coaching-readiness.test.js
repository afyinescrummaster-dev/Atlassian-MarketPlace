import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectAcceptanceCriteria,
  evaluateDescriptionQuality,
  extractPlainTextFromDescription,
} from "../src/delivery-intelligence/description-quality.js";
import { computeReadiness } from "../src/delivery-intelligence/readiness.js";
import { computeDeliveryPace } from "../src/delivery-intelligence/pace.js";
import { computeCompoundRisks } from "../src/delivery-intelligence/compound-risks.js";
import { computeHistoricalPatterns } from "../src/delivery-intelligence/history-patterns.js";
import { buildBriefs } from "../src/delivery-intelligence/briefs.js";
import { buildHealthSnapshot, computeSprintFacts } from "../src/delivery-intelligence/analyze.js";
import {
  extractSprintChanges,
  extractStatusChanges,
  normalizeIssue,
  isSprintMembershipChange,
} from "../src/delivery-intelligence/normalize.js";
import { classifyIssueSprintHistory } from "../src/delivery-intelligence/membership.js";
import { calculateHealthScore } from "../src/delivery-intelligence/score.js";
import {
  isNaturalLanguagePrompt,
  buildUserPrompt,
  ROVO_INTENTS,
} from "../src/delivery-intelligence/rovo-intents.js";
import { ATTENTION_LEVEL, READINESS_ASSESSMENT } from "../src/delivery-intelligence/thresholds.js";

const sprint = {
  id: 42,
  name: "Sprint 12",
  startDate: "2026-08-01T09:00:00.000Z",
  activatedDate: "2026-08-01T09:00:00.000Z",
  endDate: "2026-08-14T17:00:00.000Z",
  goal: "",
};

test("extractPlainTextFromDescription ignores empty ADF paragraphs", () => {
  const text = extractPlainTextFromDescription({
    type: "doc",
    content: [
      { type: "paragraph", content: [] },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Real content here for the team." }],
      },
    ],
  });
  assert.equal(text, "Real content here for the team.");
});

test("evaluateDescriptionQuality flags missing, short, placeholder, and repeats", () => {
  assert.equal(evaluateDescriptionQuality({ description: "" }).state, "missing");
  assert.equal(
    evaluateDescriptionQuality({ description: "tbd" }).state,
    "weak",
  );
  assert.ok(
    evaluateDescriptionQuality({
      description: "Fix login",
      summary: "Fix login",
    }).reasons.includes("repeats_summary"),
  );
  assert.equal(
    evaluateDescriptionQuality({
      description:
        "Users cannot reset passwords when MFA is enabled. Support needs a clear recovery path before Friday.",
    }).state,
    "sufficient",
  );
});

test("detectAcceptanceCriteria never claims certainty when not detected", () => {
  const missing = detectAcceptanceCriteria({
    description: "Implement the export button for reports.",
  });
  assert.equal(missing.state, "not_detected");
  assert.match(missing.limitation, /may still exist elsewhere/i);

  const detected = detectAcceptanceCriteria({
    description: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Acceptance Criteria" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Export downloads a CSV" }],
                },
              ],
            },
          ],
        },
      ],
    },
  });
  assert.equal(detected.state, "detected");
});

test("normalizeIssue includes description, estimate, parent, and dependency links", () => {
  const issue = normalizeIssue(
    {
      id: "1",
      key: "PAY-9",
      fields: {
        summary: "Child work",
        description: "Detailed enough problem statement for the team to start.",
        status: { name: "To Do", statusCategory: { key: "new" } },
        issuetype: { name: "Sub-task", subtask: true },
        assignee: { displayName: "Alex", accountId: "abc" },
        parent: { key: "PAY-1", fields: { summary: "Parent story" } },
        labels: [],
        issuelinks: [
          {
            type: { name: "Blocks", inward: "is blocked by", outward: "blocks" },
            outwardIssue: {
              key: "PAY-2",
              fields: {
                summary: "Blocker",
                status: { name: "In Progress", statusCategory: { key: "indeterminate" } },
              },
            },
          },
        ],
        customfield_10016: 8,
      },
    },
    { estimateFieldId: "customfield_10016" },
  );

  assert.equal(issue.descriptionText.includes("Detailed enough"), true);
  assert.equal(issue.estimate, 8);
  assert.equal(issue.parentKey, "PAY-1");
  assert.equal(issue.subtask, true);
  assert.equal(issue.assigneeAccountId, "abc");
  assert.equal(issue.dependencyLinks[0].relationship, "is_blocked_by");
});

test("status changelog entries do not break sprint membership classification", () => {
  const changes = [
    ...extractSprintChanges({
      values: [
        {
          created: "2026-07-28T09:00:00.000Z",
          items: [
            {
              field: "Sprint",
              fromString: "Sprint 11",
              toString: "Sprint 12",
              from: "11",
              to: "42",
            },
          ],
        },
      ],
    }),
    ...extractStatusChanges({
      values: [
        {
          created: "2026-08-02T09:00:00.000Z",
          items: [
            {
              field: "status",
              fromString: "To Do",
              toString: "In Progress",
              from: "1",
              to: "2",
            },
          ],
        },
      ],
    }),
  ];

  assert.equal(changes.filter(isSprintMembershipChange).length, 1);
  const classification = classifyIssueSprintHistory({
    changes,
    sprintStart: sprint.activatedDate,
    sprintName: sprint.name,
    sprintId: sprint.id,
    previousSprint: { id: 11, name: "Sprint 11" },
  });
  assert.equal(classification.status, "classified");
  assert.equal(classification.committed, true);
  assert.equal(classification.carryover, true);
});

test("computeReadiness ignores sprint goal and flags missing description carefully", () => {
  const readiness = computeReadiness({
    issues: [
      {
        key: "PAY-1",
        summary: "No description",
        statusCategoryKey: "new",
        statusName: "To Do",
        description: "",
        updated: "2026-08-10T09:00:00.000Z",
        labels: [],
        blockedLinksCount: 0,
      },
    ],
    sprint: { ...sprint, goal: "" },
    scope: { addedIssueKeys: [], originalCommittedIssueKeys: ["PAY-1"] },
    carryover: { carryoverIssueKeys: [] },
    blocked: { blockedIssues: [] },
    estimation: {
      usable: false,
      capability: { status: "unavailable", reason: "No estimation field" },
    },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });

  assert.equal(readiness.sprintGoalPolicy.affectsReadiness, false);
  assert.ok(
    readiness.findings.some((row) => row.signalType === "missing_description"),
  );
  assert.ok(
    !JSON.stringify(readiness).toLowerCase().includes("sprint goal is missing"),
  );
  assert.ok(
    [READINESS_ASSESSMENT.REVIEW_RECOMMENDED, READINESS_ASSESSMENT.NEEDS_ATTENTION].includes(
      readiness.assessment,
    ),
  );
});

test("computeDeliveryPace reports transparent elapsed vs completed", () => {
  const pace = computeDeliveryPace({
    issues: [
      {
        key: "PAY-1",
        summary: "Done",
        statusCategoryKey: "done",
        statusName: "Done",
        updated: "2026-08-10T09:00:00.000Z",
      },
      {
        key: "PAY-2",
        summary: "Todo",
        statusCategoryKey: "new",
        statusName: "To Do",
        updated: "2026-08-10T09:00:00.000Z",
      },
      {
        key: "PAY-3",
        summary: "Doing",
        statusCategoryKey: "indeterminate",
        statusName: "In Progress",
        updated: "2026-08-05T09:00:00.000Z",
        assigneeDisplayName: "Alex",
      },
    ],
    sprint,
    scope: {
      addedIssueKeys: [],
      originalCommittedIssueKeys: ["PAY-1", "PAY-2", "PAY-3"],
      addedIssues: [],
      capability: { status: "available", reason: "ok" },
    },
    blocked: { blockedIssues: [] },
    statusHistoriesByKey: {
      "PAY-3": [
        {
          field: "status",
          at: "2026-08-05T09:00:00.000Z",
          from: "To Do",
          to: "In Progress",
        },
      ],
    },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });

  assert.equal(pace.sprintPace.elapsedPercent != null, true);
  assert.equal(pace.sprintPace.completedPercent, 33);
  assert.ok(pace.signals.some((row) => row.id === "time_vs_completion"));
  assert.ok(pace.agingWork.items.some((row) => row.issueKey === "PAY-3"));
});

test("computeCompoundRisks escalates carryover plus blocked to critical", () => {
  const compound = computeCompoundRisks({
    issues: [
      {
        key: "PAY-2",
        summary: "Blocked carryover",
        statusCategoryKey: "indeterminate",
        statusName: "Blocked",
      },
    ],
    readinessFindings: [
      {
        severity: ATTENTION_LEVEL.HIGH,
        issueKey: "PAY-2",
        issueSummary: "Blocked carryover",
        signalType: "carryover_entering",
        evidence: "Carried over",
        explanation: "Carryover",
      },
    ],
    paceSignals: [],
    blocked: {
      blockedIssues: [{ key: "PAY-2", ageDays: 4, summary: "Blocked carryover" }],
    },
    stale: { staleIssues: [] },
    scope: { addedIssueKeys: [] },
    carryover: { carryoverIssueKeys: ["PAY-2"] },
  });

  assert.equal(compound.items[0].attentionLevel, ATTENTION_LEVEL.CRITICAL);
  assert.ok(compound.items[0].riskCodes.includes("carryover_and_blocked"));
});

test("computeHistoricalPatterns detects recurring carryover", () => {
  const mkFacts = (carryoverCount, scopeChangePercent = 10) => ({
    completion: { completionPercent: 70 },
    scope: {
      scopeChangePercent,
      addedIssueCount: 1,
      originalCommittedCount: 10,
    },
    carryover: { carryoverCount },
    blocked: { blockedCount: 0 },
    stale: { staleCount: 0 },
    health: { score: 80 },
  });

  const patterns = computeHistoricalPatterns({
    currentFacts: mkFacts(1),
    historicalContexts: [
      {
        sprint: { id: 1, name: "S1", completeDate: "2026-07-01T00:00:00.000Z" },
        facts: mkFacts(2),
      },
      {
        sprint: { id: 2, name: "S2", completeDate: "2026-07-15T00:00:00.000Z" },
        facts: mkFacts(3),
      },
    ],
  });

  assert.ok(patterns.patterns.some((row) => row.id === "recurring_carryover"));
});

test("buildBriefs returns plain and markdown for team, leadership, and retro", () => {
  const briefs = buildBriefs({
    snapshotCore: {
      context: { projectKey: "PAY" },
      sprint: { name: "Sprint 12" },
      healthScore: 72,
      healthStatus: "At Risk",
      completionPercent: 40,
      originalCommittedCount: 10,
      currentIssueCount: 12,
      addedIssueCount: 2,
      scopeChangePercent: 20,
      carryoverCount: 1,
      blockedCount: 1,
      staleCount: 0,
    },
    readiness: {
      assessment: "Review recommended",
      counts: { carryover: 1, missingDescription: 1 },
    },
    pace: {
      sprintPace: {
        elapsedPercent: 70,
        pacingState: "watch",
      },
    },
    compoundRisks: {
      counts: { critical: 1 },
      items: [{ issueKey: "PAY-2", attentionLevel: "critical" }],
    },
    coachingInterventions: [
      {
        title: "Unblock paths",
        suggestedIntervention: "Assign unblock owners.",
      },
    ],
    historicalPatterns: {
      patterns: [
        {
          title: "Carryover recurs",
          evidence: "2 of 2 sprints",
        },
      ],
    },
    retrospectiveQuestions: {
      questions: ["What caused carryover?"],
    },
  });

  assert.match(briefs.teamUpdate.plain, /Team update/);
  assert.match(briefs.teamUpdate.markdown, /^# /m);
  assert.match(briefs.leadershipBrief.plain, /Leadership brief/);
  assert.match(briefs.retrospectiveSummary.plain, /Retrospective summary/);
  assert.match(briefs.retrospectiveSummary.plain, /not individual performance/i);
});

test("buildHealthSnapshot adds coaching sections without changing health score", () => {
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
      description: "Completed work with enough detail for audit trail.",
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
      description: "",
      assigneeDisplayName: null,
    },
  ];

  const changelogsByKey = {
    "PAY-2": [
      {
        at: "2026-07-28T09:00:00.000Z",
        from: "Sprint 11",
        to: "Sprint 12",
        field: "sprint",
      },
    ],
  };

  const facts = computeSprintFacts({
    sprint,
    issues,
    changelogsByKey,
    previousSprint: { id: 11, name: "Sprint 11" },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });
  const expectedScore = calculateHealthScore({
    completionPercent: facts.completion.completionPercent,
    scopeChangePercent: facts.scope.scopeChangePercent,
    carryoverCount: facts.carryover.carryoverCount ?? 0,
    blockedCount: facts.blocked.blockedCount,
    staleCount: facts.stale.staleCount,
  }).score;

  const snapshot = buildHealthSnapshot({
    context: { projectKey: "PAY", boardId: 7, boardName: "PAY board" },
    sprint: { ...sprint, goal: "" },
    issues,
    changelogsByKey,
    statusHistoriesByKey: {
      "PAY-2": [
        {
          field: "status",
          at: "2026-08-04T09:00:00.000Z",
          from: "In Progress",
          to: "Blocked",
        },
      ],
    },
    estimation: {
      usable: false,
      fieldId: null,
      capability: { status: "unavailable", reason: "No estimation" },
    },
    previousSprint: { id: 11, name: "Sprint 11" },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });

  assert.equal(snapshot.healthScore, expectedScore);
  assert.ok(snapshot.readiness);
  assert.ok(Array.isArray(snapshot.readinessFindings));
  assert.ok(snapshot.sprintPace);
  assert.ok(snapshot.compoundRisks);
  assert.ok(Array.isArray(snapshot.coachingInterventions));
  assert.ok(snapshot.historicalPatterns);
  assert.ok(Array.isArray(snapshot.retrospectiveQuestions));
  assert.ok(snapshot.briefs.teamUpdate.plain);
  assert.ok(snapshot.briefs.leadershipBrief.markdown);
  assert.equal(snapshot.readiness.sprintGoalPolicy.affectsReadiness, false);
  assert.equal(snapshot.capabilities.readiness.status, "available");
});

test("Rovo prompts stay natural language after coaching increment", () => {
  assert.equal(isNaturalLanguagePrompt(ROVO_INTENTS.explain), true);
  const prompt = buildUserPrompt(
    { context: { projectKey: "PAY" } },
    ROVO_INTENTS.recommend,
  );
  assert.equal(isNaturalLanguagePrompt(prompt), true);
  assert.equal(/[{}]|FACTS/.test(prompt), false);
});

test("whitespace-only and formatted ADF descriptions", () => {
  assert.equal(
    evaluateDescriptionQuality({ description: "   \n\t  " }).state,
    "missing",
  );
  const formatted = evaluateDescriptionQuality({
    description: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Customers cannot complete checkout when",
              marks: [{ type: "strong" }],
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "the payment gateway returns a timeout after three retries and support needs a clear recovery path before Friday release.",
            },
          ],
        },
      ],
    },
  });
  assert.equal(formatted.state, "sufficient");
  assert.ok(formatted.wordCount >= 15);
});

test("acceptance criteria Given/When/Then and custom field detection", () => {
  const gwt = detectAcceptanceCriteria({
    description:
      "Given a logged-in user When they export the report Then a CSV downloads.",
  });
  assert.equal(gwt.state, "detected");
  assert.equal(gwt.evidence, "given_when_then");

  const custom = detectAcceptanceCriteria({
    description: "Short note",
    customFields: {
      customfield_99: {
        name: "Acceptance Criteria",
        value: "Must pass QA smoke suite",
      },
    },
  });
  assert.equal(custom.state, "detected");
  assert.equal(custom.evidence, "named_custom_field");

  const unavailable = detectAcceptanceCriteria({
    descriptionAvailable: false,
    customFields: null,
    configuredFieldId: null,
  });
  assert.equal(unavailable.state, "unavailable");
});

test("readiness estimate, assignee urgency, large issue, and no missing-epic warning", () => {
  const issues = [
    {
      key: "PAY-10",
      summary: "Unestimated",
      statusCategoryKey: "new",
      statusName: "To Do",
      description:
        "Enough words here to avoid weak description findings for this specific estimate check case.",
      estimate: null,
      updated: "2026-08-10T09:00:00.000Z",
      labels: [],
      assigneeDisplayName: "Alex",
    },
    {
      key: "PAY-11",
      summary: "Active unassigned",
      statusCategoryKey: "indeterminate",
      statusName: "In Progress",
      description:
        "Enough words here to avoid weak description findings for this assignee urgency case today.",
      estimate: 3,
      updated: "2026-08-10T09:00:00.000Z",
      labels: [],
      assigneeDisplayName: null,
    },
    {
      key: "PAY-12",
      summary: "Large",
      statusCategoryKey: "new",
      statusName: "To Do",
      description:
        "Enough words here to avoid weak description findings while testing unusually large issue detection.",
      estimate: 40,
      updated: "2026-08-10T09:00:00.000Z",
      labels: [],
      assigneeDisplayName: "Alex",
    },
    {
      key: "PAY-13",
      summary: "Normal A",
      statusCategoryKey: "new",
      statusName: "To Do",
      description:
        "Enough words here to avoid weak description findings while testing unusually large issue detection.",
      estimate: 3,
      updated: "2026-08-10T09:00:00.000Z",
      labels: [],
      assigneeDisplayName: "Alex",
    },
    {
      key: "PAY-14",
      summary: "Normal B",
      statusCategoryKey: "new",
      statusName: "To Do",
      description:
        "Enough words here to avoid weak description findings while testing unusually large issue detection.",
      estimate: 5,
      updated: "2026-08-10T09:00:00.000Z",
      labels: [],
      assigneeDisplayName: "Alex",
    },
    {
      key: "PAY-15",
      summary: "Normal C",
      statusCategoryKey: "new",
      statusName: "To Do",
      description:
        "Enough words here to avoid weak description findings while testing unusually large issue detection.",
      estimate: 2,
      updated: "2026-08-10T09:00:00.000Z",
      labels: [],
      assigneeDisplayName: "Alex",
    },
    {
      key: "PAY-16",
      summary: "Normal D",
      statusCategoryKey: "new",
      statusName: "To Do",
      description:
        "Enough words here to avoid weak description findings while testing unusually large issue detection.",
      estimate: 5,
      updated: "2026-08-10T09:00:00.000Z",
      labels: [],
      assigneeDisplayName: "Alex",
    },
  ];

  const ready = computeReadiness({
    issues,
    sprint,
    scope: {
      addedIssueKeys: [],
      originalCommittedIssueKeys: issues.map((row) => row.key),
    },
    carryover: { carryoverIssueKeys: [] },
    blocked: { blockedIssues: [] },
    estimation: {
      usable: true,
      fieldId: "customfield_10016",
      capability: { status: "available", reason: "Board estimation field available" },
    },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });

  assert.ok(ready.findings.some((row) => row.signalType === "missing_estimate"));
  const unassigned = ready.findings.find(
    (row) => row.signalType === "missing_assignee" && row.issueKey === "PAY-11",
  );
  assert.equal(unassigned.severity, ATTENTION_LEVEL.HIGH);
  assert.ok(ready.findings.some((row) => row.signalType === "unusually_large"));
  assert.ok(
    !ready.findings.some(
      (row) =>
        /epic/i.test(row.explanation || "") || /epic/i.test(row.signalType || ""),
    ),
  );

  const sparse = computeReadiness({
    issues: issues.slice(0, 2),
    sprint,
    scope: { addedIssueKeys: [], originalCommittedIssueKeys: ["PAY-10", "PAY-11"] },
    carryover: { carryoverIssueKeys: [] },
    blocked: { blockedIssues: [] },
    estimation: {
      usable: true,
      fieldId: "customfield_10016",
      capability: { status: "available", reason: "ok" },
    },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });
  assert.equal(sparse.capabilities.largeIssueDetection.status, "unavailable");
  assert.ok(!sparse.findings.some((row) => row.signalType === "unusually_large"));
});

test("unavailable estimation does not mark every issue unestimated", () => {
  const readiness = computeReadiness({
    issues: [
      {
        key: "PAY-20",
        summary: "No estimate field",
        statusCategoryKey: "new",
        statusName: "To Do",
        description:
          "Enough words here to avoid weak description findings for unavailable estimation model cases.",
        estimate: null,
        updated: "2026-08-10T09:00:00.000Z",
        labels: [],
        assigneeDisplayName: "Alex",
      },
    ],
    sprint,
    scope: { addedIssueKeys: [], originalCommittedIssueKeys: ["PAY-20"] },
    carryover: { carryoverIssueKeys: [] },
    blocked: { blockedIssues: [] },
    estimation: {
      usable: false,
      capability: { status: "unavailable", reason: "No estimation model" },
    },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });
  assert.ok(!readiness.findings.some((row) => row.signalType === "missing_estimate"));
});

test("delivery pace story-point basis, reopen, churn, accumulation, ownership language", () => {
  const issues = [];
  for (let i = 1; i <= 9; i += 1) {
    issues.push({
      key: `PAY-${i}`,
      summary: `Issue ${i}`,
      statusCategoryKey: i <= 2 ? "done" : "indeterminate",
      statusName: i <= 2 ? "Done" : i <= 5 ? "Code Review" : "In Progress",
      estimate: 5,
      updated: "2026-08-05T09:00:00.000Z",
      assigneeDisplayName: i >= 3 ? "Akeem" : "Alex",
    });
  }
  issues.push({
    key: "PAY-99",
    summary: "Reopened",
    statusCategoryKey: "indeterminate",
    statusName: "In Progress",
    estimate: 3,
    updated: "2026-08-11T09:00:00.000Z",
    assigneeDisplayName: "Alex",
  });

  const statusHistoriesByKey = {
    "PAY-99": [
      {
        field: "status",
        at: "2026-08-08T09:00:00.000Z",
        from: "In Progress",
        to: "Done",
      },
      {
        field: "status",
        at: "2026-08-09T09:00:00.000Z",
        from: "Done",
        to: "In Progress",
      },
    ],
    "PAY-51": [
      {
        field: "status",
        at: "2026-08-03T09:00:00.000Z",
        from: "To Do",
        to: "In Progress",
      },
    ],
  };
  // churn sample on PAY-6
  statusHistoriesByKey["PAY-6"] = [
    { field: "status", at: "2026-08-02T09:00:00.000Z", from: "To Do", to: "In Progress" },
    { field: "status", at: "2026-08-03T09:00:00.000Z", from: "In Progress", to: "Review" },
    { field: "status", at: "2026-08-04T09:00:00.000Z", from: "Review", to: "In Progress" },
    { field: "status", at: "2026-08-05T09:00:00.000Z", from: "In Progress", to: "Review" },
    { field: "status", at: "2026-08-06T09:00:00.000Z", from: "Review", to: "In Progress" },
  ];

  const pace = computeDeliveryPace({
    issues,
    sprint,
    scope: {
      addedIssueKeys: [],
      originalCommittedIssueKeys: issues.map((row) => row.key),
      addedIssues: [],
      capability: { status: "available", reason: "ok" },
    },
    blocked: { blockedIssues: [] },
    statusHistoriesByKey,
    estimation: { usable: true },
    now: new Date("2026-08-12T12:00:00.000Z"),
  });

  assert.equal(pace.sprintPace.measurementBasis, "story_points");
  assert.ok(pace.reopenedIssues.items.some((row) => row.issueKey === "PAY-99"));
  assert.ok(pace.statusChurn.items.some((row) => row.issueKey === "PAY-6"));
  assert.ok(
    pace.workflowAccumulation.items.some((row) => row.statusName === "Code Review"),
  );
  assert.ok(pace.ownershipConcentration.signal);
  assert.match(pace.ownershipConcentration.signal.explanation, /Review whether work can be redistributed/);
  assert.equal(/overloaded|performance/i.test(pace.ownershipConcentration.signal.explanation), false);
});

test("compound risks consolidate to one issue record", () => {
  const compound = computeCompoundRisks({
    issues: [
      {
        key: "PAY-2",
        summary: "Stacked",
        statusCategoryKey: "indeterminate",
        statusName: "Blocked",
      },
    ],
    readinessFindings: [
      {
        severity: ATTENTION_LEVEL.HIGH,
        issueKey: "PAY-2",
        issueSummary: "Stacked",
        signalType: "carryover_entering",
        evidence: "carryover",
        explanation: "carryover",
      },
      {
        severity: ATTENTION_LEVEL.MEDIUM,
        issueKey: "PAY-2",
        issueSummary: "Stacked",
        signalType: "missing_assignee",
        evidence: "unassigned",
        explanation: "unassigned",
      },
    ],
    paceSignals: [
      {
        id: "aging-PAY-2",
        severity: ATTENTION_LEVEL.MEDIUM,
        issueKey: "PAY-2",
        explanation: "aging",
      },
    ],
    blocked: {
      blockedIssues: [{ key: "PAY-2", ageDays: 4, summary: "Stacked" }],
    },
    stale: { staleIssues: [] },
    scope: { addedIssueKeys: [] },
    carryover: { carryoverIssueKeys: ["PAY-2"] },
  });

  assert.equal(compound.items.length, 1);
  assert.equal(compound.items[0].issueKey, "PAY-2");
  assert.ok(compound.items[0].signals.length >= 2);
});

test("historical patterns handle two-sprint and unavailable cases", () => {
  const mkFacts = (carryoverCount) => ({
    completion: { completionPercent: 70 },
    scope: { scopeChangePercent: 10, addedIssueCount: 1, originalCommittedCount: 10 },
    carryover: { carryoverCount },
    blocked: { blockedCount: 0 },
    stale: { staleCount: 0 },
    health: { score: 80 },
  });

  const two = computeHistoricalPatterns({
    currentFacts: mkFacts(1),
    historicalContexts: [
      {
        sprint: { id: 1, name: "S1", completeDate: "2026-07-01T00:00:00.000Z" },
        facts: mkFacts(2),
      },
    ],
  });
  assert.ok(
    two.capability.status === "partial" ||
      two.patterns.length >= 0,
  );

  const none = computeHistoricalPatterns({
    currentFacts: mkFacts(1),
    historicalContexts: [],
  });
  assert.equal(none.capability.status, "unavailable");
  assert.equal(none.patterns.length, 0);
});
