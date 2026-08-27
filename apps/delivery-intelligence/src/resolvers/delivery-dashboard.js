import { buildHealthSnapshot } from "../delivery-intelligence/analyze.js";
import { loadDeliveryContext } from "../jira/agile-client.js";

const resolveProjectKey = (payload, context) => {
  const fromPayload =
    typeof payload?.projectKey === "string" ? payload.projectKey.trim() : "";
  if (fromPayload) {
    return fromPayload.toUpperCase();
  }

  const extension = context?.extension || {};
  const fromContext =
    extension.project?.key ||
    extension.projectKey ||
    context?.project?.key ||
    null;

  return typeof fromContext === "string" ? fromContext.toUpperCase() : null;
};

export const buildSnapshotForProject = async ({
  projectKey,
  boardId = null,
  now = new Date(),
}) => {
  const loaded = await loadDeliveryContext({ projectKey, boardId });
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
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

  const snapshot = buildHealthSnapshot({
    context: loaded.context,
    sprint: loaded.sprint,
    issues: loaded.issues,
    changelogsByKey: loaded.changelogsByKey,
    now,
  });

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      limitations: [...(snapshot.limitations || []), ...(loaded.limitations || [])],
    },
  };
};

export const registerDeliveryResolvers = (resolver) => {
  resolver.define("getDeliveryHealth", async ({ payload, context }) => {
    const projectKey = resolveProjectKey(payload, context);
    if (!projectKey) {
      return { ok: false, error: "missing-project" };
    }

    try {
      const result = await buildSnapshotForProject({
        projectKey,
        boardId: payload?.boardId || null,
      });
      return result;
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });
};
