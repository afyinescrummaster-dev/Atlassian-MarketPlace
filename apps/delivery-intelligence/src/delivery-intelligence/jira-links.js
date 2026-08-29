export const collectIssueKeys = (issues = [], keys = []) => {
  const fromIssues = (issues || []).map((row) => row?.key).filter(Boolean);
  const source = fromIssues.length ? fromIssues : (keys || []).filter(Boolean);
  return [...new Set(source)];
};

export const cardsFromIssuesOrKeys = (issues = [], keys = [], reason = null) => {
  if (Array.isArray(issues) && issues.length) {
    return issues;
  }
  return collectIssueKeys([], keys).map((key) => ({
    key,
    summary: "",
    statusName: null,
    reason,
    joinedAt: null,
    ageDays: null,
  }));
};

export const jqlForIssueKeys = (keys) => {
  const unique = collectIssueKeys([], keys);
  if (unique.length === 0) {
    return null;
  }
  if (unique.length === 1) {
    return `key = ${unique[0]}`;
  }
  return `key in (${unique.join(", ")}) ORDER BY key`;
};

export const jqlForSprint = (projectKey, sprintId) => {
  if (sprintId == null || sprintId === "") {
    return null;
  }
  const sprintClause = `sprint = ${sprintId}`;
  return projectKey
    ? `project = ${projectKey} AND ${sprintClause} ORDER BY key`
    : `${sprintClause} ORDER BY key`;
};

export const jiraPathForKeys = (keys) => {
  const unique = collectIssueKeys([], keys);
  if (unique.length === 0) {
    return null;
  }
  if (unique.length === 1) {
    return `/browse/${unique[0]}`;
  }
  return `/issues/?jql=${encodeURIComponent(jqlForIssueKeys(unique))}`;
};

export const jiraPathForJql = (jql) =>
  jql ? `/issues/?jql=${encodeURIComponent(jql)}` : null;
