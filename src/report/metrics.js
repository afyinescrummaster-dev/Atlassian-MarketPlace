export const ISSUE_LIMIT = 500;
export const PAGE_SIZE = 100;

export const CRITICAL_PRIORITY_NAMES = ["Critical", "Highest"];

export const CRITICAL_PRIORITY_RULE =
  "Open issues whose Jira priority name is Critical or Highest";

export const utcDateString = (now = new Date()) =>
  now.toISOString().slice(0, 10);

export const isUnassigned = (issue) =>
  issue == null || issue.assignee == null || issue.assignee === "";

export const isOpen = (issue) => issue?.statusCategory !== "done";

export const overdueDateOf = (issue) =>
  issue?.overdueDate ?? issue?.dueDate ?? null;

export const isOverdue = (issue, today, options = {}) => {
  if (options.overdueConfigured === false) {
    return false;
  }

  if (!overdueDateOf(issue) || issue.statusCategory === "done") {
    return false;
  }

  return overdueDateOf(issue) < today;
};

const criticalNameSet = (names) =>
  new Set(
    (names ?? CRITICAL_PRIORITY_NAMES).map((name) =>
      String(name).trim().toLowerCase(),
    ),
  );

export const isCriticalOpen = (issue, options = {}) => {
  if (!isOpen(issue) || typeof issue?.priority !== "string") {
    return false;
  }

  const name = issue.priority.trim().toLowerCase();
  return criticalNameSet(options.criticalPriorityNames).has(name);
};

export const isBlockedOpen = (issue, options = {}) => {
  if (options.blockedConfigured === false) {
    return false;
  }

  return isOpen(issue) && issue?.blocked === true;
};

export const attentionReasons = (issue, today, options = {}) => {
  const reasons = [];

  if (isOverdue(issue, today, options)) {
    reasons.push("Overdue");
  }

  if (isUnassigned(issue)) {
    reasons.push("Unassigned");
  }

  if (isCriticalOpen(issue, options)) {
    reasons.push("Critical/Highest priority");
  }

  if (isBlockedOpen(issue, options)) {
    reasons.push("Blocked");
  }

  return reasons;
};

export const buildAttentionIssues = (issues, today, options = {}) =>
  (issues ?? [])
    .map((issue) => ({
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
      priority: issue.priority,
      assignee: issue.assignee,
      dueDate: overdueDateOf(issue) || issue.dueDate,
      reasons: attentionReasons(issue, today, options),
    }))
    .filter((row) => row.reasons.length > 0);

const countBy = (issues, keyFn) => {
  const counts = new Map();

  for (const issue of issues) {
    const name = keyFn(issue) || "None";
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const availabilityOf = (configured, hasValue) => {
  if (!configured) {
    return "not-configured";
  }

  return hasValue ? "ok" : "no-data";
};

export const calculateMetrics = (
  issues,
  {
    today = utcDateString(),
    truncated = false,
    partial = false,
    limit = ISSUE_LIMIT,
    overdueConfigured = true,
    blockedConfigured = false,
    storyPointsConfigured = false,
    completionMetric = "issueCount",
    criticalPriorityNames = CRITICAL_PRIORITY_NAMES,
  } = {},
) => {
  const list = issues ?? [];
  const options = {
    overdueConfigured,
    blockedConfigured,
    criticalPriorityNames,
  };
  let toDo = 0;
  let inProgress = 0;
  let completed = 0;
  let unassigned = 0;
  let overdue = 0;
  let criticalOpen = 0;
  let blocked = 0;
  let donePoints = 0;
  let totalPoints = 0;

  for (const issue of list) {
    if (issue.statusCategory === "new") {
      toDo += 1;
    } else if (issue.statusCategory === "indeterminate") {
      inProgress += 1;
    } else if (issue.statusCategory === "done") {
      completed += 1;
    }

    if (isUnassigned(issue)) {
      unassigned += 1;
    }

    if (isOverdue(issue, today, options)) {
      overdue += 1;
    }

    if (isCriticalOpen(issue, options)) {
      criticalOpen += 1;
    }

    if (isBlockedOpen(issue, options)) {
      blocked += 1;
    }

    if (typeof issue.storyPoints === "number") {
      totalPoints += issue.storyPoints;
      if (issue.statusCategory === "done") {
        donePoints += issue.storyPoints;
      }
    }
  }

  const hasOverdueDates = list.some((issue) => overdueDateOf(issue));
  const hasStoryPoints = list.some((issue) => typeof issue.storyPoints === "number");
  const completionByIssues = list.length ? Math.round((completed / list.length) * 100) : 0;
  const completionByPoints = totalPoints
    ? Math.round((donePoints / totalPoints) * 100)
    : 0;
  const completionAvailability =
    completionMetric === "storyPoints"
      ? availabilityOf(storyPointsConfigured, hasStoryPoints)
      : "ok";
  const completionPercent =
    completionAvailability === "ok"
      ? completionMetric === "storyPoints"
        ? completionByPoints
        : completionByIssues
      : null;

  const names = (criticalPriorityNames ?? CRITICAL_PRIORITY_NAMES).join(" or ");

  return {
    total: list.length,
    toDo,
    inProgress,
    completed,
    unassigned,
    overdue,
    criticalOpen,
    blocked,
    completionPercent,
    completionMetric,
    storyPointTotal: totalPoints,
    storyPointDone: donePoints,
    truncated,
    partial,
    limit,
    statusBreakdown: countBy(list, (issue) => issue.status),
    priorityBreakdown: countBy(list, (issue) => issue.priority),
    attention: buildAttentionIssues(list, today, options),
    criticalPriorityRule: `Open issues whose Jira priority name is ${names}`,
    availability: {
      overdue: availabilityOf(overdueConfigured, hasOverdueDates),
      blocked: availabilityOf(blockedConfigured, list.some((issue) => issue.blocked != null)),
      storyPoints: availabilityOf(storyPointsConfigured, hasStoryPoints),
      completion: completionAvailability,
    },
  };
};
