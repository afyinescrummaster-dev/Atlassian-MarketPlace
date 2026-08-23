/** Admin Health Lab v0.1 constants and transparent scoring weights. */

export const INACTIVE_DAYS = 90;

/** Projects with fewer than this many issues are "low volume" (excluding empty). */
export const LOW_VOLUME_MAX_ISSUES = 5;

export const PROJECT_TYPE_LABELS = {
  software: "Jira Software",
  service_desk: "Jira Service Management",
  business: "Business / Work Management",
};

/**
 * Deterministic score deductions. Each finding type has a per-item cost and a cap.
 * Start at 100, subtract, clamp to [0, 100].
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
