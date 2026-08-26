import {
  CLASSIFICATION,
  CLASSIFICATION_LABELS,
  LARGE_ISSUE_HISTORY,
  REVIEW_ARCHIVE_DAYS,
  SEVERITY,
  STRONG_ARCHIVE_DAYS,
  STRONG_ARCHIVE_MAX_ISSUES,
} from "./constants.js";

const issuesOf = (project) =>
  typeof project.totalIssueCount === "number" ? project.totalIssueCount : null;

/**
 * Deterministic primary recommendation for a project.
 *
 * Exact rules (evaluated in order, first match wins):
 *
 * 1. Archived → Informational "Archived"
 * 2. Strong archive candidate (High):
 *    - live (not archived)
 *    - empty OR issue count < STRONG_ARCHIVE_MAX_ISSUES (5)
 *    - AND (days since activity >= 365 OR empty with no activity timestamp)
 * 3. Review for archive (Review):
 *    - live
 *    - days since activity >= 180
 *    - issue count known and < LARGE_ISSUE_HISTORY (100)
 * 4. Investigate inactivity (Review):
 *    - flagged inactive (>= inactiveDays, default 90) and not empty
 *    - OR inactive with large issue history (>= 100)
 * 5. Review ownership (Review): missing lead on a live project
 * 6. Review empty project (Review): empty but not strong-archive
 * 7. Review low volume (Informational): low volume only
 * 8. null — no primary recommendation
 */
export const classifyProjectRecommendation = (project) => {
  if (project.archived) {
    return {
      code: CLASSIFICATION.ARCHIVED,
      label: CLASSIFICATION_LABELS[CLASSIFICATION.ARCHIVED],
      severity: SEVERITY.INFORMATIONAL,
      explanation:
        "This project is already archived in Jira. No archive action is suggested by Jira Admin Health.",
    };
  }

  const issues = issuesOf(project);
  const age = project.ageDays;
  const extremelyLow =
    project.empty || (issues != null && issues < STRONG_ARCHIVE_MAX_ISSUES);
  const noActivityTimestamp = project.empty && age == null;
  const staleYear = age != null && age >= STRONG_ARCHIVE_DAYS;

  if (extremelyLow && (staleYear || noActivityTimestamp)) {
    const volumeText = project.empty
      ? "contains no issues"
      : `has only ${issues} issue${issues === 1 ? "" : "s"}`;
    const ageText =
      age == null
        ? "and Jira returned no last-issue activity timestamp"
        : `and has had no issue activity for ${age} days`;

    return {
      code: CLASSIFICATION.STRONG_ARCHIVE,
      label: CLASSIFICATION_LABELS[CLASSIFICATION.STRONG_ARCHIVE],
      severity: SEVERITY.HIGH,
      explanation: `This live project ${volumeText} ${ageText}. It may be an archive candidate — confirm whether the project is still required. Jira Admin Health does not archive projects.`,
    };
  }

  if (
    age != null &&
    age >= REVIEW_ARCHIVE_DAYS &&
    issues != null &&
    issues < LARGE_ISSUE_HISTORY
  ) {
    return {
      code: CLASSIFICATION.REVIEW_ARCHIVE,
      label: CLASSIFICATION_LABELS[CLASSIFICATION.REVIEW_ARCHIVE],
      severity: SEVERITY.REVIEW,
      explanation: `No issue activity for ${age} days with a modest issue count (${issues}). Review whether this project still has an organizational purpose before considering archival.`,
    };
  }

  if (project.inactive && !project.empty) {
    if (issues != null && issues >= LARGE_ISSUE_HISTORY) {
      return {
        code: CLASSIFICATION.INVESTIGATE,
        label: CLASSIFICATION_LABELS[CLASSIFICATION.INVESTIGATE],
        severity: SEVERITY.REVIEW,
        explanation: `This project has been inactive beyond the configured threshold but contains a large issue history (${issues} issues). Review its current organizational purpose before considering archival.`,
      };
    }

    return {
      code: CLASSIFICATION.INVESTIGATE,
      label: CLASSIFICATION_LABELS[CLASSIFICATION.INVESTIGATE],
      severity: SEVERITY.REVIEW,
      explanation:
        age == null
          ? "This project is inactive beyond the configured threshold. Confirm whether work has moved elsewhere before changing its status."
          : `Last issue activity was ${age} days ago. Confirm whether this project is still needed.`,
    };
  }

  if (!project.leadPresent) {
    return {
      code: CLASSIFICATION.OWNERSHIP,
      label: CLASSIFICATION_LABELS[CLASSIFICATION.OWNERSHIP],
      severity: SEVERITY.REVIEW,
      explanation:
        "Jira did not return a project lead for this project. Confirm ownership is assigned so admins know who to contact.",
    };
  }

  if (project.empty) {
    return {
      code: CLASSIFICATION.EMPTY,
      label: CLASSIFICATION_LABELS[CLASSIFICATION.EMPTY],
      severity: SEVERITY.REVIEW,
      explanation:
        "This project currently contains no issues. Confirm it is intentional (for example a newly created project) before consolidating.",
    };
  }

  if (project.lowVolume) {
    return {
      code: CLASSIFICATION.LOW_VOLUME,
      label: CLASSIFICATION_LABELS[CLASSIFICATION.LOW_VOLUME],
      severity: SEVERITY.INFORMATIONAL,
      explanation: `Only ${issues} issue${issues === 1 ? "" : "s"} exist in this project. Low volume alone is not a reason to archive.`,
    };
  }

  return null;
};
