import { CAPABILITY_STATUS } from "./constants.js";
import { daysBetween, isDone } from "./normalize.js";
import {
  AGING_STATUS_DAYS,
  ATTENTION_LEVEL,
  ESTIMATE_COVERAGE_FOR_POINTS,
  HIGH_WIP_RATIO,
  NOT_STARTED_URGENCY_ELAPSED,
  OWNERSHIP_CONCENTRATION_MIN_ACTIVE,
  OWNERSHIP_CONCENTRATION_SHARE,
  PACING_STATE,
  STATUS_CHURN_MIN_TRANSITIONS,
  WORKFLOW_ACCUMULATION_MIN_COUNT,
} from "./thresholds.js";

const toMs = (value) => {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

const estimateOf = (issue) => {
  const value = issue?.estimate;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
};

const historyFor = (byKey, key) =>
  [...(byKey?.[key] || [])].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

const categoryOfName = (name) => {
  const lower = String(name || "").toLowerCase();
  if (!lower) {
    return null;
  }
  if (
    lower.includes("done") ||
    lower.includes("closed") ||
    lower.includes("resolved") ||
    lower === "complete" ||
    lower === "completed"
  ) {
    return "done";
  }
  if (
    lower.includes("to do") ||
    lower.includes("todo") ||
    lower.includes("backlog") ||
    lower === "open" ||
    lower.includes("selected for development")
  ) {
    return "new";
  }
  return "indeterminate";
};

export const computeSprintElapsed = (sprint, now = new Date()) => {
  const startMs = toMs(sprint?.activatedDate || sprint?.startDate);
  const endMs = toMs(sprint?.endDate);
  const nowMs = now.getTime();
  if (startMs == null || endMs == null || !(endMs > startMs)) {
    return {
      elapsedPercent: null,
      elapsedShare: null,
      remainingDays: null,
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason: "Sprint start and end dates are required for pacing.",
      },
    };
  }
  const elapsedShare = Math.min(1, Math.max(0, (nowMs - startMs) / (endMs - startMs)));
  return {
    elapsedPercent: Math.round(elapsedShare * 100),
    elapsedShare,
    remainingDays: Math.max(0, Math.ceil((endMs - nowMs) / 86400000)),
    capability: {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason: "Sprint calendar bounds were available.",
    },
  };
};

/**
 * Transparent delivery pacing — not an advanced forecast.
 */
