import api, { route } from "@forge/api";
import { MAX_CHANGELOG_ISSUES, MAX_SPRINT_ISSUES } from "../delivery-intelligence/constants.js";
import { failure, logDiag, logEvidence, STAGES } from "../delivery-intelligence/diagnostics.js";
import {
  extractSprintChanges,
  normalizeIssue,
} from "../delivery-intelligence/normalize.js";

const SPRINT_ISSUE_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "assignee",
  "priority",
  "created",
  "updated",
  "labels",
  "issuelinks",
].join(",");

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
  previousSprint: null,
  previousSprintContext: null,
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
  const beforeMs = beforeIso ? new Date(beforeIso).getTime() : Number.NaN;
  if (!boardId || Number.isNaN(beforeMs)) {
    return { ok: true, sprint: null };
  }

  let startAt = 0;
  let best = null;

  for (;;) {
    const response = await requestJira(
      route`/rest/agile/1.0/board/${boardId}/sprint?state=closed&startAt=${startAt}&maxResults=50`,
    );
    if (!response.ok) {
      logEvidence("previous-sprint-unavailable", {
        boardId,
        httpStatus: response.status,
      });
      return { ok: false, sprint: null, httpStatus: response.status };
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
      if (!best || endedMs > best.endedMs) {
        best = {
          id: row.id,
          name: row.name,
          endedMs,
          startDate: row.startDate || null,
          completeDate: row.completeDate || null,
          endDate: row.endDate || null,
          activatedDate: row.activatedDate || null,
        };
      }
    }

    if (payload.isLast === true || values.length === 0) {
      break;
    }
    startAt += values.length;
    if (startAt >= 200) {
      break;
    }
  }

  const sprint = best
    ? {
        id: best.id,
        name: best.name,
        startDate: best.startDate,
        completeDate: best.completeDate,
        endDate: best.endDate,
        activatedDate: best.activatedDate,
      }
    : null;
  logEvidence("previous-sprint", { boardId, previousSprint: sprint });
  return { ok: true, sprint };
};

export const fetchSprintIssues = async (sprintId, projectKey = null, boardId = null) => {
  const issues = [];
  let startAt = 0;
  const maxResults = 50;
  let truncated = false;

  while (issues.length < MAX_SPRINT_ISSUES) {
    const response = await requestJira(
      route`/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=${SPRINT_ISSUE_FIELDS}`,
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
    issues.push(...pageIssues.map(normalizeIssue));

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

  return { ok: true, issues, truncated, partial: false };
};

export const fetchIssueChangelog = async (issueKey) => {
  const changes = [];
  let startAt = 0;
  const maxResults = 100;

  for (;;) {
    const response = await requestJira(
      route`/rest/api/3/issue/${issueKey}/changelog?startAt=${startAt}&maxResults=${maxResults}`,
    );

    if (!response.ok) {
      return { ok: changes.length > 0, changes };
    }

    const payload = (await readJson(response)) ?? {};
    changes.push(...extractSprintChanges(payload));
    const values = Array.isArray(payload.values) ? payload.values : [];
    if (payload.isLast === true || values.length === 0) {
      break;
    }
    startAt += values.length;
    if (startAt >= 2000) {
      break;
    }
  }

  return { ok: true, changes };
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
  const slice = issues.slice(0, limit);
  let fetched = 0;

  if (slice.length === 0) {
    return {
      changelogsByKey,
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
      fetched += 1;
    }
  });

  return {
    changelogsByKey,
    fetched,
    requested: slice.length,
    capped: issues.length > limit,
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

  const issuesResult = await fetchSprintIssues(
    sprint.id,
    projectKey,
    selectedBoard.id,
  );
  if (!issuesResult.ok) {
    return issuesResult;
  }

  logDiag("sprint-issues", {
    stage: STAGES.FETCH_SPRINT_ISSUES,
    projectKey,
    boardId: selectedBoard.id,
    sprintId: sprint.id,
    issueCount: issuesResult.issues.length,
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
      fetched: 0,
      requested: Math.min(issuesResult.issues.length, MAX_CHANGELOG_ISSUES),
      capped: true,
    };
  }

  let previousSprint;
  let previousSprintContext = null;
  try {
    const previousResult = await fetchPreviousClosedSprint(
      selectedBoard.id,
      sprint.activatedDate || sprint.startDate,
    );
    previousSprint = previousResult.ok ? previousResult.sprint : null;
  } catch {
    previousSprint = null;
  }

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

  if (previousSprint?.id) {
    try {
      const previousDetail = await fetchSprintById(previousSprint.id);
      if (previousDetail.ok && previousDetail.sprint) {
        previousSprint = { ...previousSprint, ...previousDetail.sprint };
      }

      let previousPreviousSprint = null;
      try {
        const priorResult = await fetchPreviousClosedSprint(
          selectedBoard.id,
          previousSprint.activatedDate ||
            previousSprint.startDate ||
            previousSprint.completeDate,
        );
        previousPreviousSprint = priorResult.ok ? priorResult.sprint : null;
      } catch {
        previousPreviousSprint = null;
      }

      const previousIssuesResult = await fetchSprintIssues(
        previousSprint.id,
        projectKey,
        selectedBoard.id,
      );
      if (!previousIssuesResult.ok) {
        previousSprintContext = {
          issues: null,
          changelogsByKey: {},
          previousPreviousSprint,
          reason: "Previous sprint issues could not be loaded, so historical comparison is unavailable.",
        };
        limitations.push(previousSprintContext.reason);
      } else {
        let previousChangelogsByKey = {};
        let previousPartial = Boolean(
          previousIssuesResult.truncated || previousIssuesResult.partial,
        );
        if (previousPartial) {
          limitations.push(
            "Previous sprint issue list was truncated, so comparison may be incomplete.",
          );
        }
        try {
          const previousLogs = await fetchChangelogsForIssues(previousIssuesResult.issues);
          previousChangelogsByKey = previousLogs.changelogsByKey;
          if (previousLogs.capped || previousLogs.fetched < previousLogs.requested) {
            previousPartial = true;
            limitations.push(
              `Previous sprint changelog history fetched for ${previousLogs.fetched} of ${previousLogs.requested} sampled issues.`,
            );
          }
        } catch {
          previousPartial = true;
          limitations.push(
            "Previous sprint changelog history was not available, so some comparison metrics are incomplete.",
          );
        }

        logDiag("previous-sprint-loaded", {
          stage: STAGES.FETCH_PREVIOUS_SPRINT,
          projectKey,
          boardId: selectedBoard.id,
          sprintId: previousSprint.id,
          issueCount: previousIssuesResult.issues.length,
        });

        previousSprintContext = {
          issues: previousIssuesResult.issues,
          changelogsByKey: previousChangelogsByKey,
          previousPreviousSprint,
          partial: previousPartial,
        };
      }
    } catch {
      previousSprintContext = {
        issues: null,
        changelogsByKey: {},
        previousPreviousSprint: null,
        reason: "Previous sprint data could not be loaded, so historical comparison is unavailable.",
      };
      limitations.push(previousSprintContext.reason);
    }
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
    previousSprint,
    previousSprintContext,
    limitations,
  };
};
