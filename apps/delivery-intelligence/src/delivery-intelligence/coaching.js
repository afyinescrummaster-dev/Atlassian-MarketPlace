import { CAPABILITY_STATUS } from "./constants.js";
import { ATTENTION_LEVEL, PACING_STATE } from "./thresholds.js";

const intervention = (row) => ({
  id: row.id,
  attentionLevel: row.attentionLevel || ATTENTION_LEVEL.MEDIUM,
  title: row.title,
  evidence: row.evidence || "",
  interpretation: row.interpretation || "",
  suggestedIntervention: row.suggestedIntervention || "",
  issueKeys: row.issueKeys || [],
  category: row.category || "coaching",
  confidence: row.confidence || "medium",
  limitation: row.limitation || null,
});

/**
 * Deterministic coaching interventions.
 * Always distinguish Evidence / Interpretation / Suggested intervention.
 * Careful language: no false certainty on AC; no employee performance language.
 */
export const buildCoachingInterventions = ({
  readiness = null,
  pace = null,
  compoundRisks = null,
  scope = null,
  carryover = null,
  blocked = null,
  comparison = null,
} = {}) => {
  const items = [];

  const highReadiness = (readiness?.findings || []).filter(
    (row) =>
      row.severity === ATTENTION_LEVEL.HIGH ||
      row.severity === ATTENTION_LEVEL.CRITICAL,
  );
  if (highReadiness.length > 0) {
    items.push(
      intervention({
        id: "clarify-high-readiness-risks",
        attentionLevel: ATTENTION_LEVEL.HIGH,
        title: "Clarify high-risk readiness gaps before more work starts",
        evidence: `${highReadiness.length} open issue${
          highReadiness.length === 1 ? "" : "s"
        } have high-severity readiness findings (for example missing description, blockers, or carryover).`,
        interpretation:
          "Starting unclear or blocked work often creates mid-sprint thrash. These signals suggest shared understanding or dependency resolution still needs attention.",
        suggestedIntervention:
          "Pick the top two high-severity issues and confirm problem statement, completion conditions, owner, and blockers in the next standup.",
        issueKeys: highReadiness.slice(0, 5).map((row) => row.issueKey).filter(Boolean),
        category: "readiness",
      }),
    );
  }

  const acFindings = (readiness?.findings || []).filter(
    (row) => row.signalType === "acceptance_criteria_not_detected",
  );
  if (acFindings.length > 0) {
    items.push(
      intervention({
        id: "confirm-completion-conditions",
        attentionLevel: ATTENTION_LEVEL.MEDIUM,
        title: "Confirm completion conditions where criteria were not detected",
        evidence: `No acceptance criteria were detected for ${acFindings.length} open issue${
          acFindings.length === 1 ? "" : "s"
        } in the description or recognized custom fields.`,
        interpretation:
          "This does not prove criteria are missing. Criteria may live in another field, linked docs, or team conversation. Still, undetected completion conditions are a common source of rework.",
        suggestedIntervention:
          "Ask the Product Owner to confirm the expected outcome and done conditions for the highest-priority issues in this list.",
        issueKeys: acFindings.slice(0, 5).map((row) => row.issueKey),
        category: "readiness",
        confidence: "medium",
        limitation:
          "Acceptance criteria detection is best-effort and must not be treated as proof that criteria are absent.",
      }),
    );
  }

  if (pace?.sprintPace?.pacingState === PACING_STATE.BEHIND) {
    items.push(
      intervention({
        id: "rebalance-pace",
        attentionLevel: ATTENTION_LEVEL.HIGH,
        title: "Rebalance finishing versus starting",
        evidence: pace.signals?.find((row) => row.id === "time_vs_completion")
          ?.explanation ||
          `${pace.sprintPace.elapsedPercent}% of sprint time has elapsed while ${pace.sprintPace.completedPercent}% of work is complete.`,
        interpretation:
          "Elapsed time is outpacing completion on a transparent issue-count or estimate basis. This is a pacing signal, not a forecast and not a judgment of individual speed.",
        suggestedIntervention:
          "Agree which in-progress items to finish first, and pause starting additional work until WIP drops.",
        category: "pace",
      }),
    );
  }

  const highWip = pace?.signals?.find((row) => row.id === "high_wip");
  if (highWip) {
    items.push(
      intervention({
        id: "finish-active-wip",
        attentionLevel: ATTENTION_LEVEL.HIGH,
        title: "Finish active work before opening more",
        evidence: highWip.explanation,
        interpretation:
          "The team appears to be starting faster than it is finishing. High WIP often hides blocked or aging items.",
        suggestedIntervention:
          "Make finishing the default for today: swarm on the oldest in-progress items and avoid new starts unless unblock work requires it.",
        category: "pace",
      }),
    );
  }

  const criticalCompound = (compoundRisks?.items || []).filter(
    (row) => row.attentionLevel === ATTENTION_LEVEL.CRITICAL,
  );
  if (criticalCompound.length > 0) {
    items.push(
      intervention({
        id: "escalate-compound-risks",
        attentionLevel: ATTENTION_LEVEL.CRITICAL,
        title: "Treat compound-risk issues as coach attention items",
        evidence: `${criticalCompound.length} issue${
          criticalCompound.length === 1 ? "" : "s"
        } combine multiple risk signals (for example carryover plus blocked).`,
        interpretation:
          "Stacked risks usually need facilitation, not just more status updates. These items are unlikely to resolve through silent progress alone.",
        suggestedIntervention:
          "Time-box a focused review for each critical compound-risk issue: owner, blocker removal path, and keep/split/defer decision.",
        issueKeys: criticalCompound.slice(0, 5).map((row) => row.issueKey),
        category: "compound",
      }),
    );
  }

  if ((scope?.addedIssueCount || 0) > 0) {
    items.push(
      intervention({
        id: "protect-sprint-focus",
        attentionLevel:
          scope.scopeChangePercent != null && scope.scopeChangePercent >= 30
            ? ATTENTION_LEVEL.HIGH
            : ATTENTION_LEVEL.MEDIUM,
        title: "Protect sprint focus after scope growth",
        evidence: `${scope.addedIssueCount} issue${
          scope.addedIssueCount === 1 ? " was" : "s were"
        } added after sprint start${
          scope.scopeChangePercent != null
            ? ` (${scope.scopeChangePercent}% growth vs original commitment)`
            : ""
        }.`,
        interpretation:
          "Late additions can be valid, but they compete with the original commitment and often arrive with less shared context.",
        suggestedIntervention:
          "Review added issues for readiness and explicit trade-offs against original commitment before more work is started.",
        issueKeys: (scope.addedIssueKeys || []).slice(0, 5),
        category: "scope",
      }),
    );
  }

  if ((carryover?.carryoverCount || 0) > 0) {
    items.push(
      intervention({
        id: "break-carryover-pattern",
        attentionLevel: ATTENTION_LEVEL.HIGH,
        title: "Inspect carryover causes before rolling work forward again",
        evidence: `${carryover.carryoverCount} open issue${
          carryover.carryoverCount === 1 ? "" : "s"
        } carried from the previous completed sprint.`,
        interpretation:
          "Carryover is a system signal. Common causes include oversized work, unclear readiness, hidden dependencies, or interrupted focus — not individual performance.",
        suggestedIntervention:
          "For each carryover item, name one likely cause and one concrete change (split, clarify, unblock, or de-scope) before the next planning event.",
        issueKeys: (carryover.carryoverIssueKeys || []).slice(0, 5),
        category: "carryover",
      }),
    );
  }

  if ((blocked?.blockedCount || 0) > 0) {
    items.push(
      intervention({
        id: "unblock-paths",
        attentionLevel: ATTENTION_LEVEL.HIGH,
        title: "Make unblock ownership explicit",
        evidence: `${blocked.blockedCount} open issue${
          blocked.blockedCount === 1 ? " is" : "s are"
        } currently blocked.`,
        interpretation:
          "Blocked work rarely clears without an explicit owner for the dependency or decision.",
        suggestedIntervention:
          "For each blocked issue, record who owns removing the blocker and when the next check-in is.",
        issueKeys: (blocked.blockedIssues || []).slice(0, 5).map((row) => row.key),
        category: "blocked",
      }),
    );
  }

  const deteriorated = (comparison?.rows || []).filter(
    (row) => row.direction === "deteriorated",
  );
  if (deteriorated.length > 0) {
    items.push(
      intervention({
        id: "learn-from-trend",
        attentionLevel: ATTENTION_LEVEL.MEDIUM,
        title: "Use the previous-sprint trend as a learning prompt",
        evidence: `${deteriorated.length} compared metric${
          deteriorated.length === 1 ? "" : "s"
        } moved in a less healthy direction versus the previous completed sprint.`,
        interpretation:
          "Trend shifts are prompts for team learning, not proof of lasting decline. Sample size is small when only one prior sprint is available.",
        suggestedIntervention:
          "Pick one deteriorated metric and ask what systemic change would make the next sprint easier — then capture that as a retrospective experiment.",
        category: "learning",
      }),
    );
  }

  const rank = {
    [ATTENTION_LEVEL.CRITICAL]: 0,
    [ATTENTION_LEVEL.HIGH]: 1,
    [ATTENTION_LEVEL.MEDIUM]: 2,
    [ATTENTION_LEVEL.INFORMATIONAL]: 3,
  };
  items.sort(
    (a, b) =>
      (rank[a.attentionLevel] ?? 9) - (rank[b.attentionLevel] ?? 9) ||
      String(a.id).localeCompare(String(b.id)),
  );

  return {
    interventions: items.slice(0, 10),
    capability: {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason:
        "Coaching interventions are deterministic summaries of sprint evidence. They are suggestions, not mandates.",
    },
  };
};

