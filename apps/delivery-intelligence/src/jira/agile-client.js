import { route } from "@forge/api";
import {
  permissionStatus,
  readJson,
  requestJira,
} from "@atlassian-marketplace/shared-jira";
import { MAX_CHANGELOG_ISSUES, MAX_SPRINT_ISSUES } from "../delivery-intelligence/constants.js";
import {
  extractSprintChanges,
  normalizeIssue,
} from "../delivery-intelligence/normalize.js";

export const fetchBoardsForProject = async (projectKey) => {
  const response = await requestJira(
    route`/rest/agile/1.0/board?projectKeyOrId=${projectKey}`,
  );

  if (permissionStatus(response.status)) {
    return { ok: false, error: "permission" };
  }
  if (!response.ok) {
    return { ok: false, error: "unavailable" };
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

  if (permissionStatus(response.status)) {
    return { ok: false, error: "permission" };
  }
  if (!response.ok) {
    return { ok: false, error: "unavailable" };
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
        : { ok: false, error: "permission" };
    }
    if (!response.ok) {
      return issues.length
        ? { ok: true, issues, truncated: true, partial: true }
        : { ok: false, error: "unavailable" };
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

export const fetchChangelogsForIssues = async (issues, limit = MAX_CHANGELOG_ISSUES) => {
  const changelogsByKey = {};
  const slice = issues.slice(0, limit);
  let fetched = 0;

  for (const issue of slice) {
    if (!issue.key) {
      continue;
    }
    const result = await fetchIssueChangelog(issue.key);
    if (result.ok) {
      changelogsByKey[issue.key] = result.changes;
      fetched += 1;
    }
  }

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
    return { ok: false, error: boardsResult.error };
  }

  const boards = boardsResult.boards;
  const selectedBoard =
    boards.find((board) => String(board.id) === String(boardId)) ||
    boards[0] ||
    null;

  if (!selectedBoard) {
    return {
      ok: true,
      context: {
        projectKey,
        boardId: null,
        boardName: null,
      },
      sprint: null,
      issues: [],
      changelogsByKey: {},
      limitations: [
        "No Jira Software board was found for this project. Sprint metrics require a board-backed project.",
      ],
    };
  }

  const sprintResult = await fetchActiveSprint(selectedBoard.id);
  if (!sprintResult.ok) {
    return { ok: false, error: sprintResult.error };
  }

  if (!sprintResult.sprint) {
    return {
      ok: true,
      context: {
        projectKey,
        boardId: selectedBoard.id,
        boardName: selectedBoard.name,
      },
      sprint: null,
      issues: [],
      changelogsByKey: {},
      limitations: ["No active sprint was found on the selected board."],
    };
  }

  const issuesResult = await fetchSprintIssues(sprintResult.sprint.id);
  if (!issuesResult.ok) {
    return { ok: false, error: issuesResult.error };
  }

  const changelogResult = await fetchChangelogsForIssues(issuesResult.issues);
  const limitations = [];
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
      projectKey,
      boardId: selectedBoard.id,
      boardName: selectedBoard.name,
    },
    sprint: sprintResult.sprint,
    issues: issuesResult.issues,
    changelogsByKey: changelogResult.changelogsByKey,
    limitations,
  };
};
