/** Delivery Intelligence v0.1 — deterministic thresholds (no Rovo). */

export const PRODUCT_NAME = "Delivery Intelligence for Jira";

export const VERSION = "0.1.0";

/** Days without an update while not Done → stale. */
export const STALE_DAYS = 7;

/** Max sprint issues analyzed per snapshot (pagination cap). */
export const MAX_SPRINT_ISSUES = 200;

/**
 * Jira often writes sprint-field history a few seconds after sprint activation
 * (activatedDate, else startDate). Joins in this window with no different prior
 * sprint are original commitment, not added scope.
 */
export const START_COMMITMENT_WINDOW_MS = 120000;

/** Max issues to fetch changelog history for (cost control). */
export const MAX_CHANGELOG_ISSUES = 40;

/** Sprint health score bands. */
export const HEALTH_STATUS = {
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  NEEDS_ATTENTION: "Needs Attention",
};

export const CAPABILITY_STATUS = {
  AVAILABLE: "available",
  PARTIAL: "partial",
  UNAVAILABLE: "unavailable",
};

export const SCORE_WEIGHTS = {
  scopeChange: { perTenPercent: 4, max: 20 },
  carryover: { perIssue: 3, max: 15 },
  blocked: { perIssue: 5, max: 20 },
  stale: { perIssue: 2, max: 10 },
  lowCompletion: { threshold: 50, penalty: 10 },
};
