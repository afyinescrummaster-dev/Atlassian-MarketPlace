import { CAPABILITY_STATUS } from "./constants.js";
import { ATTENTION_LEVEL, PACING_STATE } from "./thresholds.js";

const line = (text) => (text ? `${text}\n` : "");

const bullet = (items) =>
  (items || [])
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join("\n");

const topIssueKeys = (items, limit = 5) =>
  (items || [])
    .map((row) => row.issueKey || row.key)
    .filter(Boolean)
    .slice(0, limit);

const formatBrief = ({ title, sections }) => {
  const plainParts = [title, ""];
  const mdParts = [`# ${title}`, ""];

  for (const section of sections) {
    if (!section?.heading) {
      continue;
    }
    plainParts.push(section.heading);
    plainParts.push(section.body || "");
    plainParts.push("");
    mdParts.push(`## ${section.heading}`);
    mdParts.push(section.body || "");
    mdParts.push("");
  }

  return {
    title,
    plain: plainParts.join("\n").trim(),
    markdown: mdParts.join("\n").trim(),
  };
};

/**
 * Deterministic briefs for team, leadership, and retrospective use.
 * Copy surfaces expose plain text and markdown.
 */
export const buildBriefs = ({
  snapshotCore,
  readiness = null,
  pace = null,
  compoundRisks = null,
  coachingInterventions = [],
  historicalPatterns = null,
  retrospectiveQuestions = null,
} = {}) => {
  const sprintName = snapshotCore?.sprint?.name || "the current sprint";
  const projectKey = snapshotCore?.context?.projectKey || "this project";
  const health =
    snapshotCore?.healthScore != null
      ? `${snapshotCore.healthScore}/100 (${snapshotCore.healthStatus || "n/a"})`
      : "unavailable";

  const attentionKeys = topIssueKeys(compoundRisks?.items || []);
  const interventions = (coachingInterventions || []).slice(0, 3);

  const team = formatBrief({
    title: `Team update — ${sprintName}`,
    sections: [
      {
        heading: "Where we are",
        body: [
          `Project ${projectKey}, sprint ${sprintName}.`,
          `Health ${health}. Completion ${snapshotCore?.completionPercent ?? "—"}%.`,
          pace?.sprintPace?.elapsedPercent != null
            ? `Sprint time elapsed ${pace.sprintPace.elapsedPercent}%; pacing state ${
                pace.sprintPace.pacingState || "unavailable"
              }.`
            : null,
          readiness?.assessment
            ? `Readiness assessment: ${readiness.assessment}.`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        heading: "What needs attention",
        body:
          bullet(
            [
              snapshotCore?.blockedCount
                ? `${snapshotCore.blockedCount} blocked issue(s)`
                : null,
              snapshotCore?.carryoverCount
                ? `${snapshotCore.carryoverCount} carryover issue(s)`
                : null,
              snapshotCore?.addedIssueCount
                ? `${snapshotCore.addedIssueCount} added after start`
                : null,
              compoundRisks?.counts?.critical
                ? `${compoundRisks.counts.critical} critical compound-risk issue(s)`
                : null,
              attentionKeys.length
                ? `Focus keys: ${attentionKeys.join(", ")}`
                : "No ranked compound-risk issues.",
            ].filter(Boolean),
          ) || "No major attention items from current signals.",
      },
      {
        heading: "Suggested next moves",
        body:
          bullet(
            interventions.map(
              (row) =>
                `${row.title}: ${row.suggestedIntervention}`,
            ),
          ) || "Continue monitoring blocked and stale work daily.",
      },
    ],
  });

  const leadership = formatBrief({
    title: `Leadership brief — ${sprintName}`,
    sections: [
      {
        heading: "Executive summary",
        body: [
          `${sprintName} in ${projectKey} is ${
            snapshotCore?.healthStatus || "unscored"
          } at ${snapshotCore?.healthScore ?? "—"}/100.`,
          `Original commitment ${
            snapshotCore?.originalCommittedCount ?? "—"
          }; current scope ${snapshotCore?.currentIssueCount ?? "—"}; added after start ${
            snapshotCore?.addedIssueCount ?? "—"
          }.`,
          `Blocked ${snapshotCore?.blockedCount ?? "—"}; carryover ${
            snapshotCore?.carryoverCount ?? "—"
          }; stale ${snapshotCore?.staleCount ?? "—"}.`,
        ].join("\n"),
      },
      {
        heading: "Delivery risk",
        body:
          bullet(
            [
              pace?.sprintPace?.pacingState === PACING_STATE.BEHIND
                ? "Transparent pacing is behind elapsed time."
                : null,
              readiness?.assessment === "Needs attention"
                ? "Sprint readiness needs attention before more work starts."
                : null,
              (compoundRisks?.counts?.critical || 0) > 0
                ? `${compoundRisks.counts.critical} issue(s) have critical stacked risks.`
                : null,
              (historicalPatterns?.patterns || [])[0]
                ? `Historical pattern: ${historicalPatterns.patterns[0].title}.`
                : null,
            ].filter(Boolean),
          ) || "No elevated leadership risks from current deterministic signals.",
      },
      {
        heading: "Ask of leadership",
        body:
          interventions[0]?.suggestedIntervention ||
          "Support blocker removal and protect focus if scope continues to grow.",
      },
    ],
  });

  const retro = formatBrief({
    title: `Retrospective summary — ${sprintName}`,
    sections: [
      {
        heading: "Observed patterns",
        body:
          bullet(
            [
              ...(historicalPatterns?.patterns || []).map(
                (row) => `${row.title}: ${row.evidence}`,
              ),
              snapshotCore?.scopeChangePercent != null
                ? `Scope growth this sprint: ${snapshotCore.scopeChangePercent}%.`
                : null,
              readiness?.counts?.carryover
                ? `Carryover entering this sprint: ${readiness.counts.carryover}.`
                : null,
            ].filter(Boolean),
          ) || "Limited historical pattern data was available.",
      },
      {
        heading: "Discussion prompts",
        body:
          bullet(retrospectiveQuestions?.questions || []) ||
          "- What is one experiment that would make the next sprint clearer?",
      },
      {
        heading: "Coaching reminders",
        body: [
          "Use evidence carefully: undetected acceptance criteria are not proof criteria are missing.",
          "Talk about systems and flow — not individual performance.",
          "Sprint goal presence or absence does not affect readiness or health scoring.",
        ].join("\n"),
      },
    ],
  });

  return {
    teamUpdate: team,
    leadershipBrief: leadership,
    retrospectiveSummary: retro,
    capability: {
      status: CAPABILITY_STATUS.AVAILABLE,
      reason: "Briefs are generated from deterministic snapshot facts only.",
    },
  };
};

export const briefAttentionTone = (level) => {
  if (level === ATTENTION_LEVEL.CRITICAL) {
    return "critical";
  }
  if (level === ATTENTION_LEVEL.HIGH) {
    return "high";
  }
  return "review";
};
