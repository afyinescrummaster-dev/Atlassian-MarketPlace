import { OVERDUE_AT_RISK_PERCENT } from "./field-catalog.js";

export const overallHealth = (metrics) => {
  if (!metrics || metrics.total === 0) {
    return {
      label: "NO DATA",
      tone: "neutral",
      reasons: ["No issues were retrieved for this project."],
    };
  }

  const reasons = [];

  if (metrics.criticalOpen > 0) {
    reasons.push(
      `${metrics.criticalOpen} open issue(s) have a configured critical priority (${metrics.criticalPriorityRule}).`,
    );
  }

  if (metrics.availability?.blocked === "ok" && metrics.blocked > 0) {
    reasons.push(`${metrics.blocked} open issue(s) are marked blocked.`);
  }

  if (metrics.availability?.overdue === "ok") {
    const overduePercent = metrics.total
      ? Math.round((metrics.overdue / metrics.total) * 100)
      : 0;
    if (overduePercent >= OVERDUE_AT_RISK_PERCENT) {
      reasons.push(
        `Overdue issues are ${overduePercent}% of the total, which is at or above the ${OVERDUE_AT_RISK_PERCENT}% threshold.`,
      );
    }
  }

  if (reasons.length > 0) {
    return { label: "AT RISK", tone: "risk", reasons };
  }

  return {
    label: "ON TRACK",
    tone: "good",
    reasons: ["No critical, blocked, or overdue-threshold conditions were met."],
  };
};
