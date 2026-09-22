/**
 * Presentation-only information architecture for the Delivery Intelligence
 * dashboard. Does not change health, readiness, pace, or coaching calculations.
 */

export const DASHBOARD_TABS = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "readiness", label: "Readiness", icon: "readiness" },
  { id: "pace", label: "Delivery Pace", icon: "pace" },
  { id: "scope", label: "Scope & Risk", icon: "scope" },
  { id: "learning", label: "Learning", icon: "learning" },
  { id: "briefs", label: "Briefs", icon: "briefs" },
];

export const READINESS_NAV_LABELS = {
  missing_description: "Missing descriptions",
  weak_description: "Weak descriptions",
  acceptance_criteria_not_detected: "AC not detected",
  missing_estimate: "Missing estimates",
  missing_assignee: "Unassigned",
  existing_blocker: "Existing blocker",
  carryover_entering: "Carryover",
  stale_at_sprint_start: "Stale at start",
  unusually_large: "Large relative",
  missing_parent: "Parent/dependency",
  dependency_risk: "Parent/dependency",
};

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

export const outlookNarrative = (snapshot = null, now = new Date()) => {
  const ended = isSprintEndPassed(snapshot?.sprint, now);
  const completed = snapshot?.completionPercent;
  const done = snapshot?.deliveryPace?.workStateCounts?.done;
  const stale = snapshot?.staleCount ?? 0;
  const blocked = snapshot?.blockedCount ?? 0;
  const growth = snapshot?.scopeChangePercent;
  const lead =
    ended && (completed === 0 || done === 0)
      ? "The sprint ended with no completed work."
      : ended
        ? `The sprint ended with ${completed ?? "—"}% of committed work complete.`
        : completed === 0 || done === 0
          ? "No committed work is complete yet."
          : `${completed ?? "—"}% of committed work is complete.`;
  const extras = [];
  if (growth != null && growth >= 100) {
    extras.push("scope more than doubled after start");
  } else if (growth != null && growth > 0) {
    extras.push(`scope increased ${growth}% after start`);
  }
  if (stale > 0) {
    extras.push(`${stale} issue${stale === 1 ? " is" : "s are"} stale`);
  }
  if (blocked > 0) {
    extras.push(
      blocked === 1 ? "one blocker remained unresolved" : `${blocked} blockers remained unresolved`,
    );
  }
  if (!extras.length) {
    return lead;
  }
  const clause = extras.length === 1
    ? extras[0]
    : `${extras.slice(0, -1).join(", ")}, and ${extras[extras.length - 1]}`;
  return `${lead} ${clause[0].toUpperCase()}${clause.slice(1)}.`;
};

export const recommendedNow = (snapshot = null) => {
  const coaching = (snapshot?.coachingInterventions || []).slice(0, 3);
  if (coaching.length) {
    return coaching.map((item) => ({
      id: `coach:${item.id}`,
      title: item.title,
      summary: item.suggestedIntervention || item.interpretation || item.evidence,
      drillId: `coach:${item.id}`,
    }));
  }
  const items = [];
  const topBlocked = [...(snapshot?.blockedIssues || [])].sort(
    (left, right) => (right.ageDays || 0) - (left.ageDays || 0),
  )[0];
  if (topBlocked) {
    items.push({
      id: "blocked",
      title: `Review unresolved blocker ${topBlocked.key}`,
      summary:
        topBlocked.ageDays != null
          ? `Blocked for ${topBlocked.ageDays} day${topBlocked.ageDays === 1 ? "" : "s"}.`
          : "Blocked work remains open.",
      drillId: "blocked",
    });
  }
  if ((snapshot?.staleCount || 0) > 0) {
    items.push({
      id: "stale",
      title: "Confirm status of stale work",
      summary: `${snapshot.staleCount} issue${
        snapshot.staleCount === 1 ? "" : "s"
      } had no updates for 7 or more days.`,
      drillId: "stale",
    });
  }
  if ((snapshot?.completionPercent || 0) === 0 || (snapshot?.deliveryPace?.workStateCounts?.done || 0) === 0) {
    items.push({
      id: "completion",
      title: "Replan unfinished scope",
      summary: "Consider finishing active work or moving unfinished items to the next sprint.",
      drillId: "completion",
    });
  } else if ((snapshot?.addedIssueCount || 0) > 0) {
    items.push({
      id: "added",
      title: "Review late-added work",
      summary: `${snapshot.addedIssueCount} issue${
        snapshot.addedIssueCount === 1 ? " was" : "s were"
      } added after sprint start.`,
      drillId: "added",
    });
  }
  return items.slice(0, 3);
};

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

