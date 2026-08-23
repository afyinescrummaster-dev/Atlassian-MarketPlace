export const UNASSIGNED_FILTER = "__unassigned__";

export const filterIssues = (
  issues,
  { query = "", status = null, priority = null, assignee = null } = {},
) => {
  const needle = query.trim().toLowerCase();

  return (issues ?? []).filter((issue) => {
    if (needle) {
      const key = (issue.key || "").toLowerCase();
      const summary = (issue.summary || "").toLowerCase();
      if (!key.includes(needle) && !summary.includes(needle)) {
        return false;
      }
    }

    if (status && issue.status !== status) {
      return false;
    }

    if (priority && issue.priority !== priority) {
      return false;
    }

    if (assignee === UNASSIGNED_FILTER) {
      return issue.assignee == null || issue.assignee === "";
    }

    if (assignee && issue.assignee !== assignee) {
      return false;
    }

    return true;
  });
};
