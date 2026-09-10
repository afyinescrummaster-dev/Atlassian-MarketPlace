import api, { route } from "@forge/api";
import { MAX_CHANGELOG_ISSUES, MAX_SPRINT_ISSUES, CAPABILITY_STATUS } from "../delivery-intelligence/constants.js";
import { failure, logDiag, logEvidence, STAGES } from "../delivery-intelligence/diagnostics.js";
import {
  extractSprintChanges,
  extractStatusChanges,
  normalizeIssue,
} from "../delivery-intelligence/normalize.js";

const BASE_SPRINT_ISSUE_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "assignee",
  "priority",
  "created",
  "updated",
  "labels",
  "issuelinks",
  "description",
  "parent",
];

const CHANGELOG_CONCURRENCY = 5;

const permissionStatus = (status) =>
  status === 401 || status === 403 || status === 404;

const readJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const requestJira = async (path, options = {}) => {
  const { headers, ...rest } = options;
  return api.asUser().requestJira(path, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...headers,
    },
  });
};

const emptyContext = (projectKey, limitations, board = null) => ({
  ok: true,
  context: {
    projectKey,
    boardId: board?.id ?? null,
    boardName: board?.name ?? null,
  },
  sprint: null,
  issues: [],
  changelogsByKey: {},
  statusHistoriesByKey: {},
  estimation: {
    usable: false,
    fieldId: null,
    fieldName: null,
    estimatedIssueCount: 0,
    coverage: 0,
    capability: {
      status: CAPABILITY_STATUS.UNAVAILABLE,
      reason: "No active sprint context was available.",
    },
  },
  previousSprint: null,
  previousSprintContext: null,
  historicalSprintContexts: [],
  limitations,
});

export const fetchBoardsForProject = async (projectKey) => {
  const response = await requestJira(
    route`/rest/agile/1.0/board?projectKeyOrId=${projectKey}`,
  );

  if (permissionStatus(response.status)) {
    return failure({
      error: "permission",
      stage: STAGES.FETCH_BOARDS,
      httpStatus: response.status,
      projectKey,
      message: `Could not load Jira Software boards for project ${projectKey}.`,
    });
  }

  // Business/JSM projects often return 400 from the Software board API.
  if (response.status === 400) {
    logDiag("boards-empty", {
      stage: STAGES.FETCH_BOARDS,
      httpStatus: 400,
      projectKey,
      boardCount: 0,
    });
    return { ok: true, boards: [] };
  }

  if (!response.ok) {
    return failure({
      error: "unavailable",
      stage: STAGES.FETCH_BOARDS,
      httpStatus: response.status,
      projectKey,
      message: `Could not load Jira Software boards for project ${projectKey}.`,
    });
  }

  const payload = (await readJson(response)) ?? {};
  const values = Array.isArray(payload.values) ? payload.values : [];
  return {
    ok: true,
    boards: values.map((board) => ({
      id: board.id,
      name: board.name,
      type: board.type,
    })),
  };
};

export const fetchBoardEstimationField = async (boardId) => {
  if (!boardId) {
    return {
      ok: false,
      fieldId: null,
      fieldName: null,
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason: "Board id was not available for estimation configuration.",
      },
    };
  }

  try {
    const response = await requestJira(
      route`/rest/agile/1.0/board/${boardId}/configuration`,
    );
    if (!response.ok) {
      return {
        ok: false,
        fieldId: null,
        fieldName: null,
        capability: {
          status: CAPABILITY_STATUS.UNAVAILABLE,
          reason: "Board estimation configuration could not be loaded.",
        },
      };
    }
    const payload = (await readJson(response)) ?? {};
    const fieldId = payload?.estimation?.field?.fieldId || null;
    const fieldName =
      payload?.estimation?.field?.displayName ||
      payload?.estimation?.field?.fieldName ||
      null;
    if (!fieldId) {
      return {
        ok: true,
        fieldId: null,
        fieldName: null,
        capability: {
          status: CAPABILITY_STATUS.UNAVAILABLE,
          reason: "This board does not have an estimation field configured.",
        },
      };
    }
    return {
      ok: true,
      fieldId,
      fieldName,
      capability: {
        status: CAPABILITY_STATUS.AVAILABLE,
        reason: `Board estimation field ${fieldName || fieldId} is configured.`,
      },
    };
  } catch {
    return {
      ok: false,
      fieldId: null,
      fieldName: null,
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason: "Board estimation configuration could not be loaded.",
      },
    };
  }
};

