import { CAPABILITY_STATUS } from "./constants.js";
import { daysBetween, isBlockedIssue, isDone } from "./normalize.js";
import {
  detectAcceptanceCriteria,
  evaluateDescriptionQuality,
} from "./description-quality.js";
import {
  ATTENTION_LEVEL,
  LARGE_ISSUE_MEDIAN_MULTIPLIER,
  LARGE_ISSUE_MIN_COMPARISON_SAMPLE,
  NOT_STARTED_URGENCY_ELAPSED,
  READINESS_ASSESSMENT,
  READINESS_STALE_DAYS,
  WEAK_DESCRIPTION_WORD_THRESHOLD,
} from "./thresholds.js";

const finding = (row) => ({
  severity: row.severity || ATTENTION_LEVEL.MEDIUM,
  issueKey: row.issueKey || null,
  issueSummary: row.issueSummary || "",
  signalType: row.signalType,
  evidence: row.evidence || "",
  explanation: row.explanation || "",
  suggestedAction: row.suggestedAction || "",
  drillDown: row.drillDown || "readiness",
  confidence: row.confidence || "medium",
  limitation: row.limitation || null,
  jiraPath: row.issueKey ? `/browse/${row.issueKey}` : null,
});

const median = (values) => {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

const estimateValue = (issue) => {
  const value = issue?.estimate;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
};

const sprintElapsedShare = (sprint, now) => {
  const start = sprint?.activatedDate || sprint?.startDate;
  const end = sprint?.endDate;
  if (!start || !end) {
    return null;
  }
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const nowMs = now.getTime();
  if (!(endMs > startMs)) {
    return null;
  }
  return Math.min(1, Math.max(0, (nowMs - startMs) / (endMs - startMs)));
};

const dependencyContextFindings = (issue) => {
  const findings = [];
  const issueType = (issue.issueType || "").toLowerCase();
  const isSubtask =
    issueType.includes("sub-task") ||
    issueType.includes("subtask") ||
    Boolean(issue.subtask);

  if (isSubtask && !issue.parentKey) {
    findings.push(
      finding({
        severity: ATTENTION_LEVEL.HIGH,
        issueKey: issue.key,
        issueSummary: issue.summary,
        signalType: "missing_parent",
        evidence: "Issue type indicates a sub-task, but no valid parent was returned.",
        explanation: `${issue.key} appears to be a sub-task without a valid parent. Confirm parent context before execution.`,
        suggestedAction: "Confirm the parent issue and whether this work still belongs in the sprint.",
        confidence: "high",
      }),
    );
  }

  for (const link of issue.dependencyLinks || []) {
    if (!link?.relatedKey) {
      continue;
    }
    const relatedDone = link.relatedStatusCategoryKey === "done";
    if (relatedDone) {
      continue;
    }
    const blocking =
      link.relationship === "is_blocked_by" ||
      link.relationship === "blocks" ||
      link.isBlocking;
    if (!blocking && link.relationship !== "depends_on") {
      continue;
    }
    findings.push(
      finding({
        severity: ATTENTION_LEVEL.HIGH,
        issueKey: issue.key,
        issueSummary: issue.summary,
        signalType: "dependency_risk",
        evidence: `${link.relationship || "dependency"} ${link.relatedKey}${
          link.relatedStatusName ? ` (${link.relatedStatusName})` : ""
        }${link.relatedInSprint === false ? "; related issue is outside the current sprint" : ""}.`,
        explanation: `${issue.key} has an unresolved dependency on ${link.relatedKey}. Confirm whether delivery can proceed.`,
        suggestedAction: "Review the dependency owner and whether sprint scope must change.",
        confidence: "high",
      }),
    );
  }

  return findings;
};

/**
 * Deterministic sprint readiness. Sprint goal is never scored or penalized.
 */
export const computeReadiness = ({
  issues = [],
  sprint = null,
  scope = null,
  carryover = null,
  blocked = null,
  estimation = null,
  now = new Date(),
  staleDays = READINESS_STALE_DAYS,
  acceptanceCriteriaFieldId = null,
} = {}) => {
  const findings = [];
  const capabilities = {
    descriptionQuality: {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason: "Descriptions were inspected from issue fields.",
    },
    acceptanceCriteriaDetection: {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason:
        "Acceptance criteria detection uses description patterns and recognized custom fields when present.",
    },
    estimationCoverage: estimation?.capability || {
      status: CAPABILITY_STATUS.UNAVAILABLE,
      reason: "Estimation model was not provided.",
    },
    assignmentCoverage: {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason: "Assignee fields were inspected.",
    },
    largeIssueDetection: {
      status: CAPABILITY_STATUS.UNAVAILABLE,
      reason: "Insufficient estimated issues for outlier comparison.",
    },
    dependencyContext: {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason: "Parent and explicit issue-link dependencies were inspected where returned.",
    },
  };

  const carryoverKeys = new Set(carryover?.carryoverIssueKeys || []);
  const blockedByKey = new Map(
    (blocked?.blockedIssues || []).map((row) => [row.key, row]),
  );
  const addedKeys = new Set(scope?.addedIssueKeys || []);
  const committedKeys = new Set(scope?.originalCommittedIssueKeys || []);
  const elapsed = sprintElapsedShare(sprint, now);
  const sprintStart = sprint?.activatedDate || sprint?.startDate || null;

  const estimatedValues = (issues || [])
    .map(estimateValue)
    .filter((value) => value != null);
  const sprintMedian = median(estimatedValues);
  if (
    estimatedValues.length >= LARGE_ISSUE_MIN_COMPARISON_SAMPLE &&
    sprintMedian != null &&
    sprintMedian > 0
  ) {
    capabilities.largeIssueDetection = {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason: `Compared against median estimate ${sprintMedian} across ${estimatedValues.length} estimated issues.`,
    };
  } else if (estimation?.capability?.status === CAPABILITY_STATUS.UNAVAILABLE) {
    capabilities.largeIssueDetection = {
      status: CAPABILITY_STATUS.UNAVAILABLE,
      reason: estimation.capability.reason,
    };
  }

  for (const issue of issues || []) {
    if (!issue?.key || isDone(issue)) {
      continue;
    }

    const descriptionEval = evaluateDescriptionQuality({
      description: issue.description,
      summary: issue.summary,
      wordThreshold: WEAK_DESCRIPTION_WORD_THRESHOLD,
    });

    if (descriptionEval.state === "missing") {
      findings.push(
        finding({
          severity: ATTENTION_LEVEL.HIGH,
          issueKey: issue.key,
          issueSummary: issue.summary,
          signalType: "missing_description",
          evidence: "Normalized description contains no meaningful text.",
          explanation: `${issue.key} does not contain a description. Confirm that the team understands the problem, expected outcome, and relevant constraints.`,
          suggestedAction: "Clarify the problem statement and expected outcome before starting.",
          confidence: "high",
        }),
      );
    } else if (descriptionEval.state === "weak") {
      const detailParts = [];
      if (descriptionEval.reasons.includes("short")) {
        detailParts.push(
          `its description contains only ${descriptionEval.wordCount} meaningful word${
            descriptionEval.wordCount === 1 ? "" : "s"
          }`,
        );
      }
      if (descriptionEval.reasons.includes("placeholder")) {
        detailParts.push("the description looks like placeholder text");
      }
      if (descriptionEval.reasons.includes("repeats_summary")) {
        detailParts.push("the description largely repeats the summary");
      }
      findings.push(
        finding({
          severity: ATTENTION_LEVEL.MEDIUM,
          issueKey: issue.key,
          issueSummary: issue.summary,
          signalType: "weak_description",
          evidence: `Description quality signals: ${descriptionEval.reasons.join(", ")}.`,
          explanation: `${issue.key} may need clarification. ${
            detailParts.length
              ? detailParts[0].charAt(0).toUpperCase() + detailParts[0].slice(1)
              : "Its description appears thin"
          }.`,
          suggestedAction: "Confirm unanswered product or technical questions before execution.",
          confidence: "medium",
          limitation: "A short description is not automatically poor.",
        }),
      );
    }

    const ac = detectAcceptanceCriteria({
      description: issue.description,
      customFields: issue.customFields || null,
      configuredFieldId: acceptanceCriteriaFieldId,
      descriptionAvailable: issue.description !== undefined,
    });
    if (ac.state === "not_detected") {
      findings.push(
        finding({
          severity: ATTENTION_LEVEL.MEDIUM,
          issueKey: issue.key,
          issueSummary: issue.summary,
          signalType: "acceptance_criteria_not_detected",
          evidence: ac.limitation,
          explanation: `No acceptance criteria were detected for ${issue.key}. Confirm whether the expected outcome and completion conditions are clear.`,
          suggestedAction: "Clarify completion conditions with the Product Owner before execution.",
          confidence: ac.confidence,
          limitation: ac.limitation,
        }),
      );
    } else if (ac.state === "unavailable") {
      capabilities.acceptanceCriteriaDetection = {
        status: CAPABILITY_STATUS.PARTIAL,
        reason: ac.limitation,
      };
    }

    if (
      estimation?.capability?.status === CAPABILITY_STATUS.AVAILABLE ||
      estimation?.capability?.status === CAPABILITY_STATUS.PARTIAL
    ) {
      if (estimateValue(issue) == null && estimation?.usable) {
        findings.push(
          finding({
            severity: ATTENTION_LEVEL.MEDIUM,
            issueKey: issue.key,
            issueSummary: issue.summary,
            signalType: "missing_estimate",
            evidence: `Board estimation field ${estimation.fieldId || "configured"} has no value on this issue.`,
            explanation: `${issue.key} does not have an estimate. Confirm whether the team has enough shared understanding to plan and sequence this work.`,
            suggestedAction: "Decide whether estimation is needed for sequencing this issue.",
            confidence: "high",
          }),
        );
      }
    }

    if (!issue.assigneeDisplayName) {
      let severity = ATTENTION_LEVEL.MEDIUM;
      const urgencyReasons = [];
      if (issue.statusCategoryKey === "indeterminate") {
        severity = ATTENTION_LEVEL.HIGH;
        urgencyReasons.push("already in progress");
      }
      if (isBlockedIssue(issue) || blockedByKey.has(issue.key)) {
        severity = ATTENTION_LEVEL.HIGH;
        urgencyReasons.push("blocked");
      }
      if (addedKeys.has(issue.key)) {
        urgencyReasons.push("added after sprint start");
      }
      if (elapsed != null && elapsed >= 0.75) {
        severity = ATTENTION_LEVEL.HIGH;
        urgencyReasons.push("close to the end of the sprint");
      }
      findings.push(
        finding({
          severity,
          issueKey: issue.key,
          issueSummary: issue.summary,
          signalType: "missing_assignee",
          evidence: urgencyReasons.length
            ? `Unassigned; ${urgencyReasons.join("; ")}.`
            : "Assignee field is empty.",
          explanation: urgencyReasons.includes("already in progress")
            ? `${issue.key} is in progress but has no assignee. Confirm who owns the next action.`
            : `${issue.key} has no assignee. Review ownership for this sprint work.`,
          suggestedAction: "Confirm who owns the next action.",
          confidence: "high",
          limitation: "Assignment is not assumed mandatory for every team.",
        }),
      );
    }

    if (isBlockedIssue(issue) || blockedByKey.has(issue.key)) {
      const blockedCard = blockedByKey.get(issue.key);
      const ageDays = blockedCard?.ageDays ?? daysBetween(issue.updated, now);
      findings.push(
        finding({
          severity: ATTENTION_LEVEL.HIGH,
          issueKey: issue.key,
          issueSummary: issue.summary,
          signalType: "existing_blocker",
          evidence:
            issue.blockedLinksCount > 0
              ? `Blocked via status/label/links; ${issue.blockedLinksCount} blocking relationship(s)${
                  ageDays != null ? `; last update ${ageDays} day(s) ago` : ""
                }.`
              : `Blocked status or label detected${
                  ageDays != null ? `; last update ${ageDays} day(s) ago` : ""
                }.`,
          explanation:
            ageDays != null
              ? `${issue.key} is blocked${ageDays != null ? ` and has been without a clear unblock signal for about ${ageDays} day(s)` : ""}.`
              : `${issue.key} is blocked.`,
          suggestedAction: "Confirm ownership for removing the blocker and re-plan if needed.",
          confidence: "high",
        }),
      );
    }

    if (carryoverKeys.has(issue.key)) {
      const also = [];
      if (isBlockedIssue(issue)) {
        also.push("blocked");
      }
      if (daysBetween(issue.updated, now) >= staleDays) {
        also.push("stale");
      }
      const estimate = estimateValue(issue);
      if (
        estimate != null &&
        sprintMedian != null &&
        estimate >= sprintMedian * LARGE_ISSUE_MEDIAN_MULTIPLIER
      ) {
        also.push("unusually large");
      }
      findings.push(
        finding({
          severity: ATTENTION_LEVEL.HIGH,
          issueKey: issue.key,
          issueSummary: issue.summary,
          signalType: "carryover_entering",
          evidence: `Carried from the previous completed sprint${
            also.length ? `; also ${also.join(", ")}` : ""
          }.`,
          explanation: `${issue.key} entered this sprint as carryover. Review whether it was oversized, unclear, blocked, or deprioritized.`,
          suggestedAction: "Avoid rolling it forward again without discussing the cause.",
          confidence: "high",
        }),
      );
    }

    if (sprintStart) {
      const staleAtStartDays = daysBetween(issue.updated, sprintStart);
      if (staleAtStartDays != null && staleAtStartDays >= staleDays) {
        findings.push(
          finding({
            severity: ATTENTION_LEVEL.MEDIUM,
            issueKey: issue.key,
            issueSummary: issue.summary,
            signalType: "stale_at_sprint_start",
            evidence: `Last update was ${staleAtStartDays} day(s) before sprint start (threshold ${staleDays} days).`,
            explanation: `${issue.key} entered the sprint without an update in ${staleAtStartDays} days. Confirm that its information and priority are still current.`,
            suggestedAction: "Validate priority and whether the issue still belongs in this sprint.",
            confidence: "high",
          }),
        );
      }
    }

    if (capabilities.largeIssueDetection.status === CAPABILITY_STATUS.AVAILABLE) {
      const estimate = estimateValue(issue);
      if (
        estimate != null &&
        sprintMedian != null &&
        estimate >= sprintMedian * LARGE_ISSUE_MEDIAN_MULTIPLIER
      ) {
        findings.push(
          finding({
            severity: ATTENTION_LEVEL.MEDIUM,
            issueKey: issue.key,
            issueSummary: issue.summary,
            signalType: "unusually_large",
            evidence: `Estimate ${estimate} vs sprint median ${sprintMedian} (≥ ${LARGE_ISSUE_MEDIAN_MULTIPLIER}×).`,
            explanation: `${issue.key} is substantially larger than most estimated issues in this sprint. Confirm whether it can be completed independently or should be split.`,
            suggestedAction: "Discuss split options or sequencing with the team.",
            confidence: "medium",
            limitation: "This is a cautious heuristic, not an objective size judgment.",
          }),
        );
      }
    }

    findings.push(...dependencyContextFindings(issue));
  }

  // Sprint goal must never create readiness findings or penalties.
  void sprint?.goal;

  const severityRank = {
    [ATTENTION_LEVEL.CRITICAL]: 0,
    [ATTENTION_LEVEL.HIGH]: 1,
    [ATTENTION_LEVEL.MEDIUM]: 2,
    [ATTENTION_LEVEL.INFORMATIONAL]: 3,
  };
  findings.sort(
    (a, b) =>
      (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) ||
      String(a.issueKey || "").localeCompare(String(b.issueKey || "")),
  );

  const highCount = findings.filter(
    (row) =>
      row.severity === ATTENTION_LEVEL.HIGH ||
      row.severity === ATTENTION_LEVEL.CRITICAL,
  ).length;
  const partialCapability = Object.values(capabilities).some(
    (cap) =>
      cap.status === CAPABILITY_STATUS.PARTIAL ||
      cap.status === CAPABILITY_STATUS.UNAVAILABLE,
  );

  let assessment = READINESS_ASSESSMENT.READY;
  if (partialCapability && findings.length === 0) {
    assessment = READINESS_ASSESSMENT.PARTIAL_DATA;
  } else if (highCount >= 3 || findings.length >= 8) {
    assessment = READINESS_ASSESSMENT.NEEDS_ATTENTION;
  } else if (findings.length > 0) {
    assessment = READINESS_ASSESSMENT.REVIEW_RECOMMENDED;
  }

  const unestimatedCount = findings.filter(
    (row) => row.signalType === "missing_estimate",
  ).length;
  const unassignedCount = findings.filter(
    (row) => row.signalType === "missing_assignee",
  ).length;

  return {
    assessment,
    findings,
    counts: {
      totalFindings: findings.length,
      highOrCritical: highCount,
      missingDescription: findings.filter((r) => r.signalType === "missing_description")
        .length,
      weakDescription: findings.filter((r) => r.signalType === "weak_description").length,
      acceptanceCriteriaNotDetected: findings.filter(
        (r) => r.signalType === "acceptance_criteria_not_detected",
      ).length,
      missingEstimate: unestimatedCount,
      missingAssignee: unassignedCount,
      blockers: findings.filter((r) => r.signalType === "existing_blocker").length,
      carryover: findings.filter((r) => r.signalType === "carryover_entering").length,
      staleAtStart: findings.filter((r) => r.signalType === "stale_at_sprint_start").length,
      unusuallyLarge: findings.filter((r) => r.signalType === "unusually_large").length,
      dependencyContext: findings.filter(
        (r) =>
          r.signalType === "missing_parent" || r.signalType === "dependency_risk",
      ).length,
    },
    capabilities,
    descriptionQuality: {
      wordThreshold: WEAK_DESCRIPTION_WORD_THRESHOLD,
      staleDays,
    },
    acceptanceCriteriaDetection: capabilities.acceptanceCriteriaDetection,
    estimationCoverage: {
      ...capabilities.estimationCoverage,
      unestimatedCount:
        estimation?.usable != null ? unestimatedCount : null,
      estimatedIssueCount: estimatedValues.length,
      totalOpenIssues: (issues || []).filter((issue) => !isDone(issue)).length,
    },
    assignmentCoverage: {
      ...capabilities.assignmentCoverage,
      unassignedCount,
    },
    // Explicit product rule documentation in payload for Rovo/tests.
    sprintGoalPolicy: {
      affectsReadiness: false,
      note: "A missing sprint goal must not reduce readiness, generate a negative finding, or affect health.",
    },
    elapsedShare: elapsed,
    committedIssueCount: committedKeys.size || null,
    lateAddedUnassignedRaisesUrgencyAt: NOT_STARTED_URGENCY_ELAPSED,
  };
};
