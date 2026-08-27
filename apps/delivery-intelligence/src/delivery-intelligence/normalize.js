const toDate = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const daysBetween = (from, to) => {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) {
    return null;
  }
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
};

export const normalizeIssue = (issue) => {
  const fields = issue?.fields || {};
  const status = fields.status || {};
  const statusCategory = status.statusCategory || {};
  const assignee = fields.assignee || null;

  return {
    id: issue?.id || null,
    key: issue?.key || null,
    summary: typeof fields.summary === "string" ? fields.summary : "",
    issueType: fields.issuetype?.name || null,
    statusName: status.name || null,
    statusCategoryKey: statusCategory.key || null,
    priorityName: fields.priority?.name || null,
    assigneeDisplayName: assignee?.displayName || null,
    created: fields.created || null,
    updated: fields.updated || null,
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    blockedLinksCount: countBlockedByLinks(fields.issuelinks),
  };
};

const countBlockedByLinks = (links) => {
  if (!Array.isArray(links)) {
    return 0;
  }
  return links.filter((link) => {
    const outward = link?.outwardIssue;
    const inward = link?.inwardIssue;
    const typeName = (link?.type?.outward || link?.type?.inward || "").toLowerCase();
    if (typeName.includes("block")) {
      return true;
    }
    const outwardStatus = outward?.fields?.status?.name?.toLowerCase() || "";
    const inwardStatus = inward?.fields?.status?.name?.toLowerCase() || "";
    return outwardStatus.includes("block") || inwardStatus.includes("block");
  }).length;
};

export const isDone = (issue) => issue?.statusCategoryKey === "done";

export const isBlockedIssue = (issue) => {
  if (isDone(issue)) {
    return false;
  }
  const status = (issue?.statusName || "").toLowerCase();
  if (status.includes("block")) {
    return true;
  }
  const labels = (issue?.labels || []).map((label) => label.toLowerCase());
  return labels.includes("blocked") || labels.includes("impediment");
};

export const isStaleIssue = (issue, now, staleDays) => {
  if (isDone(issue)) {
    return false;
  }
  const age = daysBetween(issue.updated, now);
  return age != null && age >= staleDays;
};

export const extractSprintChanges = (changelog) => {
  const histories = Array.isArray(changelog?.values) ? changelog.values : [];
  const changes = [];

  for (const history of histories) {
    const created = history.created;
    const items = Array.isArray(history.items) ? history.items : [];
    for (const item of items) {
      if ((item.field || "").toLowerCase() !== "sprint") {
        continue;
      }
      changes.push({
        at: created,
        from: item.fromString || null,
        to: item.toString || null,
        fromId: item.from || null,
        toId: item.to || null,
      });
    }
  }

  return changes.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
};