export const buildEstimationModel = ({ fieldId, fieldName, capability, issues = [] }) => {
  if (!fieldId) {
    return {
      usable: false,
      fieldId: null,
      fieldName: fieldName || null,
      estimatedIssueCount: 0,
      coverage: 0,
      capability: capability || {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason: "Board estimation field is not configured.",
      },
    };
  }

  const estimatedIssueCount = (issues || []).filter(
    (issue) => typeof issue?.estimate === "number" && Number.isFinite(issue.estimate),
  ).length;
  const coverage = issues.length ? estimatedIssueCount / issues.length : 0;
  const usable = estimatedIssueCount > 0;
  return {
    usable,
    fieldId,
    fieldName: fieldName || null,
    estimatedIssueCount,
    coverage,
    capability: {
      status: usable
        ? coverage >= 0.5
          ? CAPABILITY_STATUS.AVAILABLE
          : CAPABILITY_STATUS.PARTIAL
        : CAPABILITY_STATUS.PARTIAL,
      reason: usable
        ? `Estimates present on ${estimatedIssueCount} of ${issues.length} sprint issues.`
        : `Estimation field ${fieldName || fieldId} is configured, but no issue estimates were returned.`,
    },
  };
};

export const fetchActiveSprint = async (boardId, projectKey = null) => {
  const response = await requestJira(
    route`/rest/agile/1.0/board/${boardId}/sprint?state=active`,
  );

  if (permissionStatus(response.status)) {
    return failure({
      error: "permission",
      stage: STAGES.FETCH_ACTIVE_SPRINT,
      httpStatus: response.status,
      projectKey,
      boardId,
      message: `Could not load the active sprint for board ${boardId}.`,
    });
  }
  if (response.status === 400) {
    return { ok: true, sprint: null };
  }
  if (!response.ok) {
    return failure({
      error: "unavailable",
      stage: STAGES.FETCH_ACTIVE_SPRINT,
      httpStatus: response.status,
      projectKey,
      boardId,
      message: `Could not load the active sprint for board ${boardId}.`,
    });
  }

  const payload = (await readJson(response)) ?? {};
  const values = Array.isArray(payload.values) ? payload.values : [];
  const sprint = values[0] || null;
  if (!sprint) {
    return { ok: true, sprint: null };
  }

  return {
    ok: true,
    sprint: {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate || null,
      endDate: sprint.endDate || null,
      activatedDate: sprint.activatedDate || null,
      goal: sprint.goal || null,
    },
  };
};

export const fetchSprintById = async (sprintId) => {
  const response = await requestJira(route`/rest/agile/1.0/sprint/${sprintId}`);

  if (permissionStatus(response.status) || !response.ok) {
    return { ok: false, sprint: null, httpStatus: response.status };
  }

  const sprint = (await readJson(response)) ?? {};
  const dateFields = {};
  for (const [key, value] of Object.entries(sprint)) {
    if (/date/i.test(key) || key === "state" || key === "id" || key === "name") {
      dateFields[key] = value ?? null;
    }
  }
  logEvidence("sprint-detail", { sprintId, httpStatus: response.status, fields: dateFields });
  return {
    ok: true,
    sprint: {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate || null,
      endDate: sprint.endDate || null,
      activatedDate: sprint.activatedDate || null,
      goal: sprint.goal || null,
    },
    httpStatus: response.status,
  };
};

export const fetchPreviousClosedSprint = async (boardId, beforeIso) => {
  const result = await fetchRecentlyClosedSprints(boardId, beforeIso, 1);
  return {
    ok: result.ok,
    sprint: result.sprints?.[0] || null,
    httpStatus: result.httpStatus,
  };
};

