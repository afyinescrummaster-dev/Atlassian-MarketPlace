import { daysBetween, isBlockedIssue, isDone, isStaleIssue } from "./normalize.js";
import { CAPABILITY_STATUS, STALE_DAYS } from "./constants.js";
import { toIssueCard } from "./issue-card.js";
import {
  classifyIssueSprintHistory,
  roundScopePercent,
} from "./membership.js";

const REMOVALS_UNAVAILABLE = {
  status: CAPABILITY_STATUS.UNAVAILABLE,
  reason: "Reliable removal history is not available yet.",
};

const emptyScopeLists = () => ({
  originalCommittedIssueKeys: [],
  originalCommittedIssues: [],
  addedIssueKeys: [],
  addedIssues: [],
  removedIssueCount: null,
  removedIssueKeys: [],
  removals: REMOVALS_UNAVAILABLE,
});

export const computeCompletion = (issues) => {
  const rows = issues || [];
  if (!rows.length) {
    return {
      completionPercent: 0,
      doneCount: 0,
      totalCount: 0,
      doneIssues: [],
      openIssues: [],
    };
  }
  const doneIssues = rows.filter(isDone).map((issue) =>
    toIssueCard(issue, { reason: "Done" }),
  );
  const openIssues = rows.filter((issue) => !isDone(issue)).map((issue) =>
    toIssueCard(issue, { reason: "Open" }),
  );
  return {
    completionPercent: Math.round((doneIssues.length / rows.length) * 100),
    doneCount: doneIssues.length,
    totalCount: rows.length,
    doneIssues,
    openIssues,
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
  const lists = emptyScopeLists();

  if (!sprintStart) {
    return {
      originalCommittedCount: null,
      currentIssueCount,
      addedIssueCount: null,
      scopeChangePercent: null,
      ...lists,
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
  const addedRows = known.filter((row) => row.classification.added);
  const committedKnown = known.filter((row) => row.classification.committed).length;
  const originalCommittedCount = committedKnown + unknownCount;
  const addedIssueCount = addedRows.length;

  if (known.length === 0) {
    return {
      originalCommittedCount: null,
      currentIssueCount,
      addedIssueCount: null,
      scopeChangePercent: null,
      ...lists,
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason:
          "Sprint changelog history was not available, so original commitment versus added scope could not be proven.",
      },
    };
  }

  const originalCommittedIssues = classified
    .filter((row) =>
      row.classification.status !== "classified"
        ? true
        : row.classification.committed,
    )
    .map((row) =>
      toIssueCard(row.issue, {
        reason:
          row.classification.status !== "classified"
            ? "Counted as original commitment (no sprint changelog)"
            : "Original commitment",
        joinedAt: row.classification.firstJoinedAt || null,
      }),
    );
  const addedIssues = addedRows.map((row) =>
    toIssueCard(row.issue, {
      reason: "Added after sprint start",
      joinedAt: row.classification.firstJoinedAt || null,
    }),
  );

  return {
    originalCommittedCount,
    currentIssueCount,
    addedIssueCount,
    scopeChangePercent: roundScopePercent(addedIssueCount, originalCommittedCount),
    originalCommittedIssueKeys: originalCommittedIssues.map((row) => row.key),
    originalCommittedIssues,
    addedIssueKeys: addedIssues.map((row) => row.key),
    addedIssues,
    removedIssueCount: null,
    removedIssueKeys: [],
    removals: REMOVALS_UNAVAILABLE,
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
      carryoverIssues: [],
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
      carryoverIssues: [],
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason:
          "Carryover requires sprint field changelog that names a different prior sprint.",
      },
    };
  }

  const carryoverIssues = classified
    .filter(
      (row) =>
        row.classification.carryover &&
        !isDone(row.issue) &&
        row.classification.priorSprints.length > 0,
    )
    .map((row) =>
      toIssueCard(row.issue, {
        reason: "Carried from the previous completed sprint",
        joinedAt: row.classification.firstJoinedAt || null,
      }),
    );

  return {
    carryoverCount: carryoverIssues.length,
    carryoverIssueKeys: carryoverIssues.map((row) => row.key),
    carryoverIssues,
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
  const blocked = (issues || []).filter((issue) => isBlockedIssue(issue));
  return {
    blockedCount: blocked.length,
    blockedIssues: blocked.map((issue) => ({
      ...toIssueCard(issue, {
        reason: "Blocked",
        ageDays: daysBetween(issue.updated, now),
      }),
      blockedLinksCount: issue.blockedLinksCount || 0,
    })),
  };
};

export const computeStale = (issues, now, staleDays = STALE_DAYS) => {
  const stale = (issues || []).filter((issue) => isStaleIssue(issue, now, staleDays));
  return {
    staleCount: stale.length,
    staleIssues: stale.map((issue) =>
      toIssueCard(issue, {
        reason: "Stale",
        ageDays: daysBetween(issue.updated, now),
      }),
    ),
  };
};
