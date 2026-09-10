import { calculateHealthScore } from "./score.js";
import { commitmentTimestamp } from "./membership.js";
import { compareSprintMetrics, pickComparableMetrics } from "./compare.js";
import {
  computeBlocked,
  computeCarryover,
  computeCompletion,
  computeScopeChange,
  computeStale,
} from "./metrics.js";
import { computeReadiness } from "./readiness.js";
import { computeDeliveryPace } from "./pace.js";
import { computeCompoundRisks } from "./compound-risks.js";
import {
  buildCoachingInterventions,
  buildRetrospectiveQuestions,
} from "./coaching.js";
import { computeHistoricalPatterns } from "./history-patterns.js";
import { buildBriefs } from "./briefs.js";
import { CAPABILITY_STATUS } from "./constants.js";

const dayLabel = (count) => `${count} day${count === 1 ? "" : "s"}`;

const severityFor = (code) => {
  if (code === "blocked") {
    return "High";
  }
  if (code === "scope-change" || code === "carryover") {
    return "Review";
  }
  return "Review";
};

const attentionItem = (item) => ({
  ...item,
  summary: item.explanation || item.summary || "",
});

export const buildTopAnomalies = ({
  scopeChangePercent,
  addedIssueCount,
  carryoverCount,
  carryoverIssueKeys,
  blockedIssues,
  staleIssues,
  completionPercent,
  doneCount,
  totalIssueCount,
}) => {
  const anomalies = [];

  if (addedIssueCount != null && addedIssueCount > 0) {
    anomalies.push(
      attentionItem({
        id: "scope-increase",
        severity: severityFor("scope-change"),
        title: `Scope increased ${scopeChangePercent ?? 0}%`,
        explanation: `${addedIssueCount} issue${addedIssueCount === 1 ? "" : "s"} ${addedIssueCount === 1 ? "was" : "were"} added after sprint start against the original commitment.`,
        evidence: `Scope growth uses added after start / original commitment × 100${scopeChangePercent != null ? ` (${scopeChangePercent}%)` : ""}.`,
        affectedIssueCount: addedIssueCount,
        suggestedAction: "View added issues",
        drillDown: "added",
        metric: "scopeChangePercent",
        value: scopeChangePercent,
      }),
    );
  }

  if (carryoverCount != null && carryoverCount > 0) {
    anomalies.push(
      attentionItem({
        id: "carryover",
        severity: severityFor("carryover"),
        title: `${carryoverCount} carryover issue${carryoverCount === 1 ? "" : "s"}`,
        explanation: `Open work carried from the previous completed sprint${carryoverIssueKeys?.length ? `: ${carryoverIssueKeys.slice(0, 5).join(", ")}` : "."}`,
        evidence: "Carryover requires the board's previous closed sprint plus current membership while the issue is still not Done.",
        affectedIssueCount: carryoverCount,
        issueKey: carryoverIssueKeys?.[0] || null,
        suggestedAction: "View carryover issues",
        drillDown: "carryover",
        metric: "carryoverCount",
        value: carryoverCount,
      }),
    );
  }

  for (const issue of (blockedIssues || []).slice(0, 5)) {
    anomalies.push(
      attentionItem({
        id: `blocked-${issue.key}`,
        severity: "High",
        title: "Blocked work",
        explanation:
          issue.ageDays != null
            ? `${issue.key} has been blocked for ${dayLabel(issue.ageDays)}.`
            : `${issue.key} is blocked.`,
        evidence:
          issue.blockedLinksCount > 0
            ? `Blocked status/links detected; ${issue.blockedLinksCount} blocking relationship${issue.blockedLinksCount === 1 ? "" : "s"}.`
            : "Blocked status or label detected on an open issue.",
        affectedIssueCount: 1,
        issueKey: issue.key,
        suggestedAction: "View blocked issue",
        drillDown: "blocked",
        metric: "blockedCount",
        value: 1,
      }),
    );
  }

  for (const issue of (staleIssues || []).slice(0, 3)) {
    anomalies.push(
      attentionItem({
        id: `stale-${issue.key}`,
        severity: "Review",
        title: "Stale work",
        explanation: `${issue.key} has had no update for ${issue.ageDays ?? "unknown"} days while still open.`,
        evidence: "Open issues with no update for 7 or more days are marked stale.",
        affectedIssueCount: 1,
        issueKey: issue.key,
        suggestedAction: "View stale issues",
        drillDown: "stale",
        metric: "staleCount",
        value: 1,
      }),
    );
  }

  if (
    completionPercent != null &&
    completionPercent < 50 &&
    anomalies.every((item) => item.id !== "low-completion")
  ) {
    const total = totalIssueCount ?? 0;
    const done = doneCount ?? 0;
    anomalies.push(
      attentionItem({
        id: "low-completion",
        severity: "Review",
        title: "Low completion",
        explanation: `${done} of ${total} issues are Done.`,
        evidence: `Completion is ${completionPercent}%, which is below 50%.`,
        affectedIssueCount: Math.max(0, total - done),
        suggestedAction: "View sprint issues",
        drillDown: "completion",
        metric: "completionPercent",
        value: completionPercent,
      }),
    );
  }

  const rank = { High: 0, Review: 1, Informational: 2 };
  return anomalies
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .slice(0, 8);
};