export const fetchRecentlyClosedSprints = async (boardId, beforeIso, limit = 3) => {
  const beforeMs = beforeIso ? new Date(beforeIso).getTime() : Number.NaN;
  if (!boardId || Number.isNaN(beforeMs) || limit <= 0) {
    return { ok: true, sprints: [] };
  }

  let startAt = 0;
  const candidates = [];

  for (;;) {
    const response = await requestJira(
      route`/rest/agile/1.0/board/${boardId}/sprint?state=closed&startAt=${startAt}&maxResults=50`,
    );
    if (!response.ok) {
      logEvidence("previous-sprint-unavailable", {
        boardId,
        httpStatus: response.status,
      });
      return { ok: false, sprints: [], httpStatus: response.status };
    }

    const payload = (await readJson(response)) ?? {};
    const values = Array.isArray(payload.values) ? payload.values : [];
    for (const row of values) {
      const ended = row.completeDate || row.endDate;
      if (!ended) {
        continue;
      }
      const endedMs = new Date(ended).getTime();
      if (Number.isNaN(endedMs) || endedMs > beforeMs) {
        continue;
      }
      candidates.push({
        id: row.id,
        name: row.name,
        endedMs,
        startDate: row.startDate || null,
        completeDate: row.completeDate || null,
        endDate: row.endDate || null,
        activatedDate: row.activatedDate || null,
        goal: row.goal || null,
      });
    }

    if (payload.isLast === true || values.length === 0) {
      break;
    }
    startAt += values.length;
    if (startAt >= 200) {
      break;
    }
  }

  candidates.sort((a, b) => b.endedMs - a.endedMs);
  const sprints = candidates.slice(0, limit).map((best) => ({
    id: best.id,
    name: best.name,
    startDate: best.startDate,
    completeDate: best.completeDate,
    endDate: best.endDate,
    activatedDate: best.activatedDate,
    goal: best.goal || null,
  }));
  logEvidence("previous-sprints", { boardId, count: sprints.length, sprints });
  return { ok: true, sprints };
};

export const fetchSprintIssues = async (
  sprintId,
  projectKey = null,
  boardId = null,
  options = {},
) => {
  const issues = [];
  let startAt = 0;
  const maxResults = 50;
  let truncated = false;
  const estimateFieldId = options.estimateFieldId || null;
  const fieldList = [...BASE_SPRINT_ISSUE_FIELDS];
  if (estimateFieldId && !fieldList.includes(estimateFieldId)) {
    fieldList.push(estimateFieldId);
  }
  const fieldsQuery = fieldList.join(",");

  while (issues.length < MAX_SPRINT_ISSUES) {
    const response = await requestJira(
      route`/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=${fieldsQuery}`,
    );

    if (permissionStatus(response.status)) {
      return issues.length
        ? { ok: true, issues, truncated: true, partial: true }
        : failure({
            error: "permission",
            stage: STAGES.FETCH_SPRINT_ISSUES,
            httpStatus: response.status,
            projectKey,
            boardId,
            message: `Could not load sprint issues for sprint ${sprintId}.`,
          });
    }
    if (!response.ok) {
      return issues.length
        ? { ok: true, issues, truncated: true, partial: true }
        : failure({
            error: "unavailable",
            stage: STAGES.FETCH_SPRINT_ISSUES,
            httpStatus: response.status,
            projectKey,
            boardId,
            message: `Could not load sprint issues for sprint ${sprintId}.`,
          });
    }

    const payload = (await readJson(response)) ?? {};
    const pageIssues = Array.isArray(payload.issues) ? payload.issues : [];
    issues.push(
      ...pageIssues.map((issue) => normalizeIssue(issue, { estimateFieldId })),
    );

    if (payload.isLast === true || pageIssues.length === 0) {
      truncated = false;
      break;
    }

    startAt += pageIssues.length;
    if (issues.length >= MAX_SPRINT_ISSUES) {
      truncated = true;
      break;
    }
  }

  const sprintKeys = new Set(issues.map((issue) => issue.key).filter(Boolean));
  for (const issue of issues) {
    for (const link of issue.dependencyLinks || []) {
      link.relatedInSprint = sprintKeys.has(link.relatedKey);
    }
  }

  return { ok: true, issues, truncated, partial: false };
};

export const fetchIssueChangelog = async (issueKey) => {
  const sprintChanges = [];
  const statusChanges = [];
  let startAt = 0;
  const maxResults = 100;

  for (;;) {
    const response = await requestJira(
      route`/rest/api/3/issue/${issueKey}/changelog?startAt=${startAt}&maxResults=${maxResults}`,
    );

    if (!response.ok) {
      return {
        ok: sprintChanges.length > 0 || statusChanges.length > 0,
        changes: sprintChanges,
        statusChanges,
      };
    }

    const payload = (await readJson(response)) ?? {};
    sprintChanges.push(...extractSprintChanges(payload));
    statusChanges.push(...extractStatusChanges(payload));
    const values = Array.isArray(payload.values) ? payload.values : [];
    if (payload.isLast === true || values.length === 0) {
      break;
    }
    startAt += values.length;
    if (startAt >= 2000) {
      break;
    }
  }

  return { ok: true, changes: sprintChanges, statusChanges };
};