export const ROVO_POLICY = {
  autoInvoke: false,
  note: "Rovo is user-triggered only and never runs on load or refresh. It may refine narrative but must not change objective metrics.",
};

export const BRIEF_MODES = [
  { id: "team", key: "teamUpdate", label: "Team update", audience: "Team" },
  { id: "leadership", key: "leadershipBrief", label: "Leadership brief", audience: "Leadership" },
  { id: "retro", key: "retrospectiveSummary", label: "Retrospective", audience: "Retrospective" },
];

export const BRIEF_INCLUDE_DEFAULTS = {
  health: true,
  pace: true,
  scope: true,
  risks: true,
  decisions: true,
  jira: true,
};

export const READINESS_CONVERSATIONS = {
  missing_description: "What problem are we solving, and for whom?",
  weak_description: "What outcome would make this issue clearly done?",
  acceptance_criteria_not_detected:
    'What does "done" look like for this issue? Which key scenarios should we validate?',
  missing_estimate: "What is the smallest useful slice we can finish this sprint?",
  missing_assignee: "Who owns the next concrete step, and by when?",
  existing_blocker: "What is the unblock path, and who owns removing it?",
  carryover_entering: "What made this hard to finish last time, and what will change?",
  stale_at_sprint_start: "Is this still the right work, or should we split or defer it?",
  unusually_large: "Can this be split so progress is visible this sprint?",
  missing_parent: "Which parent or epic should this work roll up to?",
  dependency_risk: "What external decision or team is this waiting on?",
};

export const READINESS_WHY = {
  missing_description: "Without a shared problem statement, teams often start work that later needs rework.",
  weak_description: "Short or placeholder descriptions make it harder to confirm done and estimate remaining effort.",
  acceptance_criteria_not_detected:
    "Without clear acceptance criteria, it is harder to confirm when the work is complete, increase rework risk, and calendar different definitions of done.",
  missing_estimate: "Unestimated work makes transparent pacing less reliable.",
  missing_assignee: "Unowned work tends to wait until someone claims the next step.",
  existing_blocker: "Blocked work rarely clears without an explicit owner for the dependency.",
  carryover_entering: "Carryover is a system signal about sizing, readiness, or interrupted focus.",
  stale_at_sprint_start: "Stale items often need a keep, split, or defer decision before more work starts.",
  unusually_large: "Oversized items hide aging WIP and make completion harder to see.",
  missing_parent: "Missing parent context can hide dependency and priority conversations.",
  dependency_risk: "External dependencies need an owner and a next check-in, not silent progress.",
};

const qualityScore = (findingCount, denominator) => {
  if (!denominator) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(100 - (findingCount / denominator) * 100)));
};