export const computeSprintFacts = ({
  sprint,
  issues,
  changelogsByKey = {},
  previousSprint = null,
  now = new Date(),
}) => {
  const completion = computeCompletion(issues);
  const sprintStart = commitmentTimestamp(sprint);
  const scope = computeScopeChange({
    issues,
    sprintStart,
    sprintName: sprint?.name,
    sprintId: sprint?.id,
    changelogsByKey,
  });
  const carryover = computeCarryover({
    issues,
    sprintStart,
    sprintName: sprint?.name,
    sprintId: sprint?.id,
    changelogsByKey,
    previousSprint,
  });
  const blocked = computeBlocked(issues, now);
  const stale = computeStale(issues, now);
  const health = calculateHealthScore({
    completionPercent: completion.completionPercent,
    scopeChangePercent: scope.scopeChangePercent,
    carryoverCount: carryover.carryoverCount ?? 0,
    blockedCount: blocked.blockedCount,
    staleCount: stale.staleCount,
  });

  return {
    completion,
    scope,
    carryover,
    blocked,
    stale,
    health,
  };
};

const buildComparison = ({
  currentFacts,
  previousSprint = null,
  previousSprintContext = null,
}) => {
  if (!previousSprint) {
    return compareSprintMetrics({
      previousSprint: null,
      reason: "No previous completed sprint was found on this board.",
    });
  }

  if (!previousSprintContext || previousSprintContext.issues == null) {
    return compareSprintMetrics({
      previousSprint,
      previous: null,
      reason:
        previousSprintContext?.reason ||
        "Previous sprint issues could not be loaded, so historical comparison is unavailable.",
    });
  }

  const asOf =
    previousSprint.completeDate ||
    previousSprint.endDate ||
    previousSprintContext.now ||
    new Date();
  const previousFacts = computeSprintFacts({
    sprint: previousSprint,
    issues: previousSprintContext.issues,
    changelogsByKey: previousSprintContext.changelogsByKey || {},
    previousSprint: previousSprintContext.previousPreviousSprint || null,
    now: asOf instanceof Date ? asOf : new Date(asOf),
  });

  return compareSprintMetrics({
    current: pickComparableMetrics({
      healthScore: currentFacts.health.score,
      scopeChangePercent: currentFacts.scope.scopeChangePercent,
      completionPercent: currentFacts.completion.completionPercent,
      carryoverCount: currentFacts.carryover.carryoverCount,
      blockedCount: currentFacts.blocked.blockedCount,
      staleCount: currentFacts.stale.staleCount,
    }),
    previous: pickComparableMetrics({
      healthScore: previousFacts.health.score,
      scopeChangePercent: previousFacts.scope.scopeChangePercent,
      completionPercent: previousFacts.completion.completionPercent,
      carryoverCount: previousFacts.carryover.carryoverCount,
      blockedCount: previousFacts.blocked.blockedCount,
      staleCount: previousFacts.stale.staleCount,
    }),
    previousSprint,
    reason: previousSprintContext.partial
      ? "Previous sprint data is incomplete, so some comparison values may be missing."
      : null,
  });
};

