import api, { route } from "@forge/api";
import { MAX_CHANGELOG_ISSUES, MAX_SPRINT_ISSUES } from "../delivery-intelligence/constants.js";
import {
  extractSprintChanges,
  normalizeIssue,
} from "../delivery-intelligence/normalize.js";

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

export const fetchProject = async (projectKey) => {
  const response = await requestJira(route`/rest/api/3/project/${projectKey}`);
  if (permissionStatus(response.status)) {
    return { ok: false, error: "permission", status: response.status };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: response.status === 404 ? "project-not-found" : "unavailable",
      status: response.status,
    };
  }
  const project = (await readJson(response)) ?? {};
  return {
    ok: true,
    project: {
      key: project.key || projectKey,
      name: project.name || projectKey,
      type: project.projectTypeKey || null,
    },
  };
};

export const fetchBoardsForProject = async (projectKey) => {
  const response = await requestJira(
    route`/rest/agile/1.0/board?projectKeyOrId=${projectKey}`,
  );

  if (permissionStatus(response.status)) {
    return { ok: false, error: "permission", status: response.status };
  }
  if (!response.ok) {
    return { ok: false, error: "unavailable", status: response.status };
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

export const fetchActiveSprint = async (boardId) => {
  const response = await requestJira(
    route`/rest/agile/1.0/board/${boardId}/sprint?state=active`,
  );

  // Kanban / non-scrum boards often return 400 for sprint endpoints.
  if (response.status === 400) {
    return { ok: true, sprint: null, unsupported: true };
  }

  if (permissionStatus(response.status)) {
    return { ok: false, error: "permission", status: response.status };
  }
  if (!response.ok) {
    return { ok: false, error: "unavailable", status: response.status };
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
      goal: sprint.goal || null,
    },
  };
};

export const fetchSprintIssues = async (sprintId) => {
  const issues = [];
  let startAt = 0;
  const maxResults = 50;
  let truncated = false;

  while (issues.length < MAX_SPRINT_ISSUES) {
    const response = await requestJira(
      route`/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${maxResults}`,
    );

    if (permissionStatus(response.status)) {
      return issues.length
        ? { ok: true, issues, truncated: true, partial: true }
        : { ok: false, error: "permission", status: response.status };
    }
    if (!response.ok) {
      return issues.length
        ? { ok: true, issues, truncated: true, partial: true }
        : { ok: false, error: "unavailable", status: response.status };
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
  const response = await requestJira(
    route`/rest/api/3/issue/${issueKey}/changelog?maxResults=100`,
  );

  if (!response.ok) {
    return { ok: false, changes: [] };
  }

  const payload = (await readJson(response)) ?? {};
  return { ok: true, changes: extractSprintChanges(payload) };
};

export const fetchChangelogsForIssues = async (
  issues,
  limit = MAX_CHANGELOG_ISSUES,
) => {
  const changelogsByKey = {};
  const slice = issues.slice(0, limit);

  for (const issue of slice) {
    if (!issue.key) {
      continue;
    }
    const result = await fetchIssueChangelog(issue.key);
    if (result.ok) {
      changelogsByKey[issue.key] = result.changes;
    }
  }

  return {
    changelogsByKey,
    fetched: Object.keys(changelogsByKey).length,
    requested: slice.length,
    capped: issues.length > limit,
  };
};

const pickBoardOrder = (boards) => {
  const score = (board) => {
    if (board.type === "scrum") {
      return 0;
    }
    if (board.type === "simple") {
      return 1;
    }
    return 2;
  };
  return [...boards].sort((a, b) => score(a) - score(b));
};

export const loadDeliveryContext = async ({ projectKey, boardId = null }) => {
  const projectResult = await fetchProject(projectKey);
  if (!projectResult.ok) {
    return {
      ok: false,
      error: projectResult.error,
      detail: `Project lookup failed (${projectResult.status || "unknown"}).`,
    };
  }

  const boardsResult = await fetchBoardsForProject(projectKey);
  if (!boardsResult.ok) {
    return {
      ok: false,
      error: boardsResult.error,
      detail: `Board lookup failed (${boardsResult.status || "unknown"}).`,
    };
  }

  const boards = pickBoardOrder(boardsResult.boards);
  let selectedBoard =
    boards.find((board) => String(board.id) === String(boardId)) || null;

  let sprint = null;
  const limitations = [];

  if (selectedBoard) {
    const sprintResult = await fetchActiveSprint(selectedBoard.id);
    if (!sprintResult.ok) {
      return {
        ok: false,
        error: sprintResult.error,
        detail: `Active sprint lookup failed on board ${selectedBoard.id}.`,
      };
    }
    sprint = sprintResult.sprint;
    if (sprintResult.unsupported) {
      limitations.push(
        `Board "${selectedBoard.name}" does not support sprints (often Kanban).`,
      );
    }
  } else {
    for (const board of boards) {
      const sprintResult = await fetchActiveSprint(board.id);
      if (!sprintResult.ok) {
        continue;
      }
      if (sprintResult.unsupported) {
        limitations.push(
          `Board "${board.name}" does not support sprints (often Kanban).`,
        );
        continue;
      }
      selectedBoard = board;
      sprint = sprintResult.sprint;
      if (sprint) {
        break;
      }
    }
  }

  if (!selectedBoard) {
    return {
      ok: true,
      context: {
        projectKey: projectResult.project.key,
        projectName: projectResult.project.name,
        boardId: null,
        boardName: null,
      },
      sprint: null,
      issues: [],
      changelogsByKey: {},
      limitations: [
        ...limitations,
        "No Jira Software board with sprint support was found for this project.",
      ],
    };
  }

  if (!sprint) {
    return {
      ok: true,
      context: {
        projectKey: projectResult.project.key,
        projectName: projectResult.project.name,
        boardId: selectedBoard.id,
        boardName: selectedBoard.name,
      },
      sprint: null,
      issues: [],
      changelogsByKey: {},
      limitations: [
        ...limitations,
        `No active sprint on board "${selectedBoard.name}". Start a sprint on the Platform board, then refresh.`,
      ],
    };
  }

  const issuesResult = await fetchSprintIssues(sprint.id);
  if (!issuesResult.ok) {
    return {
      ok: false,
      error: issuesResult.error,
      detail: `Sprint issue fetch failed for sprint ${sprint.id}.`,
    };
  }

  const changelogResult = await fetchChangelogsForIssues(issuesResult.issues);
  if (issuesResult.truncated) {
    limitations.push(
      `Sprint issue list truncated at ${MAX_SPRINT_ISSUES} issues.`,
    );
  }
  if (changelogResult.capped) {
    limitations.push(
      `Sprint changelog history fetched for the first ${MAX_CHANGELOG_ISSUES} issues only.`,
    );
  }

  return {
    ok: true,
    context: {
      projectKey: projectResult.project.key,
      projectName: projectResult.project.name,
      boardId: selectedBoard.id,
      boardName: selectedBoard.name,
    },
    sprint,
    issues: issuesResult.issues,
    changelogsByKey: changelogResult.changelogsByKey,
    limitations,
  };
};