export const readinessDimensions = (snapshot = null) => {
  const counts = snapshot?.readiness?.counts || {};
  const open =
    snapshot?.openIssues?.length ||
    snapshot?.deliveryPace?.workStateCounts?.open ||
    Math.max(1, (snapshot?.currentIssueCount || 0) - (snapshot?.doneCount || 0));
  return [
    {
      id: "clarity",
      label: "Clarity",
      score: qualityScore(
        (counts.missingDescription || 0) + (counts.weakDescription || 0),
        open,
      ),
    },
    {
      id: "acceptance",
      label: "Acceptance criteria",
      score: qualityScore(counts.acceptanceCriteriaNotDetected || 0, open),
    },
    {
      id: "estimates",
      label: "Estimates",
      score: qualityScore(counts.missingEstimate || 0, open),
    },
    {
      id: "ownership",
      label: "Ownership",
      score: qualityScore(counts.missingAssignee || 0, open),
    },
    {
      id: "dependencies",
      label: "Dependencies",
      score: qualityScore(
        (counts.blockers || 0) + (counts.dependencyContext || 0),
        open,
      ),
    },
  ];
};

export const readinessHeadline = (snapshot = null) => {
  const counts = snapshot?.readiness?.counts || {};
  if ((counts.acceptanceCriteriaNotDetected || 0) >= (counts.missingEstimate || 0) &&
    (counts.acceptanceCriteriaNotDetected || 0) > 0) {
    return "Most readiness risk comes from unclear acceptance criteria and missing estimates.";
  }
  if ((counts.missingEstimate || 0) > 0) {
    return "Most readiness risk comes from missing estimates and incomplete issue quality.";
  }
  if ((snapshot?.readinessFindings || []).length === 0) {
    return "No high-volume readiness gaps were detected from current issue fields.";
  }
  return "Review the grouped readiness categories before starting more work.";
};

export const readinessIssueRows = (findings = [], issueIndex = new Map()) =>
  (findings || []).map((finding) => {
    const issue = issueIndex.get(finding.issueKey) || {};
    return {
      key: finding.issueKey,
      summary: issue.summary || finding.issueSummary || "",
      statusName: issue.statusName || null,
      severity: normalizeSeverity(finding.severity),
      evidence: finding.evidence || finding.explanation || "",
      explanation: finding.explanation || "",
      conversation: READINESS_CONVERSATIONS[finding.signalType] || "What is the next shared decision on this issue?",
      why: READINESS_WHY[finding.signalType] || finding.explanation || "",
      signalType: finding.signalType,
      confidence: "Heuristic — not an absolute judgment.",
    };
  });

