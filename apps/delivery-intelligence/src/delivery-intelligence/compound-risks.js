import { CAPABILITY_STATUS } from "./constants.js";
import { ATTENTION_LEVEL } from "./thresholds.js";

const LEVEL_RANK = {
  [ATTENTION_LEVEL.CRITICAL]: 0,
  [ATTENTION_LEVEL.HIGH]: 1,
  [ATTENTION_LEVEL.MEDIUM]: 2,
  [ATTENTION_LEVEL.INFORMATIONAL]: 3,
};

const bump = (current, next) => {
  if (!current) {
    return next;
  }
  return (LEVEL_RANK[next] ?? 9) < (LEVEL_RANK[current] ?? 9) ? next : current;
};

const ensureIssue = (byKey, issueKey, issueSummary = "") => {
  if (!byKey.has(issueKey)) {
    byKey.set(issueKey, {
      issueKey,
      issueSummary: issueSummary || "",
      attentionLevel: ATTENTION_LEVEL.INFORMATIONAL,
      riskCodes: [],
      evidence: [],
      explanations: [],
      signals: [],
    });
  }
  return byKey.get(issueKey);
};

const addSignal = (row, signal) => {
  row.attentionLevel = bump(row.attentionLevel, signal.attentionLevel);
  if (signal.riskCode && !row.riskCodes.includes(signal.riskCode)) {
    row.riskCodes.push(signal.riskCode);
  }
  if (signal.evidence) {
    row.evidence.push(signal.evidence);
  }
  if (signal.explanation) {
    row.explanations.push(signal.explanation);
  }
  row.signals.push(signal);
};

/**
 * Consolidate per-issue risks from readiness, pace, blocked, stale, and scope.
 * Attention levels are deterministic: critical > high > medium > informational.
 */
