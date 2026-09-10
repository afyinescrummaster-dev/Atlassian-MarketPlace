import { buildSnapshotForProject } from "./delivery-dashboard.js";
import { loadDeliveryContext } from "../jira/agile-client.js";
import { computeScopeChange, computeCarryover } from "../delivery-intelligence/metrics.js";
import { commitmentTimestamp } from "../delivery-intelligence/membership.js";

const readProjectKey = (payload) => {
  const direct =
    payload?.projectKey ||
    payload?.context?.jira?.projectKey ||
    payload?.context?.extension?.project?.key;
  return typeof direct === "string" ? direct.toUpperCase() : null;
};

const compactAnomaly = (item) => ({
  id: item.id,
  severity: item.severity,
  title: item.title,
  explanation: item.explanation || item.summary || "",
  affectedIssueCount: item.affectedIssueCount ?? null,
  issueKey: item.issueKey || null,
  suggestedAction: item.suggestedAction || null,
});

const compactSnapshot = (snapshot) => {
  if (!snapshot) {
    return null;
  }
  return {
    generatedAt: snapshot.generatedAt,
    context: snapshot.context,
    sprint: snapshot.sprint
      ? {
          id: snapshot.sprint.id,
          name: snapshot.sprint.name,
          startDate: snapshot.sprint.startDate,
          endDate: snapshot.sprint.endDate,
        }
      : null,
    healthScore: snapshot.healthScore,
    healthStatus: snapshot.healthStatus,
    completionPercent: snapshot.completionPercent,
    scopeChangePercent: snapshot.scopeChangePercent,
    originalCommittedCount: snapshot.originalCommittedCount,
    currentIssueCount: snapshot.currentIssueCount,
    addedIssueCount: snapshot.addedIssueCount,
    originalCommittedIssueKeys: (snapshot.originalCommittedIssueKeys || []).slice(0, 20),
    addedIssueKeys: (snapshot.addedIssueKeys || []).slice(0, 20),
    carryoverCount: snapshot.carryoverCount,
    carryoverIssueKeys: (snapshot.carryoverIssueKeys || []).slice(0, 20),
    blockedCount: snapshot.blockedCount,
    blockedIssueKeys: (snapshot.blockedIssues || []).slice(0, 10).map((row) => row.key),
    staleCount: snapshot.staleCount,
    staleIssueKeys: (snapshot.staleIssues || []).slice(0, 10).map((row) => row.key),
    topAnomalies: (snapshot.topAnomalies || []).slice(0, 5).map(compactAnomaly),
    previousSprint: snapshot.previousSprint,
    previousSprintMetrics: snapshot.previousSprintMetrics,
    metricDeltas: snapshot.metricDeltas,
    comparison: snapshot.comparison
      ? {
          capability: snapshot.comparison.capability,
          previousSprint: snapshot.comparison.previousSprint,
        }
      : null,
    capabilities: snapshot.capabilities,
    limitations: snapshot.limitations,
  };
};

export const getSprintHealthSnapshot = async (payload) => {
  const projectKey = readProjectKey(payload);
  if (!projectKey) {
    return {
      error: "projectKey is required to compute sprint health.",
    };
  }

  const result = await buildSnapshotForProject({
    projectKey,
    boardId: payload?.boardId || null,
  });

  if (!result.ok) {
    return { error: result.error || "unavailable" };
  }

  return compactSnapshot(result.snapshot);
};

export const getIssueDeliveryContext = async (payload) => {
  const projectKey = readProjectKey(payload);
  const issueKey =
    payload?.issueKey || payload?.context?.jira?.issueKey || null;

  if (!projectKey) {
    return { error: "projectKey is required." };
  }

  const loaded = await loadDeliveryContext({ projectKey });
  if (!loaded.ok) {
    return { error: loaded.error || "unavailable" };
  }

  const issue = loaded.issues.find((row) => row.key === issueKey) || null;
  if (!issue) {
    return {
      projectKey,
      sprint: loaded.sprint,
      issue: null,
      note: issueKey
        ? "Issue not found in the active sprint snapshot."
        : "No issueKey supplied; returning sprint summary only.",
      sprintIssueCount: loaded.issues.length,
    };
  }

  return {
    projectKey,
    sprint: loaded.sprint,
    issue,
    sprintIssueCount: loaded.issues.length,
  };
};

export const getScopeChanges = async (payload) => {
  const projectKey = readProjectKey(payload);
  if (!projectKey) {
    return { error: "projectKey is required." };
  }

  const loaded = await loadDeliveryContext({ projectKey });
  if (!loaded.ok) {
    return { error: loaded.error || "unavailable" };
  }
  if (!loaded.sprint) {
    return { error: "No active sprint available." };
  }

  const scope = computeScopeChange({
    issues: loaded.issues,
    sprintStart: commitmentTimestamp(loaded.sprint),
    sprintName: loaded.sprint.name,
    sprintId: loaded.sprint.id,
    changelogsByKey: loaded.changelogsByKey,
  });

  return {
    projectKey,
    sprint: { id: loaded.sprint.id, name: loaded.sprint.name },
    originalCommittedCount: scope.originalCommittedCount,
    currentIssueCount: scope.currentIssueCount,
    addedIssueCount: scope.addedIssueCount,
    scopeChangePercent: scope.scopeChangePercent,
    originalCommittedIssueKeys: (scope.originalCommittedIssueKeys || []).slice(0, 20),
    addedIssueKeys: (scope.addedIssueKeys || []).slice(0, 20),
    capability: scope.capability,
  };
};

export const getCarryoverHistory = async (payload) => {
  const projectKey = readProjectKey(payload);
  if (!projectKey) {
    return { error: "projectKey is required." };
  }

  const loaded = await loadDeliveryContext({ projectKey });
  if (!loaded.ok) {
    return { error: loaded.error || "unavailable" };
  }
  if (!loaded.sprint) {
    return { error: "No active sprint available." };
  }

  const carryover = computeCarryover({
    issues: loaded.issues,
    sprintStart: commitmentTimestamp(loaded.sprint),
    sprintName: loaded.sprint.name,
    sprintId: loaded.sprint.id,
    changelogsByKey: loaded.changelogsByKey,
    previousSprint: loaded.previousSprint,
  });

  return {
    projectKey,
    sprint: { id: loaded.sprint.id, name: loaded.sprint.name },
    carryoverCount: carryover.carryoverCount,
    carryoverIssueKeys: carryover.carryoverIssueKeys,
    capability: carryover.capability,
  };
};
