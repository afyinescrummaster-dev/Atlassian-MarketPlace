/**
 * Central thresholds for readiness, pace, and coaching heuristics.
 * Keep magic numbers here so tests and product copy stay aligned.
 */

import { STALE_DAYS } from "./constants.js";

/** Meaningful words below this may need clarification (not automatically poor). */
export const WEAK_DESCRIPTION_WORD_THRESHOLD = 15;

/** Placeholder-only description phrases (case-insensitive). */
export const DESCRIPTION_PLACEHOLDERS = [
  "tbd",
  "todo",
  "n/a",
  "na",
  "none",
  "update later",
  "see title",
  "see summary",
  "coming soon",
  "placeholder",
];

/** Minimum estimated issues required before large-issue outlier detection. */
export const LARGE_ISSUE_MIN_COMPARISON_SAMPLE = 5;

/** Flag when estimate is at least this multiple of the sprint median. */
export const LARGE_ISSUE_MEDIAN_MULTIPLIER = 2.5;

/** Minimum story-point coverage (0–1) to prefer points over issue counts for pace. */
export const ESTIMATE_COVERAGE_FOR_POINTS = 0.7;

/** WIP vs completed ratio that suggests starting faster than finishing. */
export const HIGH_WIP_RATIO = 2;

/** Minimum issues in one active status to flag workflow accumulation. */
export const WORKFLOW_ACCUMULATION_MIN_COUNT = 3;

/** Days in the same active status before aging WIP signal. */
export const AGING_STATUS_DAYS = 3;

/** Share of active work on one assignee that warrants a review signal. */
export const OWNERSHIP_CONCENTRATION_SHARE = 0.5;

/** Minimum active issues before ownership concentration is evaluated. */
export const OWNERSHIP_CONCENTRATION_MIN_ACTIVE = 4;

/** Minimum transitions between a status pair to flag churn. */
export const STATUS_CHURN_MIN_TRANSITIONS = 3;

/** Sprint elapsed share that raises urgency for not-started committed work. */
export const NOT_STARTED_URGENCY_ELAPSED = 0.5;

/** Re-export accepted stale threshold for readiness “stale at start”. */
export const READINESS_STALE_DAYS = STALE_DAYS;

export const ATTENTION_LEVEL = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  INFORMATIONAL: "informational",
};

export const READINESS_ASSESSMENT = {
  READY: "Ready",
  REVIEW_RECOMMENDED: "Review recommended",
  NEEDS_ATTENTION: "Needs attention",
  PARTIAL_DATA: "Partial data",
};

export const PACING_STATE = {
  ON_PACE: "on_pace",
  WATCH: "watch",
  BEHIND: "behind_current_pace",
  UNAVAILABLE: "unavailable",
};

export const AC_DETECTION = {
  DETECTED: "detected",
  NOT_DETECTED: "not_detected",
  UNAVAILABLE: "unavailable",
  NOT_APPLICABLE: "not_applicable",
};
