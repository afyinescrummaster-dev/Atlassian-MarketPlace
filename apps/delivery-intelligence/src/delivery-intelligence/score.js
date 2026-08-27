import { HEALTH_STATUS, SCORE_WEIGHTS } from "./constants.js";

export const calculateHealthScore = ({
  completionPercent,
  scopeChangePercent,
  carryoverCount,
  blockedCount,
  staleCount,
}) => {
  let score = 100;
  const deductions = [];

  if (scopeChangePercent != null && scopeChangePercent > 0) {
    const buckets = Math.ceil(scopeChangePercent / 10);
    const points = Math.min(
      buckets * SCORE_WEIGHTS.scopeChange.perTenPercent,
      SCORE_WEIGHTS.scopeChange.max,
    );
    score -= points;
    deductions.push({
      code: "scope-change",
      points,
      label: "Scope added after sprint start",
      value: scopeChangePercent,
    });
  }

  if (carryoverCount > 0) {
    const points = Math.min(
      carryoverCount * SCORE_WEIGHTS.carryover.perIssue,
      SCORE_WEIGHTS.carryover.max,
    );
    score -= points;
    deductions.push({
      code: "carryover",
      points,
      label: "Carryover work",
      value: carryoverCount,
    });
  }

  if (blockedCount > 0) {
    const points = Math.min(
      blockedCount * SCORE_WEIGHTS.blocked.perIssue,
      SCORE_WEIGHTS.blocked.max,
    );
    score -= points;
    deductions.push({
      code: "blocked",
      points,
      label: "Blocked issues",
      value: blockedCount,
    });
  }

  if (staleCount > 0) {
    const points = Math.min(
      staleCount * SCORE_WEIGHTS.stale.perIssue,
      SCORE_WEIGHTS.stale.max,
    );
    score -= points;
    deductions.push({
      code: "stale",
      points,
      label: "Stale work",
      value: staleCount,
    });
  }

  if (
    completionPercent != null &&
    completionPercent < SCORE_WEIGHTS.lowCompletion.threshold
  ) {
    score -= SCORE_WEIGHTS.lowCompletion.penalty;
    deductions.push({
      code: "low-completion",
      points: SCORE_WEIGHTS.lowCompletion.penalty,
      label: "Low sprint completion",
      value: completionPercent,
    });
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: clamped,
    max: 100,
    status: healthStatusForScore(clamped),
    deductions,
  };
};

export const healthStatusForScore = (score) => {
  if (score >= 80) {
    return HEALTH_STATUS.ON_TRACK;
  }
  if (score >= 60) {
    return HEALTH_STATUS.AT_RISK;
  }
  return HEALTH_STATUS.NEEDS_ATTENTION;
};
