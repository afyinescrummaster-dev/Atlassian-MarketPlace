import { CAPABILITY_STATUS } from "./constants.js";
import { ATTENTION_LEVEL } from "./thresholds.js";

/**
 * Patterns across up to 3 completed sprints.
 * Expects each historical context to include precomputed `facts` from computeSprintFacts.
 */
export const computeHistoricalPatterns = ({
  currentFacts = null,
  historicalContexts = [],
} = {}) => {
  const sprintSeries = [];

  for (const context of historicalContexts || []) {
    if (!context?.sprint || !context.facts) {
      continue;
    }
    const facts = context.facts;
    sprintSeries.push({
      sprintId: context.sprint.id,
      sprintName: context.sprint.name,
      completeDate: context.sprint.completeDate || context.sprint.endDate || null,
      completionPercent: facts.completion.completionPercent,
      scopeChangePercent: facts.scope.scopeChangePercent,
      carryoverCount: facts.carryover.carryoverCount,
      blockedCount: facts.blocked.blockedCount,
      staleCount: facts.stale.staleCount,
      healthScore: facts.health.score,
      addedIssueCount: facts.scope.addedIssueCount,
      originalCommittedCount: facts.scope.originalCommittedCount,
      partial: Boolean(context.partial),
    });
  }

  if (currentFacts) {
    sprintSeries.unshift({
      sprintId: "current",
      sprintName: "Current sprint",
      completeDate: null,
      completionPercent: currentFacts.completion.completionPercent,
      scopeChangePercent: currentFacts.scope.scopeChangePercent,
      carryoverCount: currentFacts.carryover.carryoverCount,
      blockedCount: currentFacts.blocked.blockedCount,
      staleCount: currentFacts.stale.staleCount,
      healthScore: currentFacts.health.score,
      addedIssueCount: currentFacts.scope.addedIssueCount,
      originalCommittedCount: currentFacts.scope.originalCommittedCount,
      partial: false,
      isCurrent: true,
    });
  }

  const completed = sprintSeries.filter((row) => !row.isCurrent);
  const patterns = [];

  if (completed.length === 0) {
    return {
      sprintSeries,
      patterns: [],
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason: "No completed sprint history was available for pattern detection.",
      },
    };
  }

  const carryoverPositive = completed.filter(
    (row) => row.carryoverCount != null && row.carryoverCount > 0,
  );
  if (carryoverPositive.length >= 2) {
    patterns.push({
      id: "recurring_carryover",
      attentionLevel: ATTENTION_LEVEL.HIGH,
      title: "Carryover recurs across recent sprints",
      evidence: `${carryoverPositive.length} of the last ${completed.length} completed sprint${
        completed.length === 1 ? "" : "s"
      } had carryover.`,
      interpretation:
        "Recurring carryover often points to systemic sizing, readiness, or interruption issues rather than a one-off miss.",
      suggestedFocus: "Inspect carryover causes before the next planning event.",
    });
  }

  const scopeHeavy = completed.filter(
    (row) => row.scopeChangePercent != null && row.scopeChangePercent >= 25,
  );
  if (scopeHeavy.length >= 2) {
    patterns.push({
      id: "recurring_scope_growth",
      attentionLevel: ATTENTION_LEVEL.MEDIUM,
      title: "Scope growth repeats after sprint start",
      evidence: `${scopeHeavy.length} of the last ${completed.length} completed sprint${
        completed.length === 1 ? "" : "s"
      } grew by at least 25% after start.`,
      interpretation:
        "Repeated mid-sprint additions can erode focus and readiness quality for newly added work.",
      suggestedFocus: "Agree an intake rule for mid-sprint additions.",
    });
  }

  const blockedHeavy = completed.filter(
    (row) => row.blockedCount != null && row.blockedCount >= 2,
  );
  if (blockedHeavy.length >= 2) {
    patterns.push({
      id: "recurring_blockers",
      attentionLevel: ATTENTION_LEVEL.HIGH,
      title: "Blocked work appears repeatedly",
      evidence: `${blockedHeavy.length} of the last ${completed.length} completed sprint${
        completed.length === 1 ? "" : "s"
      } had at least two blocked issues at analysis time.`,
      interpretation:
        "Persistent blockers may indicate dependency or decision bottlenecks outside the team’s day-to-day flow.",
      suggestedFocus: "Map the most common blocker sources and owners.",
    });
  }

  const completions = completed
    .map((row) => row.completionPercent)
    .filter((value) => value != null);
  if (completions.length >= 2) {
    const avg =
      completions.reduce((sum, value) => sum + value, 0) / completions.length;
    const currentCompletion = currentFacts?.completion?.completionPercent;
    if (currentCompletion != null && currentCompletion + 15 < avg) {
      patterns.push({
        id: "completion_below_recent_average",
        attentionLevel: ATTENTION_LEVEL.MEDIUM,
        title: "Current completion trails recent history",
        evidence: `Current completion is ${currentCompletion}% versus a recent completed-sprint average of ${Math.round(
          avg,
        )}%.`,
        interpretation:
          "This is an early pacing contrast against recent history, not a prediction of sprint failure.",
        suggestedFocus: "Compare remaining open work against what usually finishes.",
      });
    }
  }

  const healthScores = completed
    .map((row) => row.healthScore)
    .filter((value) => value != null);
  if (healthScores.length >= 3) {
    let declining = true;
    for (let i = 0; i < healthScores.length - 1; i += 1) {
      // completed is newest-first
      if (!(healthScores[i] < healthScores[i + 1])) {
        declining = false;
        break;
      }
    }
    if (declining) {
      patterns.push({
        id: "declining_health_trend",
        attentionLevel: ATTENTION_LEVEL.MEDIUM,
        title: "Health scores declined across recent completed sprints",
        evidence: `Recent completed health scores: ${healthScores.join(", ")} (newest first).`,
        interpretation:
          "A short declining streak is a learning signal. Treat it as a prompt for one systemic experiment.",
        suggestedFocus: "Choose one recurring deduction category to improve next sprint.",
      });
    }
  }

  return {
    sprintSeries,
    patterns,
    capability: {
      status:
        completed.some((row) => row.partial) || completed.length < 2
          ? CAPABILITY_STATUS.PARTIAL
          : CAPABILITY_STATUS.AVAILABLE,
      reason:
        completed.length < 2
          ? `Pattern detection used ${completed.length} completed sprint${
              completed.length === 1 ? "" : "s"
            }; more history would strengthen confidence.`
          : `Patterns derived from ${completed.length} completed sprint${
              completed.length === 1 ? "" : "s"
            }.`,
    },
  };
};
