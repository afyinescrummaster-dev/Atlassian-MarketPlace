import { CAPABILITY_STATUS } from "./constants.js";

export const COMPARISON_METRICS = [
  {
    key: "healthScore",
    label: "Health",
    polarity: "higher-better",
  },
  {
    key: "scopeChangePercent",
    label: "Scope Growth",
    polarity: "lower-better",
  },
  {
    key: "completionPercent",
    label: "Completion",
    polarity: "higher-better",
  },
  {
    key: "carryoverCount",
    label: "Carryover",
    polarity: "lower-better",
  },
  {
    key: "blockedCount",
    label: "Blocked",
    polarity: "lower-better",
  },
  {
    key: "staleCount",
    label: "Stale",
    polarity: "lower-better",
  },
];

export const pickComparableMetrics = (snapshot) => ({
  healthScore: snapshot?.healthScore ?? null,
  scopeChangePercent: snapshot?.scopeChangePercent ?? null,
  completionPercent: snapshot?.completionPercent ?? null,
  carryoverCount: snapshot?.carryoverCount ?? null,
  blockedCount: snapshot?.blockedCount ?? null,
  staleCount: snapshot?.staleCount ?? null,
});

const directionFor = (polarity, delta) => {
  if (delta == null) {
    return "unknown";
  }
  if (delta === 0) {
    return "unchanged";
  }
  const improved = polarity === "higher-better" ? delta > 0 : delta < 0;
  return improved ? "improved" : "deteriorated";
};

const summarizeSprint = (sprint) => {
  if (!sprint) {
    return null;
  }
  return {
    id: sprint.id ?? null,
    name: sprint.name || null,
    startDate: sprint.startDate || sprint.activatedDate || null,
    completeDate: sprint.completeDate || sprint.endDate || null,
  };
};

export const compareSprintMetrics = ({
  current = null,
  previous = null,
  previousSprint = null,
  reason = null,
} = {}) => {
  if (!previousSprint) {
    return {
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason: reason || "No previous completed sprint was found on this board.",
      },
      previousSprint: null,
      previousSprintMetrics: null,
      metricDeltas: null,
      rows: [],
    };
  }

  if (!previous) {
    return {
      capability: {
        status: CAPABILITY_STATUS.UNAVAILABLE,
        reason:
          reason ||
          "Previous sprint metrics could not be loaded, so historical comparison is unavailable.",
      },
      previousSprint: summarizeSprint(previousSprint),
      previousSprintMetrics: null,
      metricDeltas: null,
      rows: [],
    };
  }

  const rows = COMPARISON_METRICS.map((metric) => {
    const currentValue = current?.[metric.key] ?? null;
    const previousValue = previous?.[metric.key] ?? null;
    const comparable = currentValue != null && previousValue != null;
    const delta = comparable ? currentValue - previousValue : null;
    return {
      key: metric.key,
      label: metric.label,
      polarity: metric.polarity,
      current: currentValue,
      previous: previousValue,
      delta,
      direction: directionFor(metric.polarity, delta),
    };
  });

  const missing = rows.filter((row) => row.current == null || row.previous == null);
  const capability = missing.length
    ? {
        status: CAPABILITY_STATUS.PARTIAL,
        reason:
          reason ||
          "Some previous-sprint metrics are incomplete, so only comparable values are shown.",
      }
    : {
        status: CAPABILITY_STATUS.AVAILABLE,
        reason: "Compared with the immediately previous completed sprint on this board.",
      };

  return {
    capability,
    previousSprint: summarizeSprint(previousSprint),
    previousSprintMetrics: previous,
    metricDeltas: Object.fromEntries(
      rows.map((row) => [row.key, { delta: row.delta, direction: row.direction }]),
    ),
    rows,
  };
};
