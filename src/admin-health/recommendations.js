import { CLASSIFICATION } from "./constants.js";

/**
 * Build read-only recommendation cards from analysis findings.
 * Cards are drill-down actions (view + filter) — never destructive.
 */
export const buildRecommendations = ({ fields, projects, findings }) => {
  const cards = [];
  const high = findings?.bySeverity?.High || 0;

  if (high > 0) {
    cards.push({
      id: "high-priority",
      title: `Review ${high} high-priority finding${high === 1 ? "" : "s"}`,
      summary:
        "These findings are marked High (for example strong archive candidates). Review evidence before any admin action — this app does not change Jira.",
      count: high,
      actionLabel: "View high priority",
      section: "projects",
      filter: CLASSIFICATION.STRONG_ARCHIVE,
      severity: "High",
    });
  }

  if (fields.duplicateGroupCount > 0) {
    cards.push({
      id: "duplicate-fields",
      title: `Review ${fields.duplicateGroupCount} duplicate custom field group${fields.duplicateGroupCount === 1 ? "" : "s"}`,
      summary:
        fields.typeMismatchGroupCount > 0
          ? `${fields.typeMismatchGroupCount} group${fields.typeMismatchGroupCount === 1 ? "" : "s"} also mix field types under the same name. Identical names do not automatically mean fields should be deleted.`
          : "Several fields have identical names after trim/case normalization. Confirm whether all are still required — do not assume they should be deleted.",
      count: fields.duplicateGroupCount,
      actionLabel: "Review fields",
      section: "fields",
      filter: "duplicates",
      severity: "Review",
    });
  }

  if (projects.strongArchiveCandidates > 0) {
    cards.push({
      id: "strong-archive",
      title: `Review ${projects.strongArchiveCandidates} strong archive candidate${projects.strongArchiveCandidates === 1 ? "" : "s"}`,
      summary:
        "Live projects with no/low issues and no activity for at least a year (or empty with no activity timestamp). Admin Health Lab never archives projects.",
      count: projects.strongArchiveCandidates,
      actionLabel: "View candidates",
      section: "projects",
      filter: CLASSIFICATION.STRONG_ARCHIVE,
      severity: "High",
    });
  }

  if (projects.potentiallyInactive > 0) {
    cards.push({
      id: "inactive-projects",
      title: `Review ${projects.potentiallyInactive} inactive project${projects.potentiallyInactive === 1 ? "" : "s"}`,
      summary: `These projects have not had issue activity within the last ${projects.inactiveDays} days.`,
      count: projects.potentiallyInactive,
      actionLabel: "View inactive",
      section: "projects",
      filter: "inactive",
      severity: "Review",
    });
  }

  if (projects.empty > 0) {
    cards.push({
      id: "empty-projects",
      title: `Review ${projects.empty} empty project${projects.empty === 1 ? "" : "s"}`,
      summary: "These projects currently contain no issues.",
      count: projects.empty,
      actionLabel: "View empty",
      section: "projects",
      filter: "empty",
      severity: "Review",
    });
  }

  if (projects.missingLead > 0) {
    cards.push({
      id: "missing-leads",
      title: `Review ${projects.missingLead} project${projects.missingLead === 1 ? "" : "s"} missing a lead`,
      summary:
        "Jira did not return a project lead for these projects. Confirm ownership is assigned.",
      count: projects.missingLead,
      actionLabel: "View ownership",
      section: "projects",
      filter: "missing-lead",
      severity: "Review",
    });
  }

  if (projects.lowVolume > 0) {
    cards.push({
      id: "low-volume",
      title: `Review ${projects.lowVolume} low-volume project${projects.lowVolume === 1 ? "" : "s"}`,
      summary: "These projects have very few issues and may be candidates for consolidation.",
      count: projects.lowVolume,
      actionLabel: "View low volume",
      section: "projects",
      filter: "low-volume",
      severity: "Informational",
    });
  }

  if (projects.reviewForArchive > 0) {
    cards.push({
      id: "review-archive",
      title: `Review ${projects.reviewForArchive} project${projects.reviewForArchive === 1 ? "" : "s"} for archive`,
      summary:
        "No issue activity for at least 180 days with modest issue volume. Confirm purpose before considering archival.",
      count: projects.reviewForArchive,
      actionLabel: "View archive reviews",
      section: "projects",
      filter: CLASSIFICATION.REVIEW_ARCHIVE,
      severity: "Review",
    });
  }

  return cards;
};
