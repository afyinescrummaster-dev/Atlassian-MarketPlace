import { INACTIVE_DAYS } from "./constants.js";

/** Normalize a field name for duplicate detection (trim, collapse space, lower-case). */
export const normalizeFieldName = (name) => {
  if (typeof name !== "string") {
    return "";
  }

  return name.trim().replace(/\s+/g, " ").toLowerCase();
};

export const daysSince = (isoTimestamp, now = new Date()) => {
  if (!isoTimestamp) {
    return null;
  }

  const then = new Date(isoTimestamp);
  if (Number.isNaN(then.getTime())) {
    return null;
  }

  const ms = now.getTime() - then.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

export const isPotentiallyInactive = (
  lastIssueUpdateTime,
  { now = new Date(), inactiveDays = INACTIVE_DAYS } = {},
) => {
  if (!lastIssueUpdateTime) {
    return false;
  }

  const age = daysSince(lastIssueUpdateTime, now);
  return age != null && age >= inactiveDays;
};

export const projectTypeLabel = (typeKey) => {
  if (typeKey === "software") {
    return "Jira Software";
  }
  if (typeKey === "service_desk") {
    return "Jira Service Management";
  }
  if (typeKey === "business") {
    return "Business / Work Management";
  }
  return typeKey ? String(typeKey) : "Unknown";
};
