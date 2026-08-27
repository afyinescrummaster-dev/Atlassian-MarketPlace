import { daysBetween, isBlockedIssue, isDone, isStaleIssue } from "./normalize.js";
import { CAPABILITY_STATUS, STALE_DAYS } from "./constants.js";

export const computeCompletion = (issues) => {
  if (!issues.length) {
    return { completionPercent: 0, doneCount: 0, totalCount: 0 };
  }
  const doneCount = issues.filter(isDone).length;
  return {
    completionPercent: Math.round((doneCount / issues.length) * 100),
    doneCount,
    totalCount: issues.length,
  };
};

export const computeScopeChange = ({ issues, sprintStart, changelogsByKey }) => {
  if (!sprintStart) {
    return {
      addedIssueCount: null,
      scopeChangePercent: null,
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason: "Sprint start date was not returned by Jira.",
      },
    };
  }

  const startMs = new Date(sprintStart).getTime();
  let addedIssueCount = 0;
  let analyzedWithHistory = 0;

  for (const issue of issues) {
    const changes = changelogsByKey?.[issue.key] || [];
    if (changes.length > 0) {
      analyzedWithHistory += 1;
      const addedViaSprintField = changes.some((change) => {
        const atMs = new Date(change.at).getTime();
        return atMs >= startMs && change.to && !change.from;
      });
      if (addedViaSprintField) {
        addedIssueCount += 1;
        continue;
      }
      const movedIntoSprint = changes.some((change) => {
        const atMs = new Date(change.at).getTime();
        return atMs >= startMs && change.to && change.from !== change.to;
      });
      if (movedIntoSprint) {
        addedIssueCount += 1;
        continue;
      }
    }

    const createdMs = issue.created ? new Date(issue.created).getTime() : null;
    if (createdMs != null && createdMs >= startMs) {
      addedIssueCount += 1;
    }
  }

  const total = issues.length || 1;
  const capability =
    changelogsByKey && Object.keys(changelogsByKey).length > 0
      ? analyzedWithHistory < issues.length
        ? {
            status: CAPABILITY_STATUS.PARTIAL,
            reason:
              "Scope change uses sprint changelog where available; remaining issues use created date only.",
          }
        : {
            status: CAPABILITY_STATUS.AVAILABLE,
            reason: "Derived from sprint field changelog and issue created dates.",
          }
      : {
          status: CAPABILITY_STATUS.PARTIAL,
          reason:
            "Sprint changelog was not fetched; scope change uses issue created dates after sprint start only.",
        };

  return {
    addedIssueCount,
    scopeChangePercent: Math.round((addedIssueCount / total) * 100),
    capability,
  };
};

export const computeCarryover = ({
  issues,
  sprintStart,
  sprintName,
  changelogsByKey,
}) => {
  if (!sprintStart || !sprintName) {
    return {
      carryoverCount: null,
      carryoverIssueKeys: [],
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason: "Sprint metadata required for carryover detection was missing.",
      },
    };
  }

  if (!changelogsByKey || Object.keys(changelogsByKey).length === 0) {
    return {
      carryoverCount: null,
      carryoverIssueKeys: [],
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason:
          "Carryover requires sprint field changelog history; none was retrieved for this snapshot.",
      },
    };
  }

  const startMs = new Date(sprintStart).getTime();
  const carryoverIssueKeys = [];

  for (const issue of issues) {
    if (isDone(issue)) {
      continue;
    }
    const changes = changelogsByKey[issue.key] || [];
    const carried = changes.some((change) => {
      const atMs = new Date(change.at).getTime();
      const mentionsCurrent =
        (change.to || "").includes(sprintName) ||
        String(change.toId || "") === String(issue.sprintId || "");
      return (
        atMs <= startMs + 86400000 &&
        mentionsCurrent &&
        change.from &&
        change.from !== change.to
      );
    });
    if (carried) {
      carryoverIssueKeys.push(issue.key);
    }
  }

  return {
    carryoverCount: carryoverIssueKeys.length,
    carryoverIssueKeys,
    capability: {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason:
        "Issues moved into this sprint from another sprint before/at sprint start and still open.",
    },
  };
};

export const computeBlocked = (issues, now) => {
  const blocked = issues.filter((issue) => isBlockedIssue(issue));
  return {
    blockedCount: blocked.length,
    blockedIssues: blocked.map((issue) => ({
      key: issue.key,
      summary: issue.summary,
      statusName: issue.statusName,
      ageDays: daysBetween(issue.updated, now),
      blockedLinksCount: issue.blockedLinksCount,
    })),
  };
};

export const computeStale = (issues, now, staleDays = STALE_DAYS) => {
  const stale = issues.filter((issue) => isStaleIssue(issue, now, staleDays));
  return {
    staleCount: stale.length,
    staleIssues: stale.map((issue) => ({
      key: issue.key,
      summary: issue.summary,
      ageDays: daysBetween(issue.updated, now),
    })),
  };
};
