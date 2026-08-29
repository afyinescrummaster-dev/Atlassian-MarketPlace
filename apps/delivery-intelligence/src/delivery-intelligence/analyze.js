import { calculateHealthScore } from "./score.js";
import { commitmentTimestamp } from "./membership.js";
import {
  computeBlocked,
  computeCarryover,
  computeCompletion,
  computeScopeChange,
  computeStale,
} from "./metrics.js";

const severityFor = (code) => {
  if (code === "blocked") {
    return "High";
  }
  if (code === "scope-change" || code === "carryover") {
    return "Review";
  }
  return "Review";
};

export const buildTopAnomalies = ({
  scopeChangePercent,
  addedIssueCount,
  carryoverCount,
  carryoverIssueKeys,
  blockedIssues,
  staleIssues,
  completionPercent,
}) => {
  const anomalies = [];

  if (addedIssueCount != null && addedIssueCount > 0) {
    anomalies.push({
      id: "scope-increase",
      severity: severityFor("scope-change"),
      title: `Sprint scope increased ${scopeChangePercent ?? 0}%`,
      summary: `${addedIssueCount} issue${addedIssueCount === 1 ? "" : "s"} added after sprint start against the original commitment.`,
      metric: "scopeChangePercent",
      value: scopeChangePercent,
    });
  }

  if (carryoverCount != null && carryoverCount > 0) {
    anomalies.push({
      id: "carryover",
      severity: severityFor("carryover"),
      title: `${carryoverCount} carryover issue${carryoverCount === 1 ? "" : "s"}`,
      summary: `Open work carried from a prior sprint${carryoverIssueKeys?.length ? `: ${carryoverIssueKeys.slice(0, 5).join(", ")}` : ""}.`,
      metric: "carryoverCount",
      value: carryoverCount,
    });
  }

  for (const issue of (blockedIssues || []).slice(0, 5)) {
    anomalies.push({
      id: `blocked-${issue.key}`,
      severity: "High",
      title: `${issue.key} — blocked${issue.ageDays != null ? ` for ${issue.ageDays} days` : ""}`,
      summary:
        issue.blockedLinksCount > 0
          ? `Blocked status/links detected; ${issue.blockedLinksCount} blocking relationship${issue.blockedLinksCount === 1 ? "" : "s"}.`
          : "Blocked status or label detected on an open issue.",
      issueKey: issue.key,
      metric: "blockedCount",
      value: 1,
    });
  }

  for (const issue of (staleIssues || []).slice(0, 3)) {
    anomalies.push({
      id: `stale-${issue.key}`,
      severity: "Review",
      title: `${issue.key} — stale work`,
      summary: `No update for ${issue.ageDays ?? "unknown"} days while still open.`,
      issueKey: issue.key,
      metric: "staleCount",
      value: 1,
    });
  }

  if (
    completionPercent != null &&
    completionPercent < 50 &&
    anomalies.every((item) => item.id !== "low-completion")
  ) {
    anomalies.push({
      id: "low-completion",
      severity: "Review",
      title: `Completion at ${completionPercent}%`,
      summary: "Less than half of sprint issues are Done.",
      metric: "completionPercent",
      value: completionPercent,
    });
  }

  const rank = { High: 0, Review: 1, Informational: 2 };
  return anomalies
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .slice(0, 8);
};

export const buildHealthSnapshot = ({
  context,
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

  const limitations = [];
  if (scope.capability.status === "unavailable") {
    limitations.push(scope.capability.reason);
  }
  if (carryover.capability.status === "unavailable") {
    limitations.push(carryover.capability.reason);
  }

  const health = calculateHealthScore({
    completionPercent: completion.completionPercent,
    scopeChangePercent: scope.scopeChangePercent,
    carryoverCount: carryover.carryoverCount ?? 0,
    blockedCount: blocked.blockedCount,
    staleCount: stale.staleCount,
  });

  const topAnomalies = buildTopAnomalies({
    scopeChangePercent: scope.scopeChangePercent,
    addedIssueCount: scope.addedIssueCount,
    carryoverCount: carryover.carryoverCount,
    carryoverIssueKeys: carryover.carryoverIssueKeys,
    blockedIssues: blocked.blockedIssues,
    staleIssues: stale.staleIssues,
    completionPercent: completion.completionPercent,
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
    addedIssueCount: scope.addedIssueCount,
    carryoverCount: carryover.carryoverCount,
    blockedCount: blocked.blockedCount,
    staleCount: stale.staleCount,
    doneCount: completion.doneCount,
    totalIssueCount: completion.totalCount,
    topAnomalies,
    scoreDeductions: health.deductions,
    capabilities: {
      scopeChange: scope.capability,
      carryover: carryover.capability,
    },
    limitations,
  };
};
