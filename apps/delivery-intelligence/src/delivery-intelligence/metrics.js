import { daysBetween, isBlockedIssue, isDone, isStaleIssue } from "./normalize.js";
import { CAPABILITY_STATUS, STALE_DAYS } from "./constants.js";
import {
  classifyIssueSprintHistory,
  roundScopePercent,
} from "./membership.js";

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

const classifyIssues = ({
  issues,
  sprintStart,
  sprintName,
  sprintId,
  changelogsByKey,
  previousSprint = null,
}) =>
  (issues || []).map((issue) => ({
    issue,
    classification: classifyIssueSprintHistory({
      changes: changelogsByKey?.[issue.key] || [],
      sprintStart,
      sprintName,
      sprintId,
      previousSprint,
    }),
  }));

export const computeScopeChange = ({
  issues,
  sprintStart,
  sprintName,
  sprintId,
  changelogsByKey,
}) => {
  const currentIssueCount = (issues || []).length;

  if (!sprintStart) {
    return {
      originalCommittedCount: null,
      currentIssueCount,
      addedIssueCount: null,
      scopeChangePercent: null,
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason: "Sprint start date was not returned by Jira.",
      },
    };
  }

  const classified = classifyIssues({
    issues,
    sprintStart,
    sprintName,
    sprintId,
    changelogsByKey,
  });
  const known = classified.filter((row) => row.classification.status === "classified");
  const unknownCount = classified.length - known.length;
  const addedIssueCount = known.filter((row) => row.classification.added).length;
  const committedKnown = known.filter((row) => row.classification.committed).length;
  const originalCommittedCount = committedKnown + unknownCount;

  if (known.length === 0) {
    return {
      originalCommittedCount: null,
      currentIssueCount,
      addedIssueCount: null,
      scopeChangePercent: null,
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason:
          "Sprint changelog history was not available, so original commitment versus added scope could not be proven.",
      },
    };
  }

  return {
    originalCommittedCount,
    currentIssueCount,
    addedIssueCount,
    scopeChangePercent: roundScopePercent(addedIssueCount, originalCommittedCount),
    capability: {
      status:
        unknownCount > 0 ? CAPABILITY_STATUS.PARTIAL : CAPABILITY_STATUS.AVAILABLE,
      reason:
        unknownCount > 0
          ? "Some issues had no sprint changelog; they are not counted as added scope."
          : "Original commitment is sprint membership at or before sprint activation, including Jira's start-sprint field write in the activation window. Added scope is first join strictly after that window.",
      source: "changelog",
    },
  };
};

export const computeCarryover = ({
  issues,
  sprintStart,
  sprintName,
  sprintId,
  changelogsByKey,
  previousSprint = null,
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

  const classified = classifyIssues({
    issues,
    sprintStart,
    sprintName,
    sprintId,
    changelogsByKey,
    previousSprint,
  });
  const known = classified.filter((row) => row.classification.status === "classified");

  if (known.length === 0) {
    return {
      carryoverCount: null,
      carryoverIssueKeys: [],
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason:
          "Carryover requires sprint field changelog that names a different prior sprint.",
      },
    };
  }

  const carryoverIssueKeys = classified
    .filter(
      (row) =>
        row.classification.carryover &&
        !isDone(row.issue) &&
        row.classification.priorSprints.length > 0,
    )
    .map((row) => row.issue.key);

  return {
    carryoverCount: carryoverIssueKeys.length,
    carryoverIssueKeys,
    capability: {
      status:
        known.length < classified.length
          ? CAPABILITY_STATUS.PARTIAL
          : CAPABILITY_STATUS.AVAILABLE,
      reason:
        "Carryover requires the board's previous closed sprint in changelog, then membership in the current sprint, while the issue is still not Done.",
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
