/**
 * Presentation-only information architecture for the Delivery Intelligence
 * dashboard. Does not change health, readiness, pace, or coaching calculations.
 */

export const DASHBOARD_TABS = [
  { id: "overview", label: "Overview" },
  { id: "readiness", label: "Readiness" },
  { id: "pace", label: "Delivery Pace" },
  { id: "scope", label: "Scope & Risk" },
  { id: "learning", label: "Learning" },
  { id: "briefs", label: "Briefs" },
];

export const READINESS_SIGNAL_TITLES = {
  missing_description: "Missing descriptions",
  weak_description: "Weak descriptions",
  acceptance_criteria_not_detected: "Acceptance criteria not detected",
  missing_estimate: "Missing estimates",
  missing_assignee: "Unassigned issues",
  existing_blocker: "Blockers",
  carryover_entering: "Carryover entering sprint",
  stale_at_sprint_start: "Stale at sprint start",
  unusually_large: "Unusually large issues",
  missing_parent: "Missing parent",
  dependency_risk: "Dependency risk",
};

export const PACE_SIGNAL_TITLES = {
  time_vs_completion: "Time versus completion",
  work_not_started: "Work not started",
  high_wip: "High work in progress",
  late_scope_additions: "Late scope additions",
  reopened_work: "Reopened work",
  ownership_concentration: "Ownership concentration",
};

export const PACE_GROUP_RULES = [
  { prefix: "aging-", groupId: "aging_work", title: "Aging work" },
  { prefix: "blocker-duration-", groupId: "long_running_blockers", title: "Long-running blockers" },
  { prefix: "churn-", groupId: "status_churn", title: "Status churn" },
  { prefix: "accumulation-", groupId: "workflow_accumulation", title: "Workflow accumulation" },
];

export const OVERVIEW_READINESS_CATEGORIES = [
  {
    countKey: "weakDescription",
    label: "Weak descriptions",
    signalType: "weak_description",
  },
  {
    countKey: "acceptanceCriteriaNotDetected",
    label: "AC not detected",
    signalType: "acceptance_criteria_not_detected",
  },
  {
    countKey: "missingEstimate",
    label: "Missing estimates",
    signalType: "missing_estimate",
  },
  {
    countKey: "missingAssignee",
    label: "Unassigned",
    signalType: "missing_assignee",
  },
  {
    countKey: "blockers",
    label: "Blockers",
    signalType: "existing_blocker",
  },
];

const SEVERITY_RANK = {
  critical: 0,
  high: 1,
  medium: 2,
  review: 2,
  informational: 3,
  info: 3,
};

const INTERNAL_ID_PATTERN = /^(aging|blocker-duration|churn|accumulation)-/i;

const humanize = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || "Finding";

const normalizeSeverity = (value) => {
  const raw = String(value || "").toLowerCase();
  if (raw === "critical") {
    return "critical";
  }
  if (raw === "high") {
    return "high";
  }
  if (raw === "informational" || raw === "info") {
    return "informational";
  }
  return "review";
};

const worseSeverity = (left, right) => {
  const a = normalizeSeverity(left);
  const b = normalizeSeverity(right);
  return (SEVERITY_RANK[a] ?? 9) <= (SEVERITY_RANK[b] ?? 9) ? a : b;
};

const bySeverityThenCount = (left, right) =>
  (SEVERITY_RANK[normalizeSeverity(left.severity)] ?? 9) -
    (SEVERITY_RANK[normalizeSeverity(right.severity)] ?? 9) ||
  (left.priority ?? 50) - (right.priority ?? 50) ||
  (right.count || 0) - (left.count || 0) ||
  String(left.title || "").localeCompare(String(right.title || ""));

const uniqueKeys = (values = []) =>
  [...new Set((values || []).filter(Boolean))];

const collectKeysFromSignal = (signal = {}) =>
  uniqueKeys([
    signal.issueKey,
    ...(signal.issueKeys || []),
    ...(signal.items || []).map((row) => row.issueKey || row.key),
    ...(signal.additions || []).map((row) => row.issueKey || row.key),
    ...(signal.issues || []).map((row) => row.issueKey || row.key),
  ]);

export const isSprintEndPassed = (sprint, now = new Date()) => {
  if (!sprint?.endDate) {
    return false;
  }
  const end = new Date(sprint.endDate);
  if (Number.isNaN(end.getTime())) {
    return false;
  }
  return now.getTime() > end.getTime();
};

export const readableSignalTitle = (id) => {
  const value = String(id || "");
  if (!value) {
    return "Delivery signal";
  }
  const grouped = PACE_GROUP_RULES.find((rule) => value.startsWith(rule.prefix));
  if (grouped) {
    return grouped.title;
  }
  if (PACE_SIGNAL_TITLES[value]) {
    return PACE_SIGNAL_TITLES[value];
  }
  if (READINESS_SIGNAL_TITLES[value]) {
    return READINESS_SIGNAL_TITLES[value];
  }
  if (INTERNAL_ID_PATTERN.test(value)) {
    return "Delivery signal";
  }
  return humanize(value);
};

