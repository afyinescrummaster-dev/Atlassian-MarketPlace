import { route } from "@forge/api";
import { ISSUE_LIMIT, PAGE_SIZE } from "../report/metrics.js";
import { buildProjectJql } from "../report/project-key.js";
import { buildSearchFields, normalizeSearchIssue } from "../report/mapping.js";
import { permissionStatus, readJson, requestJira } from "./jira.js";

export const fetchProject = async (projectKey) => {
  const response = await requestJira(route`/rest/api/3/project/${projectKey}`);

  if (permissionStatus(response.status)) {
    return { ok: false, error: "permission" };
  }

  if (!response.ok) {
    return { ok: false, error: "unavailable" };
  }

  const project = await readJson(response);
  return {
    ok: true,
    project: {
      key: project?.key || projectKey,
      name: typeof project?.name === "string" ? project.name : projectKey,
      type:
        typeof project?.projectTypeKey === "string"
          ? project.projectTypeKey
          : null,
    },
  };
};

const searchPage = async ({ jql, maxResults, nextPageToken, mapping }) => {
  const body = {
    jql,
    maxResults,
    fields: buildSearchFields(mapping),
  };

  if (nextPageToken) {
    body.nextPageToken = nextPageToken;
  }

  const response = await requestJira(route`/rest/api/3/search/jql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (permissionStatus(response.status)) {
    return { ok: false, error: "permission", status: response.status };
  }

  if (!response.ok) {
    return { ok: false, error: "unavailable", status: response.status };
  }

  const payload = (await readJson(response)) ?? {};
  const issues = Array.isArray(payload.issues)
    ? payload.issues.map((issue) => normalizeSearchIssue(issue, mapping))
    : [];

  return {
    ok: true,
    issues,
    nextPageToken: payload.nextPageToken || null,
    isLast: payload.isLast === true || !payload.nextPageToken,
  };
};

export const loadIssues = async (projectKey, mapping = null) => {
  const jql = buildProjectJql(projectKey);
  const issues = [];
  let nextPageToken = null;
  let truncated = false;
  let partial = false;

  while (issues.length < ISSUE_LIMIT) {
    const remaining = ISSUE_LIMIT - issues.length;
    const page = await searchPage({
      jql,
      maxResults: Math.min(PAGE_SIZE, remaining),
      nextPageToken,
      mapping,
    });

    if (!page.ok) {
      if (issues.length === 0) {
        return { ok: false, error: page.error };
      }

      partial = true;
      break;
    }

    issues.push(...page.issues);

    if (page.isLast || !page.nextPageToken) {
      truncated = false;
      break;
    }

    nextPageToken = page.nextPageToken;

    if (issues.length >= ISSUE_LIMIT) {
      truncated = true;
      break;
    }
  }

  if (issues.length >= ISSUE_LIMIT && nextPageToken) {
    truncated = true;
  }

  return { ok: true, issues, truncated, partial };
};