export const computeDeliveryPace = ({
  issues = [],
  sprint = null,
  scope = null,
  blocked = null,
  carryoverIssueKeys = [],
  statusHistoriesByKey = {},
  estimation = null,
  now = new Date(),
} = {}) => {
  const elapsed = computeSprintElapsed(sprint, now);
  const rows = issues || [];
  const doneIssues = rows.filter(isDone);
  const openIssues = rows.filter((issue) => !isDone(issue));
  const notStartedIssues = openIssues.filter(
    (issue) => issue.statusCategoryKey === "new",
  );
  const inProgressIssues = openIssues.filter(
    (issue) => issue.statusCategoryKey === "indeterminate",
  );

  const estimatedIssues = rows.filter((issue) => estimateOf(issue) != null);
  const coverage = rows.length ? estimatedIssues.length / rows.length : 0;
  const usePoints =
    Boolean(estimation?.usable) &&
    coverage >= ESTIMATE_COVERAGE_FOR_POINTS &&
    estimatedIssues.length > 0;

  let measurementBasis = "issues";
  let completedPercent = rows.length
    ? Math.round((doneIssues.length / rows.length) * 100)
    : 0;
  let openWorkRemaining = openIssues.length;

  if (usePoints) {
    measurementBasis = "story_points";
    const totalPoints = estimatedIssues.reduce(
      (sum, issue) => sum + estimateOf(issue),
      0,
    );
    const donePoints = estimatedIssues
      .filter(isDone)
      .reduce((sum, issue) => sum + estimateOf(issue), 0);
    completedPercent =
      totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
    openWorkRemaining = estimatedIssues
      .filter((issue) => !isDone(issue))
      .reduce((sum, issue) => sum + estimateOf(issue), 0);
  }

  let pacingState = PACING_STATE.UNAVAILABLE;
  if (elapsed.elapsedPercent != null) {
    const gap = elapsed.elapsedPercent - completedPercent;
    if (gap <= 5) {
      pacingState = PACING_STATE.ON_PACE;
    } else if (gap <= 15) {
      pacingState = PACING_STATE.WATCH;
    } else {
      pacingState = PACING_STATE.BEHIND;
    }
  }

  const addedKeys = new Set(scope?.addedIssueKeys || []);
  const committedKeys = new Set(scope?.originalCommittedIssueKeys || []);
  const carryoverKeys = new Set(carryoverIssueKeys || []);
  const notStartedCommitted = notStartedIssues.filter((issue) =>
    committedKeys.has(issue.key),
  );

  const notStartedSignal = {
    count: notStartedIssues.length,
    committedCount: notStartedCommitted.length,
    lateAddedCount: notStartedIssues.filter((issue) => addedKeys.has(issue.key))
      .length,
    issueKeys: notStartedIssues.map((issue) => issue.key),
    urgency:
      elapsed.elapsedShare != null &&
      elapsed.elapsedShare >= NOT_STARTED_URGENCY_ELAPSED &&
      notStartedCommitted.length >= 2
        ? ATTENTION_LEVEL.HIGH
        : ATTENTION_LEVEL.MEDIUM,
    explanation:
      elapsed.elapsedPercent != null && notStartedCommitted.length > 0
        ? `${elapsed.elapsedPercent}% of the sprint has elapsed, but ${notStartedCommitted.length} committed issue${
            notStartedCommitted.length === 1 ? " has" : "s have"
          } not started.`
        : `${notStartedIssues.length} issue${
            notStartedIssues.length === 1 ? "" : "s"
          } remain in a To Do status category.`,
  };

  const highWip =
    inProgressIssues.length >= 3 &&
    (doneIssues.length === 0
      ? inProgressIssues.length >= 3
      : inProgressIssues.length / Math.max(1, doneIssues.length) >= HIGH_WIP_RATIO);
  const wipSignal = {
    inProgressCount: inProgressIssues.length,
    completedCount: doneIssues.length,
    notStartedCount: notStartedIssues.length,
    highWip,
    explanation: highWip
      ? `${inProgressIssues.length} issues are in progress and ${doneIssues.length} are complete. Consider finishing active work before starting additional issues.`
      : `${inProgressIssues.length} issue${
          inProgressIssues.length === 1 ? " is" : "s are"
        } in progress.`,
  };

  let agingCapability = {
    status: CAPABILITY_STATUS.AVAILABLE,
    reason: "Status entry times reconstructed from changelog where available.",
  };
  let historyHits = 0;
  const agingWork = [];
  for (const issue of inProgressIssues) {
    const history = historyFor(statusHistoriesByKey, issue.key);
    let enteredAt = null;
    if (history.length) {
      historyHits += 1;
      enteredAt = history[history.length - 1].at;
    }
    const daysInStatus =
      enteredAt != null
        ? daysBetween(enteredAt, now)
        : daysBetween(issue.updated, now);
    if (daysInStatus != null && daysInStatus >= AGING_STATUS_DAYS) {
      agingWork.push({
        issueKey: issue.key,
        issueSummary: issue.summary,
        statusName: issue.statusName,
        daysInStatus,
        lastMeaningfulUpdate: issue.updated,
        sprintDaysRemaining: elapsed.remainingDays,
        reconstructedFromChangelog: history.length > 0,
        explanation: `${issue.key} has remained ${
          issue.statusName || "In Progress"
        } for ${daysInStatus} day${daysInStatus === 1 ? "" : "s"}.`,
      });
    }
  }
  if (inProgressIssues.length > 0 && historyHits === 0) {
    agingCapability = {
      status: CAPABILITY_STATUS.PARTIAL,
      reason:
        "Status-entry time could not be reconstructed from changelog for in-progress issues; aging uses last update as a weaker proxy.",
    };
  }

  const blockerDurations = (blocked?.blockedIssues || []).map((row) => {
    const issue = rows.find((item) => item.key === row.key) || row;
    const history = historyFor(statusHistoriesByKey, row.key);
    let blockedSince = null;
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (String(history[i].to || "")
        .toLowerCase()
        .includes("block")) {
        blockedSince = history[i].at;
        break;
      }
    }
    const durationDays =
      blockedSince != null
        ? daysBetween(blockedSince, now)
        : row.ageDays ?? daysBetween(issue.updated, now);
    const isCarryover = carryoverKeys.has(row.key);
    return {
      issueKey: row.key,
      issueSummary: issue.summary || row.summary || "",
      blockedDurationDays: durationDays,
      sprintDaysRemaining: elapsed.remainingDays,
      carryover: isCarryover,
      lateAdded: addedKeys.has(row.key),
      assigneeDisplayName: issue.assigneeDisplayName || null,
      relatedDependency:
        (issue.dependencyLinks || []).find((link) => link.isBlocking)?.relatedKey ||
        null,
      explanation:
        isCarryover && durationDays != null
          ? `${row.key} carried over from the previous sprint and has been blocked for ${durationDays} day${
              durationDays === 1 ? "" : "s"
            }.${
              elapsed.remainingDays != null
                ? ` The sprint ends in ${elapsed.remainingDays} day${
                    elapsed.remainingDays === 1 ? "" : "s"
                  }.`
                : ""
            }`
          : durationDays != null && elapsed.remainingDays != null
            ? `${row.key} has been blocked for ${durationDays} day${
                durationDays === 1 ? "" : "s"
              }. The sprint ends in ${elapsed.remainingDays} day${
                elapsed.remainingDays === 1 ? "" : "s"
              }.`
            : `${row.key} is blocked.`,
    };
  });

  const lateScopeAdditions = (scope?.addedIssues || []).map((card) => {
    const issue = rows.find((item) => item.key === card.key) || card;
    const joinedAt = card.joinedAt || null;
    const joinedMs = toMs(joinedAt);
    const startMs = toMs(sprint?.activatedDate || sprint?.startDate);
    const endMs = toMs(sprint?.endDate);
    let elapsedAtAddition = null;
    if (joinedMs != null && startMs != null && endMs != null && endMs > startMs) {
      elapsedAtAddition = Math.round(
        Math.min(1, Math.max(0, (joinedMs - startMs) / (endMs - startMs))) * 100,
      );
    }
    const statusLower = String(issue.statusName || "").toLowerCase();
    return {
      issueKey: card.key,
      issueSummary: issue.summary || card.summary || "",
      addedAt: joinedAt,
      elapsedPercentAtAddition: elapsedAtAddition,
      estimated: estimateOf(issue) != null,
      startedImmediately:
        issue.statusCategoryKey === "indeterminate" || isDone(issue),
      blocked: statusLower.includes("block"),
      notStarted: issue.statusCategoryKey === "new",
    };
  });
  const lateAfterHalfway = lateScopeAdditions.filter(
    (row) =>
      row.elapsedPercentAtAddition != null && row.elapsedPercentAtAddition >= 50,
  );

  const statusChurn = [];
  const reopenedIssues = [];
  for (const issue of rows) {
    const history = historyFor(statusHistoriesByKey, issue.key);
    if (history.length < 2) {
      continue;
    }
    const pairCounts = new Map();
    let reopenEvents = 0;
    let priorCompletedStatus = null;
    let lastReopenAt = null;

    for (const change of history) {
      const fromCat = categoryOfName(change.from);
      const toCat = categoryOfName(change.to);
      if (fromCat === "done" && toCat && toCat !== "done") {
        reopenEvents += 1;
        priorCompletedStatus = change.from;
        lastReopenAt = change.at;
      }
      if (change.from && change.to && change.from !== change.to) {
        const pairKey = `${change.from}↔${change.to}`;
        const altKey = `${change.to}↔${change.from}`;
        const existing =
          pairCounts.get(pairKey) ||
          pairCounts.get(altKey) || {
            from: change.from,
            to: change.to,
            count: 0,
          };
        existing.count += 1;
        pairCounts.set(pairKey, existing);
      }
    }

    for (const pair of pairCounts.values()) {
      if (pair.count >= STATUS_CHURN_MIN_TRANSITIONS) {
        statusChurn.push({
          issueKey: issue.key,
          issueSummary: issue.summary,
          fromStatus: pair.from,
          toStatus: pair.to,
          transitionCount: pair.count,
          explanation: `${issue.key} moved between ${pair.from} and ${pair.to} ${pair.count} times.`,
        });
      }
    }

    if (reopenEvents > 0 && !isDone(issue)) {
      reopenedIssues.push({
        issueKey: issue.key,
        issueSummary: issue.summary,
        priorCompletedStatus,
        currentStatus: issue.statusName,
        reopeningDate: lastReopenAt,
        reopenEventCount: reopenEvents,
      });
    }
  }

  const byStatus = new Map();
  for (const issue of inProgressIssues) {
    const statusName = issue.statusName || "In Progress";
    if (!byStatus.has(statusName)) {
      byStatus.set(statusName, []);
    }
    byStatus.get(statusName).push(issue);
  }
  const workflowAccumulation = [];
  for (const [statusName, group] of byStatus.entries()) {
    if (group.length < WORKFLOW_ACCUMULATION_MIN_COUNT) {
      continue;
    }
    const aged = group.filter((issue) => {
      const history = historyFor(statusHistoriesByKey, issue.key);
      const enteredAt = history.length
        ? history[history.length - 1].at
        : issue.updated;
      const days = daysBetween(enteredAt, now);
      return days != null && days >= AGING_STATUS_DAYS;
    });
    workflowAccumulation.push({
      statusName,
      count: group.length,
      agedCount: aged.length,
      issueKeys: group.map((issue) => issue.key),
      explanation: `${group.length} issues are currently waiting in ${statusName}${
        aged.length
          ? `, including ${aged.length} that have been there for more than ${AGING_STATUS_DAYS} days`
          : ""
      }.`,
    });
  }

  const ownershipByAssignee = new Map();
  for (const issue of inProgressIssues) {
    const name = issue.assigneeDisplayName || "Unassigned";
    ownershipByAssignee.set(name, (ownershipByAssignee.get(name) || 0) + 1);
  }
  let ownershipConcentration = {
    capability: {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason: "Assignee distribution across active work was inspected.",
    },
    signal: null,
  };
  if (inProgressIssues.length >= OWNERSHIP_CONCENTRATION_MIN_ACTIVE) {
    let topName = null;
    let topCount = 0;
    for (const [name, count] of ownershipByAssignee.entries()) {
      if (name === "Unassigned") {
        continue;
      }
      if (count > topCount) {
        topName = name;
        topCount = count;
      }
    }
    if (
      topName &&
      topCount / inProgressIssues.length >= OWNERSHIP_CONCENTRATION_SHARE
    ) {
      ownershipConcentration = {
        capability: ownershipConcentration.capability,
        signal: {
          assigneeDisplayName: topName,
          activeOwned: topCount,
          activeTotal: inProgressIssues.length,
          explanation: `${topName} currently owns ${topCount} of the ${inProgressIssues.length} active issues. Review whether work can be redistributed.`,
          limitation: "This is a review signal, not a performance judgment.",
        },
      };
    }
  }

  const signals = [];
  if (elapsed.elapsedPercent != null) {
    signals.push({
      id: "time_vs_completion",
      severity:
        pacingState === PACING_STATE.BEHIND
          ? ATTENTION_LEVEL.HIGH
          : pacingState === PACING_STATE.WATCH
            ? ATTENTION_LEVEL.MEDIUM
            : ATTENTION_LEVEL.INFORMATIONAL,
      explanation: `${elapsed.elapsedPercent}% of sprint time has elapsed and ${completedPercent}% of committed work is complete (${
        measurementBasis === "story_points" ? "story points" : "issue counts"
      }).`,
      pacingState,
      measurementBasis,
    });
  }
  if (notStartedSignal.count > 0) {
    signals.push({
      id: "work_not_started",
      severity: notStartedSignal.urgency,
      explanation: notStartedSignal.explanation,
      ...notStartedSignal,
    });
  }
  if (wipSignal.highWip) {
    signals.push({
      id: "high_wip",
      severity: ATTENTION_LEVEL.HIGH,
      explanation: wipSignal.explanation,
      ...wipSignal,
    });
  }
  for (const row of agingWork) {
    signals.push({
      id: `aging-${row.issueKey}`,
      severity: ATTENTION_LEVEL.MEDIUM,
      explanation: row.explanation,
      ...row,
    });
  }
  for (const row of blockerDurations) {
    signals.push({
      id: `blocker-duration-${row.issueKey}`,
      severity: ATTENTION_LEVEL.HIGH,
      explanation: row.explanation,
      ...row,
    });
  }
  if (lateScopeAdditions.length) {
    signals.push({
      id: "late_scope_additions",
      severity:
        lateAfterHalfway.length > 0
          ? ATTENTION_LEVEL.HIGH
          : ATTENTION_LEVEL.MEDIUM,
      explanation: `${lateScopeAdditions.length} issue${
        lateScopeAdditions.length === 1 ? " was" : "s were"
      } added after sprint start${
        lateAfterHalfway.length
          ? `. ${lateAfterHalfway.length} ${
              lateAfterHalfway.length === 1 ? "was" : "were"
            } added after more than half of the sprint had elapsed`
          : ""
      }.`,
      additions: lateScopeAdditions,
    });
  }
  for (const row of statusChurn) {
    signals.push({
      id: `churn-${row.issueKey}`,
      severity: ATTENTION_LEVEL.MEDIUM,
      explanation: row.explanation,
      ...row,
    });
  }
  if (reopenedIssues.length) {
    signals.push({
      id: "reopened_work",
      severity: ATTENTION_LEVEL.HIGH,
      explanation: `${reopenedIssues.length} issue${
        reopenedIssues.length === 1 ? "" : "s"
      } returned from a completed status to active work during this sprint.`,
      issues: reopenedIssues,
    });
  }
  for (const row of workflowAccumulation) {
    signals.push({
      id: `accumulation-${row.statusName}`,
      severity: ATTENTION_LEVEL.MEDIUM,
      explanation: row.explanation,
      ...row,
    });
  }
  if (ownershipConcentration.signal) {
    signals.push({
      id: "ownership_concentration",
      severity: ATTENTION_LEVEL.MEDIUM,
      explanation: ownershipConcentration.signal.explanation,
      ...ownershipConcentration.signal,
    });
  }

  return {
    sprintPace: {
      elapsedPercent: elapsed.elapsedPercent,
      completedPercent,
      openWorkRemaining,
      measurementBasis,
      pacingState,
      capability: elapsed.capability,
      note: "Transparent pacing assessment — not an advanced forecast.",
    },
    workStateCounts: {
      done: doneIssues.length,
      inProgress: inProgressIssues.length,
      notStarted: notStartedIssues.length,
      open: openIssues.length,
      total: rows.length,
    },
    agingWork: {
      capability: agingCapability,
      items: agingWork,
    },
    blockerDurations: {
      capability: {
        status: CAPABILITY_STATUS.AVAILABLE,
        reason: "Blocked issues were enriched with duration and sprint timing context.",
      },
      items: blockerDurations,
    },
    lateScopeAdditions: {
      capability: scope?.capability || {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason: "Scope classification unavailable.",
      },
      items: lateScopeAdditions,
      lateAfterHalfwayCount: lateAfterHalfway.length,
    },
    statusChurn: {
      capability: {
        status:
          Object.keys(statusHistoriesByKey || {}).length > 0
            ? CAPABILITY_STATUS.AVAILABLE
            : CAPABILITY_STATUS.PARTIAL,
        reason:
          Object.keys(statusHistoriesByKey || {}).length > 0
            ? "Status transitions reconstructed from changelog samples."
            : "Status changelog sample was limited; churn detection may be incomplete.",
      },
      items: statusChurn,
    },
    reopenedIssues: {
      capability: {
        status:
          Object.keys(statusHistoriesByKey || {}).length > 0
            ? CAPABILITY_STATUS.AVAILABLE
            : CAPABILITY_STATUS.PARTIAL,
        reason: "Reopen detection uses Done→active transitions in changelog samples.",
      },
      items: reopenedIssues,
    },
    workflowAccumulation: {
      capability: {
        status: CAPABILITY_STATUS.AVAILABLE,
        reason: "Accumulation uses actual workflow status names from Jira.",
      },
      items: workflowAccumulation,
    },
    ownershipConcentration,
    signals,
  };
};