export const filterIssueRows = (rows = [], { query = "", severity = "all" } = {}) => {
  const needle = String(query || "").trim().toLowerCase();
  return (rows || []).filter((row) => {
    if (severity !== "all" && normalizeSeverity(row.severity) !== normalizeSeverity(severity)) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return [row.key, row.summary, row.evidence, row.statusName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });
};

export const capabilityState = (capability = null, fallbackReason = "") => {
  const status = capability?.status || (capability ? "available" : "unavailable");
  return {
    status,
    reason: capability?.reason || fallbackReason || "This signal is unavailable.",
    tone: status === "available" ? "good" : status === "partial" ? "review" : "bad",
    label:
      status === "available"
        ? "Available"
        : status === "partial"
          ? "Partial data"
          : "Unavailable",
  };
};

export const paceFlow = (snapshot = null) => {
  const counts = snapshot?.deliveryPace?.workStateCounts || {};
  const total = counts.total || (counts.notStarted || 0) + (counts.inProgress || 0) + (counts.done || 0);
  return {
    notStarted: counts.notStarted || 0,
    inProgress: counts.inProgress || 0,
    done: counts.done || 0,
    total,
    elapsedPercent: snapshot?.sprintPace?.elapsedPercent,
    remainingPercent:
      snapshot?.sprintPace?.elapsedPercent == null
        ? null
        : Math.max(0, 100 - snapshot.sprintPace.elapsedPercent),
    basis: snapshot?.sprintPace?.measurementBasis === "story_points" ? "Story points" : "Issues",
    closed: isSprintEndPassed(snapshot?.sprint),
  };
};

export const paceWaitingStatuses = (signals = []) =>
  (signals || [])
    .filter((row) => String(row.id || "").startsWith("accumulation-") || row.statusName)
    .filter((row) => row.statusName && row.count)
    .map((row) => ({
      statusName: row.statusName,
      count: row.count,
    }));

export const coachInterpretations = (snapshot = null) => {
  const items = (snapshot?.coachingInterventions || []).filter(
    (row) => row.category === "pace" || row.category === "readiness" || row.category === "blocked",
  );
  if (items.length) {
    return items.slice(0, 3).map((row, index) => ({
      id: row.id,
      title: row.title,
      summary: row.suggestedIntervention || row.interpretation,
      index: index + 1,
    }));
  }
  const groups = groupPaceSignals(snapshot?.deliveryPace?.signals || []).slice(0, 3);
  return groups.map((group, index) => ({
    id: group.id,
    title: group.title,
    summary: group.explanation,
    index: index + 1,
  }));
};

export const buildScopeTimeline = (snapshot = null) => {
  const startValue = snapshot?.originalCommittedCount ?? 0;
  const startDate = snapshot?.sprint?.activatedDate || snapshot?.sprint?.startDate;
  const points = [
    {
      date: startDate || null,
      label: "Sprint start",
      cumulative: startValue,
      added: 0,
    },
  ];
  const dated = [...(snapshot?.addedIssues || [])]
    .filter((row) => row.joinedAt)
    .sort((left, right) => new Date(left.joinedAt) - new Date(right.joinedAt));
  const byDay = new Map();
  for (const issue of dated) {
    const day = new Date(issue.joinedAt).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }
  let running = startValue;
  for (const [day, added] of byDay) {
    running += added;
    points.push({
      date: `${day}T00:00:00.000Z`,
      label: day,
      cumulative: running,
      added,
    });
  }
  const current = snapshot?.currentIssueCount ?? running;
  if (points[points.length - 1].cumulative !== current) {
    points.push({
      date: snapshot?.generatedAt || null,
      label: "Current",
      cumulative: current,
      added: 0,
    });
  }
  return {
    points,
    removalsAvailable: snapshot?.capabilities?.scopeRemovals?.status === "available",
    removalsNote:
      snapshot?.capabilities?.scopeRemovals?.reason ||
      "Removed / de-scoped is unavailable. Reliable removal history is not available yet.",
  };
};

export const addedIssueRows = (snapshot = null, issueIndex = new Map()) => {
  const compound = new Map(
    (snapshot?.compoundRisks?.items || []).map((row) => [row.issueKey, row]),
  );
  const blocked = new Set((snapshot?.blockedIssues || []).map((row) => row.key));
  const stale = new Set((snapshot?.staleIssues || []).map((row) => row.key));
  return (snapshot?.addedIssues || snapshot?.addedIssueKeys || []).map((row) => {
    const key = row.key || row;
    const issue = typeof row === "object" ? row : issueIndex.get(key) || {};
    const risk = compound.get(key);
    return {
      key,
      summary: issue.summary || "",
      joinedAt: issue.joinedAt || null,
      estimate: issue.estimate ?? null,
      statusName: issue.statusName || null,
      severity: risk
        ? normalizeSeverity(risk.attentionLevel)
        : blocked.has(key)
          ? "high"
          : stale.has(key)
            ? "review"
            : "informational",
      riskCodes: risk?.riskCodes || [],
      evidence: risk?.evidence || [],
    };
  });
};

export const reliableSprintSeries = (snapshot = null, limit = 3) => {
  const series = snapshot?.historicalPatterns?.sprintSeries || [];
  const completed = series.filter((row) => !row.isCurrent && !row.partial).slice(0, limit);
  const current = series.find((row) => row.isCurrent) || null;
  return {
    current,
    completed,
    points: [...completed].reverse().concat(current ? [current] : []),
    capability: capabilityState(snapshot?.historicalPatterns?.capability),
  };
};

export const suggestedExperiments = (snapshot = null) =>
  (snapshot?.historicalPatterns?.patterns || []).slice(0, 2).map((pattern) => ({
    id: pattern.id,
    title: pattern.suggestedFocus || pattern.title,
    hypothesis: pattern.interpretation,
    evidence: pattern.evidence,
  }));

const BRIEF_HEADINGS = [
  "Where we are",
  "What needs attention",
  "Suggested next moves",
  "Executive summary",
  "Delivery risk",
  "Ask of leadership",
  "Observed patterns",
  "Discussion prompts",
  "Coaching reminders",
];

export const filterBriefPreview = ({
  brief = null,
  includes = BRIEF_INCLUDE_DEFAULTS,
  detail = "executive",
} = {}) => {
  if (!brief) {
    return { title: "", sections: [], plain: "", markdown: "" };
  }
  const hide = new Set();
  if (!includes.health) {
    hide.add("where we are");
  }
  if (!includes.risks) {
    hide.add("what needs attention");
    hide.add("delivery risk");
  }
  if (!includes.decisions) {
    hide.add("suggested next moves");
    hide.add("ask of leadership");
  }
  if (!includes.pace && !includes.scope) {
    hide.add("executive summary");
  }
  const lines = String(brief.plain || "").split("\n");
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (line === brief.title) {
      continue;
    }
    if (BRIEF_HEADINGS.includes(line)) {
      if (current) {
        sections.push(current);
      }
      current = { heading: line, body: [] };
      continue;
    }
    if (current && line.trim()) {
      current.body.push(line);
    }
  }
  if (current) {
    sections.push(current);
  }
  const kept = sections.filter((section) => !hide.has(String(section.heading || "").toLowerCase()));
  const limited = detail === "concise" ? kept.slice(0, 2) : kept;
  const plain = [brief.title, "", ...limited.flatMap((section) => [section.heading, ...section.body, ""])]
    .join("\n")
    .trim();
  return {
    title: brief.title,
    sections: limited,
    plain,
    markdown: brief.markdown,
  };
};