export const groupReadinessFindings = (findings = []) => {
  const groups = new Map();
  for (const finding of findings || []) {
    const type = finding.signalType || "other";
    if (!groups.has(type)) {
      groups.set(type, {
        id: `readiness:${type}`,
        groupId: type,
        title: READINESS_SIGNAL_TITLES[type] || humanize(type),
        severity: normalizeSeverity(finding.severity),
        count: 0,
        issueKeys: [],
        findings: [],
        explanation: finding.explanation || "",
        suggestedAction: "View affected issues",
      });
    }
    const group = groups.get(type);
    group.count += 1;
    group.findings.push(finding);
    if (finding.issueKey) {
      group.issueKeys = uniqueKeys([...group.issueKeys, finding.issueKey]);
    }
    group.severity = worseSeverity(group.severity, finding.severity);
  }
  return [...groups.values()].sort(bySeverityThenCount);
};

export const groupPaceSignals = (signals = []) => {
  const groups = new Map();

  const push = (groupId, title, signal) => {
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: `pace:${groupId}`,
        groupId,
        title,
        severity: normalizeSeverity(signal.severity),
        count: 0,
        issueKeys: [],
        signals: [],
        explanation: signal.explanation || "",
        suggestedAction: "View details",
      });
    }
    const group = groups.get(groupId);
    group.count += 1;
    group.signals.push(signal);
    group.severity = worseSeverity(group.severity, signal.severity);
    group.issueKeys = uniqueKeys([...group.issueKeys, ...collectKeysFromSignal(signal)]);
    if (signal.explanation && group.count === 1) {
      group.explanation = signal.explanation;
    }
  };

  for (const signal of signals || []) {
    const id = String(signal.id || "");
    const rule = PACE_GROUP_RULES.find((row) => id.startsWith(row.prefix));
    if (rule) {
      push(rule.groupId, rule.title, signal);
      continue;
    }
    push(id || "pace", PACE_SIGNAL_TITLES[id] || readableSignalTitle(id), signal);
  }

  return [...groups.values()].sort(bySeverityThenCount);
};

export const overviewReadinessCounts = (readiness = null) => {
  const counts = readiness?.counts || {};
  return OVERVIEW_READINESS_CATEGORIES.map((row) => ({
    key: row.countKey,
    label: row.label,
    count: counts[row.countKey] ?? 0,
    drillId: `readiness:${row.signalType}`,
    signalType: row.signalType,
  }));
};

const blockedAttentionItem = (blockedIssues = []) => {
  if (!blockedIssues.length) {
    return null;
  }
  const ranked = [...blockedIssues].sort(
    (left, right) => (right.ageDays || 0) - (left.ageDays || 0),
  );
  const top = ranked[0];
  const useSpecificTitle =
    blockedIssues.length === 1 || (top?.ageDays != null && top.ageDays >= 7);
  return {
    id: "blocked",
    severity: "high",
    title: useSpecificTitle
      ? top.ageDays != null
        ? `${top.key} blocked for ${top.ageDays} day${top.ageDays === 1 ? "" : "s"}`
        : `${top.key} is blocked`
      : `Blocked work affecting ${blockedIssues.length} issues`,
    summary:
      blockedIssues.length === 1
        ? "Blocked status or label detected on an open issue."
        : `${blockedIssues.length} open issues have a blocked status or label.`,
    count: blockedIssues.length,
    issueKeys: uniqueKeys(blockedIssues.map((row) => row.key)),
    drillId: "blocked",
    priority: 0,
    suggestedAction: blockedIssues.length === 1 ? "View issue" : "View blocked issues",
  };
};