const mapPool = async (items, concurrency, mapper) => {
  const results = new Array(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
};

export const fetchChangelogsForIssues = async (issues, limit = MAX_CHANGELOG_ISSUES) => {
  const changelogsByKey = {};
  const statusHistoriesByKey = {};
  const slice = issues.slice(0, limit);
  let fetched = 0;

  if (slice.length === 0) {
    return {
      changelogsByKey,
      statusHistoriesByKey,
      fetched,
      requested: 0,
      capped: issues.length > limit,
    };
  }

  await mapPool(slice, CHANGELOG_CONCURRENCY, async (issue) => {
    if (!issue.key) {
      return;
    }
    const result = await fetchIssueChangelog(issue.key);
    if (result.ok) {
      changelogsByKey[issue.key] = result.changes;
      statusHistoriesByKey[issue.key] = result.statusChanges || [];
      fetched += 1;
    }
  });

  return {
    changelogsByKey,
    statusHistoriesByKey,
    fetched,
    requested: slice.length,
    capped: issues.length > limit,
  };
};

const loadClosedSprintContext = async ({
  boardId,
  projectKey,
  closedSprint,
  estimateFieldId,
  previousPreviousSprint = null,
}) => {
  let sprint = closedSprint;
  try {
    const detail = await fetchSprintById(closedSprint.id);
    if (detail.ok && detail.sprint) {
      sprint = { ...closedSprint, ...detail.sprint };
    }
  } catch {
    // keep list metadata
  }

  const issuesResult = await fetchSprintIssues(sprint.id, projectKey, boardId, {
    estimateFieldId,
  });
  if (!issuesResult.ok) {
    return {
      sprint,
      issues: null,
      changelogsByKey: {},
      statusHistoriesByKey: {},
      previousPreviousSprint,
      partial: true,
      reason: "Previous sprint issues could not be loaded.",
    };
  }

  let changelogsByKey = {};
  let statusHistoriesByKey = {};
  let partial = Boolean(issuesResult.truncated || issuesResult.partial);
  try {
    const logs = await fetchChangelogsForIssues(issuesResult.issues);
    changelogsByKey = logs.changelogsByKey;
    statusHistoriesByKey = logs.statusHistoriesByKey;
    if (logs.capped || logs.fetched < logs.requested) {
      partial = true;
    }
  } catch {
    partial = true;
  }

  return {
    sprint,
    issues: issuesResult.issues,
    changelogsByKey,
    statusHistoriesByKey,
    previousPreviousSprint,
    partial,
    reason: null,
  };
};

export const loadDeliveryContext = async ({ projectKey, boardId = null }) => {
  const boardsResult = await fetchBoardsForProject(projectKey);
  if (!boardsResult.ok) {
    return boardsResult;
  }

  const boards = boardsResult.boards;
  const selectedBoard =
    boards.find((board) => String(board.id) === String(boardId)) ||
    boards[0] ||
    null;

  logDiag("boards-selected", {
    stage: STAGES.FETCH_BOARDS,
    projectKey,
    boardCount: boards.length,
    boardId: selectedBoard?.id ?? null,
    boardName: selectedBoard?.name || null,
    boardType: selectedBoard?.type || null,
  });

  if (!selectedBoard) {
    return emptyContext(projectKey, [
      "No Jira Software board was found for this project. Sprint metrics require a board-backed Software project with an active sprint.",
    ]);
  }

  const sprintResult = await fetchActiveSprint(selectedBoard.id, projectKey);
  if (!sprintResult.ok) {
    return sprintResult;
  }

  if (!sprintResult.sprint) {
    return emptyContext(
      projectKey,
      ["No active sprint was found on the selected board."],
      selectedBoard,
    );
  }

  const sprintDetail = await fetchSprintById(sprintResult.sprint.id);
  const sprint = sprintDetail.ok && sprintDetail.sprint
    ? { ...sprintResult.sprint, ...sprintDetail.sprint }
    : sprintResult.sprint;

  logDiag("sprint-selected", {
    stage: STAGES.FETCH_ACTIVE_SPRINT,
    projectKey,
    boardId: selectedBoard.id,
    sprintId: sprint.id,
    startDate: sprint.startDate,
    activatedDate: sprint.activatedDate,
    commitmentAt: sprint.activatedDate || sprint.startDate,
  });

  const estimationConfig = await fetchBoardEstimationField(selectedBoard.id);

  const issuesResult = await fetchSprintIssues(
    sprint.id,
    projectKey,
    selectedBoard.id,
    { estimateFieldId: estimationConfig.fieldId },
  );
  if (!issuesResult.ok) {
    return issuesResult;
  }

  const estimation = buildEstimationModel({
    fieldId: estimationConfig.fieldId,
    fieldName: estimationConfig.fieldName,
    capability: estimationConfig.capability,
    issues: issuesResult.issues,
  });

  logDiag("sprint-issues", {
    stage: STAGES.FETCH_SPRINT_ISSUES,
    projectKey,
    boardId: selectedBoard.id,
    sprintId: sprint.id,
    issueCount: issuesResult.issues.length,
    estimationFieldId: estimation.fieldId,
  });

  let changelogResult;
  try {
    changelogResult = await fetchChangelogsForIssues(issuesResult.issues);
    logDiag("changelog-fetched", {
      stage: STAGES.FETCH_CHANGELOG,
      projectKey,
      boardId: selectedBoard.id,
      issueCount: changelogResult.fetched,
    });
  } catch {
    logDiag("changelog-failed", {
      stage: STAGES.FETCH_CHANGELOG,
      error: "unavailable",
      projectKey,
      boardId: selectedBoard.id,
    });
    changelogResult = {
      changelogsByKey: {},
      statusHistoriesByKey: {},
      fetched: 0,
      requested: Math.min(issuesResult.issues.length, MAX_CHANGELOG_ISSUES),
      capped: true,
    };
  }

  let previousSprint = null;
  let previousSprintContext = null;
  let historicalSprintContexts = [];
  const limitations = [];

  if (issuesResult.truncated) {
    limitations.push(
      `Sprint issue list truncated at ${MAX_SPRINT_ISSUES} issues.`,
    );
  }
  if (changelogResult.capped || changelogResult.fetched < changelogResult.requested) {
    limitations.push(
      `Sprint changelog history fetched for ${changelogResult.fetched} of ${changelogResult.requested} sampled issues.`,
    );
  }
  if (estimation.capability.status !== CAPABILITY_STATUS.AVAILABLE) {
    limitations.push(estimation.capability.reason);
  }

  try {
    const closedResult = await fetchRecentlyClosedSprints(
      selectedBoard.id,
      sprint.activatedDate || sprint.startDate,
      3,
    );
    const closedSprints = closedResult.ok ? closedResult.sprints : [];
    previousSprint = closedSprints[0] || null;

    if (closedSprints.length) {
      const contexts = [];
      for (let index = 0; index < closedSprints.length; index += 1) {
        const closed = closedSprints[index];
        const prior = closedSprints[index + 1] || null;
        const loaded = await loadClosedSprintContext({
          boardId: selectedBoard.id,
          projectKey,
          closedSprint: closed,
          estimateFieldId: estimationConfig.fieldId,
          previousPreviousSprint: prior,
        });
        contexts.push(loaded);
        if (loaded.reason) {
          limitations.push(`${closed.name}: ${loaded.reason}`);
        } else if (loaded.partial) {
          limitations.push(
            `${closed.name}: historical sprint data is partial.`,
          );
        }
      }
      historicalSprintContexts = contexts;
      previousSprintContext = contexts[0]
        ? {
            issues: contexts[0].issues,
            changelogsByKey: contexts[0].changelogsByKey,
            statusHistoriesByKey: contexts[0].statusHistoriesByKey,
            previousPreviousSprint: contexts[0].previousPreviousSprint,
            partial: contexts[0].partial,
            reason: contexts[0].reason,
          }
        : null;

      if (previousSprintContext?.issues) {
        logDiag("previous-sprint-loaded", {
          stage: STAGES.FETCH_PREVIOUS_SPRINT,
          projectKey,
          boardId: selectedBoard.id,
          sprintId: previousSprint?.id,
          issueCount: previousSprintContext.issues.length,
          historicalCount: historicalSprintContexts.length,
        });
      }
    }
  } catch {
    previousSprint = null;
    previousSprintContext = {
      issues: null,
      changelogsByKey: {},
      statusHistoriesByKey: {},
      previousPreviousSprint: null,
      reason: "Previous sprint data could not be loaded, so historical comparison is unavailable.",
    };
    limitations.push(previousSprintContext.reason);
  }

  return {
    ok: true,
    context: {
      projectKey,
      boardId: selectedBoard.id,
      boardName: selectedBoard.name,
    },
    sprint,
    issues: issuesResult.issues,
    changelogsByKey: changelogResult.changelogsByKey,
    statusHistoriesByKey: changelogResult.statusHistoriesByKey,
    estimation,
    previousSprint,
    previousSprintContext,
    historicalSprintContexts,
    limitations,
  };
};
