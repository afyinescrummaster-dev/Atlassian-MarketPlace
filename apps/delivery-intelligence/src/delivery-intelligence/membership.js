import { START_COMMITMENT_WINDOW_MS } from "./constants.js";

const JUNK_TOKEN = /^(state|rapidviewid|completedate|startdate|enddate|sequence|goal|synced|autostartstop|originboardid)=/i;

const splitTokens = (value) => {
  if (value == null || value === "") {
    return [];
  }

  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

const parseSprintFieldValue = (stringValue, idValue) => {
  const ids = new Set();
  const names = new Set();

  for (const token of splitTokens(idValue)) {
    if (/^\d+$/.test(token)) {
      ids.add(token);
    }
  }

  const raw = stringValue == null ? "" : String(stringValue);
  if (/id=\d+/i.test(raw) || /name=/i.test(raw)) {
    for (const match of raw.matchAll(/(?:\[|,)id=(\d+)/gi)) {
      ids.add(match[1]);
    }
    for (const match of raw.matchAll(/name=([^,\]]+)/gi)) {
      const name = match[1].trim();
      if (name && name !== "<null>") {
        names.add(name);
      }
    }
    return { ids, names };
  }

  for (const token of splitTokens(raw)) {
    if (JUNK_TOKEN.test(token)) {
      continue;
    }
    if (/^\d+$/.test(token)) {
      ids.add(token);
    } else {
      names.add(token);
    }
  }

  return { ids, names };
};

export const sprintTokens = (stringValue, idValue) => {
  const parsed = parseSprintFieldValue(stringValue, idValue);
  return [...parsed.ids, ...parsed.names];
};

export const tokenIsCurrentSprint = (token, sprintName, sprintId) => {
  if (!token) {
    return false;
  }

  if (sprintId != null && String(token) === String(sprintId)) {
    return true;
  }

  if (!sprintName) {
    return false;
  }

  return String(token).toLowerCase() === String(sprintName).toLowerCase();
};

export const tokensIncludeCurrent = (tokens, sprintName, sprintId) =>
  (tokens || []).some((token) => tokenIsCurrentSprint(token, sprintName, sprintId));

export const priorSprintTokens = (tokens, sprintName, sprintId) =>
  (tokens || []).filter((token) => !tokenIsCurrentSprint(token, sprintName, sprintId));

const ISO_DATE_TOKEN = /^\d{4}-\d{2}-\d{2}T/;

const isCarryoverToken = (token) =>
  Boolean(token) && !ISO_DATE_TOKEN.test(String(token));

export const tokensIncludeSprint = (tokens, sprint) =>
  Boolean(sprint) &&
  (tokens || []).some((token) => tokenIsCurrentSprint(token, sprint.name, sprint.id));

/** Jira Sprint Report uses activation (Start click), not the editable startDate. */
export const commitmentTimestamp = (sprint) =>
  sprint?.activatedDate || sprint?.startDate || null;

/**
 * Reconstruct sprint membership from Jira sprint-field changelog.
 *
 * Baseline: original commitment is membership at or before sprint activation
 * (activatedDate, else startDate), including Jira's start-sprint field write
 * within START_COMMITMENT_WINDOW_MS. First join after that window is added
 * scope. Carryover requires the board's previous closed sprint.
 */
export const classifyIssueSprintHistory = ({
  changes = [],
  sprintStart,
  sprintName,
  sprintId,
  previousSprint = null,
}) => {
  if (!sprintStart) {
    return {
      status: "unknown",
      committed: false,
      added: false,
      carryover: false,
      priorSprints: [],
      firstJoinedAt: null,
    };
  }

  const startMs = new Date(sprintStart).getTime();
  const sorted = [...changes].sort(
    (left, right) => new Date(left.at).getTime() - new Date(right.at).getTime(),
  );

  if (sorted.length === 0) {
    return {
      status: "unknown",
      committed: false,
      added: false,
      carryover: false,
      priorSprints: [],
      firstJoinedAt: null,
    };
  }

  let membership = sprintTokens(sorted[0].from, sorted[0].fromId);
  let membershipAtOrBeforeStart =
    new Date(sorted[0].at).getTime() > startMs ? [...membership] : null;
  let firstJoinedCurrentAt = tokensIncludeCurrent(membership, sprintName, sprintId)
    ? Number.NEGATIVE_INFINITY
    : null;
  const priors = new Set(priorSprintTokens(membership, sprintName, sprintId));

  for (const change of sorted) {
    const at = new Date(change.at).getTime();
    const fromTokens = sprintTokens(change.from, change.fromId);
    const toTokens = sprintTokens(change.to, change.toId);
    for (const token of priorSprintTokens(fromTokens, sprintName, sprintId)) {
      priors.add(token);
    }

    const wasIn = tokensIncludeCurrent(membership, sprintName, sprintId);
    if (toTokens.length > 0) {
      membership = toTokens;
    }
    const nowIn = tokensIncludeCurrent(membership, sprintName, sprintId);

    if (!wasIn && nowIn && firstJoinedCurrentAt == null) {
      firstJoinedCurrentAt = at;
    }

    if (at <= startMs) {
      membershipAtOrBeforeStart = [...membership];
    }
  }

  const inSprintAtStart = membershipAtOrBeforeStart
    ? tokensIncludeCurrent(membershipAtOrBeforeStart, sprintName, sprintId)
    : firstJoinedCurrentAt != null && firstJoinedCurrentAt <= startMs;
  const joinedDuringStartWrite =
    !inSprintAtStart &&
    firstJoinedCurrentAt != null &&
    firstJoinedCurrentAt > startMs &&
    firstJoinedCurrentAt <= startMs + START_COMMITMENT_WINDOW_MS;
  const committed = inSprintAtStart || joinedDuringStartWrite;
  const added =
    !committed && firstJoinedCurrentAt != null && firstJoinedCurrentAt > startMs;
  const priorIdentities = [...priors].filter(isCarryoverToken);
  const carryover =
    Boolean(previousSprint) &&
    (committed || added) &&
    tokensIncludeSprint(priorIdentities, previousSprint);

  const firstJoinedAt =
    firstJoinedCurrentAt == null || firstJoinedCurrentAt === Number.NEGATIVE_INFINITY
      ? null
      : new Date(firstJoinedCurrentAt).toISOString();

  return {
    status: "classified",
    committed,
    added,
    carryover,
    priorSprints: priorIdentities,
    firstJoinedAt,
  };
};

export const roundScopePercent = (addedIssueCount, originalCommittedCount) => {
  if (!originalCommittedCount) {
    return addedIssueCount > 0 ? 100 : 0;
  }

  return Math.round((addedIssueCount / originalCommittedCount) * 1000) / 10;
};
