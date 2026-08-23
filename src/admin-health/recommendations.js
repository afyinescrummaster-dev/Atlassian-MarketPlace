/**
 * Build read-only recommendation cards from analysis findings.
 * No destructive or mutating actions.
 */
export const buildRecommendations = ({ fields, projects }) => {
  const cards = [];

  if (fields.duplicateGroupCount > 0) {
    cards.push({
      id: "duplicate-fields",
      title: `Review ${fields.duplicateGroupCount} similar custom field group${fields.duplicateGroupCount === 1 ? "" : "s"}`,
      summary:
        "Several fields have identical or nearly identical names after trim/case normalization. Confirm whether all are still required.",
      count: fields.duplicateGroupCount,
      actionLabel: "Review Fields",
      section: "fields",
    });
  }

  if (projects.potentiallyInactive > 0) {
    cards.push({
      id: "inactive-projects",
      title: `Review ${projects.potentiallyInactive} inactive project${projects.potentiallyInactive === 1 ? "" : "s"}`,
      summary: `These projects have not had issue activity within the last ${projects.inactiveDays} days.`,
      count: projects.potentiallyInactive,
      actionLabel: "Review Projects",
      section: "projects",
    });
  }

  if (projects.empty > 0) {
    cards.push({
      id: "empty-projects",
      title: `Review ${projects.empty} empty project${projects.empty === 1 ? "" : "s"}`,
      summary: "These projects currently contain no issues.",
      count: projects.empty,
      actionLabel: "Review Projects",
      section: "projects",
    });
  }

  if (projects.missingLead > 0) {
    cards.push({
      id: "missing-leads",
      title: `Review ${projects.missingLead} project${projects.missingLead === 1 ? "" : "s"} missing a lead`,
      summary:
        "Jira did not return a project lead for these projects. Confirm ownership is assigned.",
      count: projects.missingLead,
      actionLabel: "Review Projects",
      section: "projects",
    });
  }

  if (projects.lowVolume > 0) {
    cards.push({
      id: "low-volume",
      title: `Review ${projects.lowVolume} low-volume project${projects.lowVolume === 1 ? "" : "s"}`,
      summary: "These projects have very few issues and may be candidates for consolidation.",
      count: projects.lowVolume,
      actionLabel: "Review Projects",
      section: "projects",
    });
  }

  return cards;
};