/**
 * Lightweight retrospective question prompts derived from observed patterns.
 */
export const buildRetrospectiveQuestions = ({
  coachingInterventions = [],
  historicalPatterns = null,
  readiness = null,
  pace = null,
} = {}) => {
  const questions = [];

  if ((readiness?.counts?.carryover || 0) > 0) {
    questions.push(
      "What made carryover items hard to finish last time, and what will we change before planning them again?",
    );
  }
  if ((readiness?.counts?.missingDescription || 0) > 0) {
    questions.push(
      "Where did unclear problem statements show up, and how will we spot them earlier next sprint?",
    );
  }
  if (pace?.sprintPace?.pacingState === PACING_STATE.BEHIND || pace?.signals?.some((s) => s.id === "high_wip")) {
    questions.push(
      "When did we start more work than we could finish, and what WIP limit would have helped?",
    );
  }
  if ((historicalPatterns?.patterns || []).some((row) => row.id === "recurring_carryover")) {
    questions.push(
      "Carryover is recurring across recent sprints — what systemic constraint keeps work rolling forward?",
    );
  }
  if (coachingInterventions.some((row) => row.category === "scope")) {
    questions.push(
      "Which mid-sprint additions were truly urgent, and which could have waited for the next planning event?",
    );
  }

  if (questions.length === 0) {
    questions.push(
      "What is one small experiment that would make the next sprint feel clearer or calmer?",
    );
  }

  return {
    questions: questions.slice(0, 6),
    capability: {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason: "Retrospective questions are derived from observed sprint signals.",
    },
  };
};