const defaultEstimation = {
  usable: false,
  fieldId: null,
  fieldName: null,
  estimatedIssueCount: 0,
  coverage: 0,
  capability: {
    status: CAPABILITY_STATUS.UNAVAILABLE,
    reason: "Board estimation model was not provided.",
  },
};

export const buildHealthSnapshot = ({
  context,
  sprint,
  issues,
  changelogsByKey = {},
  statusHistoriesByKey = {},
  estimation = null,
  previousSprint = null,
  previousSprintContext = null,
  historicalSprintContexts = [],
  now = new Date(),
}) => {
  const facts = computeSprintFacts({
    sprint,
    issues,
    changelogsByKey,
    previousSprint,
    now,
  });
  const { completion, scope, carryover, blocked, stale, health } = facts;
  const estimationModel = estimation || defaultEstimation;

  const limitations = [];
  if (scope.capability.status === "unavailable") {
    limitations.push(scope.capability.reason);
  }
  if (carryover.capability.status === "unavailable") {
    limitations.push(carryover.capability.reason);
  }

  const comparison = buildComparison({
    currentFacts: facts,
    previousSprint,
    previousSprintContext,
  });
  if (
    previousSprint &&
    comparison.capability.status !== "available" &&
    comparison.capability.reason
  ) {
    limitations.push(comparison.capability.reason);
  }

  const topAnomalies = buildTopAnomalies({
    scopeChangePercent: scope.scopeChangePercent,
    addedIssueCount: scope.addedIssueCount,
    carryoverCount: carryover.carryoverCount,
    carryoverIssueKeys: carryover.carryoverIssueKeys,
    blockedIssues: blocked.blockedIssues,
    staleIssues: stale.staleIssues,
    completionPercent: completion.completionPercent,
    doneCount: completion.doneCount,
    totalIssueCount: completion.totalCount,
  });

  // Sprint goal must never affect readiness or health.
  const readiness = computeReadiness({
    issues,
    sprint,
    scope,
    carryover,
    blocked,
    estimation: estimationModel,
    now,
  });

  const pace = computeDeliveryPace({
    issues,
    sprint,
    scope,
    blocked,
    carryoverIssueKeys: carryover.carryoverIssueKeys || [],
    statusHistoriesByKey,
    estimation: estimationModel,
    now,
  });

  const compoundRisks = computeCompoundRisks({
    issues,
    readinessFindings: readiness.findings,
    paceSignals: pace.signals,
    blocked,
    stale,
    scope,
    carryover,
  });

  const historicalContextsWithFacts = (historicalSprintContexts || [])
    .filter((row) => row?.sprint && row.issues)
    .map((row) => {
      const asOf = row.sprint.completeDate || row.sprint.endDate || now;
      return {
        ...row,
        facts: computeSprintFacts({
          sprint: row.sprint,
          issues: row.issues,
          changelogsByKey: row.changelogsByKey || {},
          previousSprint: row.previousPreviousSprint || null,
          now: asOf instanceof Date ? asOf : new Date(asOf),
        }),
      };
    });

  // Fall back to the single previous sprint context when the richer list is empty.
  if (
    historicalContextsWithFacts.length === 0 &&
    previousSprint &&
    previousSprintContext?.issues
  ) {
    const asOf =
      previousSprint.completeDate || previousSprint.endDate || now;
    historicalContextsWithFacts.push({
      sprint: previousSprint,
      issues: previousSprintContext.issues,
      changelogsByKey: previousSprintContext.changelogsByKey || {},
      previousPreviousSprint: previousSprintContext.previousPreviousSprint || null,
      partial: previousSprintContext.partial,
      facts: computeSprintFacts({
        sprint: previousSprint,
        issues: previousSprintContext.issues,
        changelogsByKey: previousSprintContext.changelogsByKey || {},
        previousSprint: previousSprintContext.previousPreviousSprint || null,
        now: asOf instanceof Date ? asOf : new Date(asOf),
      }),
    });
  }

  const historicalPatterns = computeHistoricalPatterns({
    currentFacts: facts,
    historicalContexts: historicalContextsWithFacts,
  });

  const coaching = buildCoachingInterventions({
    readiness,
    pace,
    compoundRisks,
    scope,
    carryover,
    blocked,
    comparison,
  });

  const retrospectiveQuestions = buildRetrospectiveQuestions({
    coachingInterventions: coaching.interventions,
    historicalPatterns,
    readiness,
    pace,
  });

  const briefs = buildBriefs({
    snapshotCore: {
      context,
      sprint,
      healthScore: health.score,
      healthStatus: health.status,
      completionPercent: completion.completionPercent,
      originalCommittedCount: scope.originalCommittedCount,
      currentIssueCount: scope.currentIssueCount ?? completion.totalCount,
      addedIssueCount: scope.addedIssueCount,
      scopeChangePercent: scope.scopeChangePercent,
      carryoverCount: carryover.carryoverCount,
      blockedCount: blocked.blockedCount,
      staleCount: stale.staleCount,
    },
    readiness,
    pace,
    compoundRisks,
    coachingInterventions: coaching.interventions,
    historicalPatterns,
    retrospectiveQuestions,
  });

  return {
    version: "0.1",
    generatedAt: now.toISOString(),
    context,
    sprint,
    healthScore: health.score,
    healthMax: health.max,
    healthStatus: health.status,
    completionPercent: completion.completionPercent,
    scopeChangePercent: scope.scopeChangePercent,
    originalCommittedCount: scope.originalCommittedCount,
    currentIssueCount: scope.currentIssueCount ?? completion.totalCount,
    currentIssueKeys: (issues || []).map((issue) => issue.key).filter(Boolean),
    addedIssueCount: scope.addedIssueCount,
    originalCommittedIssueKeys: scope.originalCommittedIssueKeys,
    originalCommittedIssues: scope.originalCommittedIssues,
    addedIssueKeys: scope.addedIssueKeys,
    addedIssues: scope.addedIssues,
    removedIssueCount: scope.removedIssueCount,
    removedIssueKeys: scope.removedIssueKeys,
    carryoverCount: carryover.carryoverCount,
    carryoverIssueKeys: carryover.carryoverIssueKeys,
    carryoverIssues: carryover.carryoverIssues,
    blockedCount: blocked.blockedCount,
    blockedIssues: blocked.blockedIssues,
    staleCount: stale.staleCount,
    staleIssues: stale.staleIssues,
    doneCount: completion.doneCount,
    totalIssueCount: completion.totalCount,
    doneIssues: completion.doneIssues,
    openIssues: completion.openIssues,
    topAnomalies,
    scoreDeductions: health.deductions,
    previousSprint: comparison.previousSprint,
    previousSprintMetrics: comparison.previousSprintMetrics,
    metricDeltas: comparison.metricDeltas,
    comparison,
    readiness,
    readinessFindings: readiness.findings,
    sprintPace: pace.sprintPace,
    deliveryPace: pace,
    compoundRisks,
    coachingInterventions: coaching.interventions,
    historicalPatterns,
    retrospectiveQuestions: retrospectiveQuestions.questions,
    briefs: {
      teamUpdate: briefs.teamUpdate,
      leadershipBrief: briefs.leadershipBrief,
      retrospectiveSummary: briefs.retrospectiveSummary,
    },
    estimation: estimationModel,
    capabilities: {
      scopeChange: scope.capability,
      carryover: carryover.capability,
      scopeRemovals: scope.removals,
      comparison: comparison.capability,
      readiness: {
        status: CAPABILITY_STATUS.AVAILABLE,
        reason: "Readiness findings use issue fields and deterministic heuristics.",
      },
      descriptionQuality: readiness.capabilities?.descriptionQuality,
      acceptanceCriteriaDetection: readiness.capabilities?.acceptanceCriteriaDetection,
      estimationCoverage: readiness.capabilities?.estimationCoverage,
      assignmentCoverage: readiness.capabilities?.assignmentCoverage,
      largeIssueDetection: readiness.capabilities?.largeIssueDetection,
      dependencyContext: readiness.capabilities?.dependencyContext,
      sprintPace: pace.sprintPace?.capability,
      agingWork: pace.agingWork?.capability,
      compoundRisks: compoundRisks.capability,
      coaching: coaching.capability,
      historicalPatterns: historicalPatterns.capability,
      retrospectiveQuestions: retrospectiveQuestions.capability,
      briefs: briefs.capability,
    },
    limitations,
  };
};
