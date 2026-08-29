import { buildHealthSnapshot } from "../delivery-intelligence/analyze.js";
import { failure, logDiag, STAGES } from "../delivery-intelligence/diagnostics.js";
import { resolveProjectKey } from "../delivery-intelligence/project-context.js";
import { loadDeliveryContext } from "../jira/agile-client.js";

export { resolveProjectKey };

export const buildSnapshotForProject = async ({
  projectKey,
  boardId = null,
  now = new Date(),
}) => {
  const loaded = await loadDeliveryContext({ projectKey, boardId });
  if (!loaded.ok) {
    return loaded;
  }

  if (!loaded.sprint) {
    return {
      ok: true,
      snapshot: {
        version: "0.1",
        generatedAt: now.toISOString(),
        context: loaded.context,
        sprint: null,
        healthScore: null,
        healthMax: 100,
        healthStatus: null,
        completionPercent: null,
        scopeChangePercent: null,
        addedIssueCount: null,
        carryoverCount: null,
        blockedCount: null,
        staleCount: null,
        topAnomalies: [],
        limitations: loaded.limitations,
      },
    };
  }

  try {
    const snapshot = buildHealthSnapshot({
      context: loaded.context,
      sprint: loaded.sprint,
      issues: loaded.issues,
      changelogsByKey: loaded.changelogsByKey,
      previousSprint: loaded.previousSprint,
      now,
    });

    logDiag("scope-classified", {
      stage: STAGES.BUILD_SNAPSHOT,
      projectKey,
      boardId: loaded.context?.boardId ?? boardId,
      sprintId: loaded.sprint?.id,
      issueCount: snapshot.currentIssueCount,
      startDate: loaded.sprint?.startDate,
      activatedDate: loaded.sprint?.activatedDate,
      commitmentAt: loaded.sprint?.activatedDate || loaded.sprint?.startDate,
      originalCommittedCount: snapshot.originalCommittedCount,
      addedIssueCount: snapshot.addedIssueCount,
      carryoverCount: snapshot.carryoverCount,
      source: snapshot.capabilities?.scopeChange?.source || null,
    });

    return {
      ok: true,
      snapshot: {
        ...snapshot,
        limitations: [...(snapshot.limitations || []), ...(loaded.limitations || [])],
      },
    };
  } catch {
    return failure({
      error: "unavailable",
      stage: STAGES.BUILD_SNAPSHOT,
      projectKey,
      boardId: loaded.context?.boardId ?? boardId,
      message: `Could not build the sprint health snapshot for project ${projectKey}.`,
    });
  }
};

export const registerDeliveryResolvers = (resolver) => {
  resolver.define("getDeliveryHealth", async ({ payload, context }) => {
    const resolved = resolveProjectKey(payload, context);
    if (!resolved.projectKey) {
      return failure({
        error: "missing-project",
        stage: STAGES.RESOLVE_PROJECT,
        message:
          "Open Delivery Intelligence from a Jira Software project to load sprint context.",
      });
    }

    logDiag("resolved-project", {
      stage: STAGES.RESOLVE_PROJECT,
      projectKey: resolved.projectKey,
      source: resolved.source,
    });

    try {
      return await buildSnapshotForProject({
        projectKey: resolved.projectKey,
        boardId: payload?.boardId || null,
      });
    } catch {
      return failure({
        error: "unavailable",
        stage: STAGES.BUILD_SNAPSHOT,
        projectKey: resolved.projectKey,
        message: `Could not analyze the sprint for project ${resolved.projectKey}.`,
      });
    }
  });
};