export const computeCompoundRisks = ({
  issues = [],
  readinessFindings = [],
  paceSignals = [],
  blocked = null,
  stale = null,
  scope = null,
  carryover = null,
} = {}) => {
  const byKey = new Map();
  const issueByKey = new Map((issues || []).map((issue) => [issue.key, issue]));

  for (const finding of readinessFindings || []) {
    if (!finding?.issueKey) {
      continue;
    }
    const row = ensureIssue(byKey, finding.issueKey, finding.issueSummary);
    const level =
      finding.severity === ATTENTION_LEVEL.CRITICAL
        ? ATTENTION_LEVEL.CRITICAL
        : finding.severity === ATTENTION_LEVEL.HIGH
          ? ATTENTION_LEVEL.HIGH
          : finding.severity === ATTENTION_LEVEL.INFORMATIONAL
            ? ATTENTION_LEVEL.INFORMATIONAL
            : ATTENTION_LEVEL.MEDIUM;
    addSignal(row, {
      source: "readiness",
      riskCode: finding.signalType,
      attentionLevel: level,
      evidence: finding.evidence,
      explanation: finding.explanation,
    });
  }

  for (const card of blocked?.blockedIssues || []) {
    if (!card?.key) {
      continue;
    }
    const issue = issueByKey.get(card.key);
    const row = ensureIssue(byKey, card.key, issue?.summary || card.summary || "");
    addSignal(row, {
      source: "blocked",
      riskCode: "blocked",
      attentionLevel: ATTENTION_LEVEL.HIGH,
      evidence:
        card.ageDays != null
          ? `Blocked for ${card.ageDays} day(s).`
          : "Blocked status, label, or link detected.",
      explanation: `${card.key} is blocked while still open in the sprint.`,
    });
  }

  for (const card of stale?.staleIssues || []) {
    if (!card?.key) {
      continue;
    }
    const issue = issueByKey.get(card.key);
    const row = ensureIssue(byKey, card.key, issue?.summary || card.summary || "");
    addSignal(row, {
      source: "stale",
      riskCode: "stale",
      attentionLevel: ATTENTION_LEVEL.MEDIUM,
      evidence: `No update for ${card.ageDays ?? "unknown"} day(s).`,
      explanation: `${card.key} has gone stale while still open.`,
    });
  }

  const carryoverKeys = new Set(carryover?.carryoverIssueKeys || []);
  const addedKeys = new Set(scope?.addedIssueKeys || []);

  for (const signal of paceSignals || []) {
    const keys = [];
    if (signal.issueKey) {
      keys.push(signal.issueKey);
    }
    if (Array.isArray(signal.issueKeys)) {
      keys.push(...signal.issueKeys);
    }
    if (Array.isArray(signal.issues)) {
      keys.push(...signal.issues.map((row) => row.issueKey).filter(Boolean));
    }
    if (Array.isArray(signal.additions)) {
      keys.push(...signal.additions.map((row) => row.issueKey).filter(Boolean));
    }
    if (Array.isArray(signal.items)) {
      keys.push(...signal.items.map((row) => row.issueKey).filter(Boolean));
    }

    for (const key of [...new Set(keys)]) {
      const issue = issueByKey.get(key);
      const row = ensureIssue(byKey, key, issue?.summary || "");
      addSignal(row, {
        source: "pace",
        riskCode: signal.id || "pace_signal",
        attentionLevel: signal.severity || ATTENTION_LEVEL.MEDIUM,
        evidence: signal.explanation || "",
        explanation: signal.explanation || "",
      });
    }
  }

  for (const [key, row] of byKey.entries()) {
    const compoundCodes = [];
    if (carryoverKeys.has(key) && row.riskCodes.includes("blocked")) {
      compoundCodes.push("carryover_and_blocked");
      row.attentionLevel = bump(row.attentionLevel, ATTENTION_LEVEL.CRITICAL);
    }
    if (carryoverKeys.has(key) && row.riskCodes.includes("stale")) {
      compoundCodes.push("carryover_and_stale");
      row.attentionLevel = bump(row.attentionLevel, ATTENTION_LEVEL.HIGH);
    }
    if (addedKeys.has(key) && row.riskCodes.includes("blocked")) {
      compoundCodes.push("late_added_and_blocked");
      row.attentionLevel = bump(row.attentionLevel, ATTENTION_LEVEL.HIGH);
    }
    if (
      row.riskCodes.includes("missing_description") &&
      row.riskCodes.includes("missing_assignee")
    ) {
      compoundCodes.push("unclear_and_unowned");
      row.attentionLevel = bump(row.attentionLevel, ATTENTION_LEVEL.HIGH);
    }
    if (
      row.riskCodes.includes("existing_blocker") &&
      row.riskCodes.includes("stale_at_sprint_start")
    ) {
      compoundCodes.push("blocked_and_stale_context");
      row.attentionLevel = bump(row.attentionLevel, ATTENTION_LEVEL.CRITICAL);
    }
    for (const code of compoundCodes) {
      if (!row.riskCodes.includes(code)) {
        row.riskCodes.push(code);
      }
    }
    row.summary =
      row.explanations[0] ||
      `${row.issueKey} has ${row.riskCodes.length} risk signal${
        row.riskCodes.length === 1 ? "" : "s"
      }.`;
  }

  const items = [...byKey.values()].sort(
    (a, b) =>
      (LEVEL_RANK[a.attentionLevel] ?? 9) - (LEVEL_RANK[b.attentionLevel] ?? 9) ||
      String(a.issueKey).localeCompare(String(b.issueKey)),
  );

  const counts = {
    critical: items.filter((row) => row.attentionLevel === ATTENTION_LEVEL.CRITICAL)
      .length,
    high: items.filter((row) => row.attentionLevel === ATTENTION_LEVEL.HIGH).length,
    medium: items.filter((row) => row.attentionLevel === ATTENTION_LEVEL.MEDIUM)
      .length,
    informational: items.filter(
      (row) => row.attentionLevel === ATTENTION_LEVEL.INFORMATIONAL,
    ).length,
    total: items.length,
  };

  return {
    items,
    counts,
    capability: {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason: "Compound risks were consolidated from deterministic sprint signals.",
    },
  };
};