export const buildCoachAttentionItems = (snapshot = null) => {
  const items = [];
  const blocked = blockedAttentionItem(snapshot?.blockedIssues || []);
  if (blocked) {
    items.push(blocked);
  }

  if ((snapshot?.addedIssueCount || 0) > 0) {
    items.push({
      id: "added",
      severity: "review",
      title: `Scope increased ${snapshot.scopeChangePercent ?? 0}%`,
      summary: `${snapshot.addedIssueCount} issue${
        snapshot.addedIssueCount === 1 ? " was" : "s were"
      } added after start.`,
      count: snapshot.addedIssueCount,
      issueKeys: snapshot.addedIssueKeys || [],
      drillId: "added",
      priority: 2,
      suggestedAction: "View details",
    });
  }

  if ((snapshot?.staleCount || 0) > 0) {
    items.push({
      id: "stale",
      severity: "review",
      title: `Stale work affecting ${snapshot.staleCount} issue${
        snapshot.staleCount === 1 ? "" : "s"
      }`,
      summary: "Issues with no update for 7 or more days are marked stale.",
      count: snapshot.staleCount,
      issueKeys: (snapshot.staleIssues || []).map((row) => row.key),
      drillId: "stale",
      priority: 3,
      suggestedAction: "View stale issues",
    });
  }

  if ((snapshot?.carryoverCount || 0) > 0) {
    items.push({
      id: "carryover",
      severity: "high",
      title: `Carryover affecting ${snapshot.carryoverCount} issue${
        snapshot.carryoverCount === 1 ? "" : "s"
      }`,
      summary: "Open work carried from the previous completed sprint.",
      count: snapshot.carryoverCount,
      issueKeys: snapshot.carryoverIssueKeys || [],
      drillId: "carryover",
      priority: 1,
      suggestedAction: "View carryover issues",
    });
  }

  for (const group of groupReadinessFindings(snapshot?.readinessFindings || [])) {
    if (group.groupId === "existing_blocker" || group.groupId === "stale_at_sprint_start") {
      continue;
    }
    items.push({
      id: group.id,
      severity: group.severity,
      title: `${group.title} affecting ${group.count} issue${group.count === 1 ? "" : "s"}`,
      summary: group.explanation,
      count: group.count,
      issueKeys: group.issueKeys,
      drillId: group.id,
      priority: 10,
      suggestedAction: "View affected issues",
    });
  }

  for (const item of snapshot?.coachingInterventions || []) {
    items.push({
      id: `coach:${item.id}`,
      severity: item.attentionLevel,
      title: item.title,
      summary: item.evidence,
      interpretation: item.interpretation,
      suggestedIntervention: item.suggestedIntervention,
      limitation: item.limitation || null,
      count: (item.issueKeys || []).length,
      issueKeys: item.issueKeys || [],
      drillId: `coach:${item.id}`,
      priority: 15,
      suggestedAction: "View details",
    });
  }

  // Pace groups stay on the Delivery Pace tab so Overview attention
  // remains a short list of consolidated risks, not per-signal cards.

  const seen = new Set();
  return items
    .sort(bySeverityThenCount)
    .filter((item) => {
      if (seen.has(item.drillId)) {
        return false;
      }
      seen.add(item.drillId);
      return true;
    });
};

export const topCoachAttention = (snapshot, limit = 3) =>
  buildCoachAttentionItems(snapshot)
    .filter((item) => !String(item.id).startsWith("coach:"))
    .slice(0, limit);

export const allFindingsCount = (snapshot = null) =>
  snapshot?.readiness?.counts?.totalFindings ??
  (snapshot?.readinessFindings || []).length;

export const paceHeadline = (sprintPace, sprint, now = new Date()) => {
  if (isSprintEndPassed(sprint, now)) {
    return "Sprint end date passed";
  }
  const state = sprintPace?.pacingState;
  if (state === "behind_current_pace") {
    return "Behind current pace";
  }
  if (state === "on_pace") {
    return "On pace";
  }
  if (state === "watch") {
    return "Watch";
  }
  return "Pacing unavailable";
};

export const paceSummaryCopy = (sprintPace, sprint, now = new Date()) => {
  const elapsed = sprintPace?.elapsedPercent;
  const completed = sprintPace?.completedPercent;
  if (isSprintEndPassed(sprint, now)) {
    return `The sprint has ended. ${elapsed ?? "—"}% of sprint time has elapsed, and ${
      completed ?? "—"
    }% of committed work is complete. Consider finishing active work before starting additional issues.`;
  }
  return (
    sprintPace?.note ||
    "Transparent pacing assessment — not an advanced forecast."
  );
};

export const pickLearningInsight = (snapshot = null) => {
  const pattern = snapshot?.historicalPatterns?.patterns?.[0];
  if (pattern?.title) {
    return {
      title: pattern.title,
      summary: pattern.interpretation || pattern.evidence || pattern.suggestedFocus || "",
    };
  }
  const deteriorated = (snapshot?.comparison?.rows || []).filter(
    (row) => row.direction === "deteriorated",
  );
  if (deteriorated.length) {
    return {
      title: "Learning across sprints",
      summary: `${deteriorated.length} compared metric${
        deteriorated.length === 1 ? "" : "s"
      } moved in a less healthy direction versus the previous completed sprint.`,
    };
  }
  return {
    title: "Learning across sprints",
    summary:
      "Compare this sprint to previous ones to spot trends, recurring issues, and areas for improvement.",
  };
};

export const attentionLevelLabel = (severity) => {
  const value = normalizeSeverity(severity);
  if (value === "critical" || value === "high") {
    return "High";
  }
  if (value === "informational") {
    return "Info";
  }
  return "Review";
};

export const isInternalSignalId = (id) => INTERNAL_ID_PATTERN.test(String(id || ""));
