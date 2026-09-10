export const toIssueCard = (issue, extras = {}) => ({
  key: issue?.key || null,
  summary: issue?.summary || "",
  statusName: issue?.statusName || null,
  reason: extras.reason || null,
  joinedAt: extras.joinedAt || null,
  ageDays: extras.ageDays ?? null,
});
