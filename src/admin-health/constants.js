/** Admin Health Lab constants, scoring weights, and classification thresholds. */

export const INACTIVE_DAYS = 90;

/** Projects with fewer than this many issues are "low volume" (excluding empty). */
export const LOW_VOLUME_MAX_ISSUES = 5;

/**
 * Strong archive candidate: live, empty or extremely low volume, and no issue
 * activity for at least this many days (or empty with no activity timestamp).
 */
export const STRONG_ARCHIVE_DAYS = 365;

/** Review for archive: no issue activity for at least this many days. */
export const REVIEW_ARCHIVE_DAYS = 180;

/**
 * Issue count at or above this is treated as substantial history — prefer
 * "Investigate inactivity" over archive-oriented labels.
 */
export const LARGE_ISSUE_HISTORY = 100;

/** Max issues still considered "extremely low" for strong archive. */
export const STRONG_ARCHIVE_MAX_ISSUES = 5;

export const PROJECT_TYPE_LABELS = {
  software: "Jira Software",
  service_desk: "Jira Service Management",
  business: "Business / Work Management",
};

export const SEVERITY = {
  HIGH: "High",
  REVIEW: "Review",
  INFORMATIONAL: "Informational",
};

export const CATEGORY = {
  PROJECTS: "Projects",
  CUSTOM_FIELDS: "Custom Fields",
};

export const CLASSIFICATION = {
  STRONG_ARCHIVE: "strong-archive-candidate",
  REVIEW_ARCHIVE: "review-for-archive",
  INVESTIGATE: "investigate-inactivity",
  OWNERSHIP: "review-ownership",
  EMPTY: "review-empty",
  LOW_VOLUME: "review-low-volume",
  ARCHIVED: "archived",
};

export const CLASSIFICATION_LABELS = {
  [CLASSIFICATION.STRONG_ARCHIVE]: "Strong archive candidate",
  [CLASSIFICATION.REVIEW_ARCHIVE]: "Review for archive",
  [CLASSIFICATION.INVESTIGATE]: "Investigate inactivity",
  [CLASSIFICATION.OWNERSHIP]: "Review ownership",
  [CLASSIFICATION.EMPTY]: "Review empty project",
  [CLASSIFICATION.LOW_VOLUME]: "Review low volume",
  [CLASSIFICATION.ARCHIVED]: "Archived",
};

/**
 * Deterministic score deductions. Each finding type has a per-item cost and a cap.
 * Start at 100, subtract, clamp to [0, 100].
 * Unchanged in v0.2 — findings are the primary value; score remains a summary.
 */
export const SCORE_RULES = {
  start: 100,
  duplicateFieldGroup: { perItem: 3, max: 30 },
  emptyProject: { perItem: 5, max: 25 },
  inactiveProject: { perItem: 4, max: 24 },
  missingLead: { perItem: 2, max: 10 },
  lowVolumeProject: { perItem: 1, max: 5 },
};

export const SCORE_DISCLAIMER =
  "The score reflects configuration and project hygiene signals currently analyzed by Admin Health Lab. It is an advisory score, not an Atlassian-generated metric.";