export const briefFacts = (snapshot = null) => [
  {
    label: "Sprint health score",
    value: snapshot?.healthScore != null ? `${snapshot.healthScore}/100` : "unavailable",
  },
  {
    label: "Completion",
    value:
      snapshot?.completionPercent != null
        ? `${snapshot.completionPercent}% of ${snapshot.currentIssueCount ?? "—"} issues`
        : "unavailable",
  },
  {
    label: "Scope change",
    value:
      snapshot?.scopeChangePercent != null
        ? `${snapshot.scopeChangePercent}% (${snapshot.originalCommittedCount ?? "—"} → ${
            snapshot.currentIssueCount ?? "—"
          })`
        : "unavailable",
  },
  {
    label: "Stale issues",
    value: snapshot?.staleCount != null ? `${snapshot.staleCount}` : "unavailable",
  },
];

export const jiraReferences = (snapshot = null, limit = 2) => {
  const keys = uniqueKeys([
    ...(snapshot?.blockedIssues || []).map((row) => row.key),
    ...(snapshot?.compoundRisks?.items || []).map((row) => row.issueKey),
    ...(snapshot?.addedIssueKeys || []),
  ]);
  return {
    shown: keys.slice(0, limit),
    extra: Math.max(0, keys.length - limit),
  };
};

export const findingsFilterOptions = (snapshot = null) =>
  [
    { id: "all", label: "All findings", keys: [] },
    { id: "blocked", label: "Blocked", keys: (snapshot?.blockedIssues || []).map((row) => row.key) },
    { id: "stale", label: "Stale", keys: (snapshot?.staleIssues || []).map((row) => row.key) },
    { id: "added", label: "Added after start", keys: snapshot?.addedIssueKeys || [] },
    { id: "carryover", label: "Carryover", keys: snapshot?.carryoverIssueKeys || [] },
    ...groupReadinessFindings(snapshot?.readinessFindings || []).map((group) => ({
      id: group.id,
      label: group.title,
      keys: group.issueKeys,
    })),
  ].filter((row) => row.id === "all" || (row.keys || []).length > 0);
