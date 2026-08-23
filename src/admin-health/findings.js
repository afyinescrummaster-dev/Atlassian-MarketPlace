import { CATEGORY, SEVERITY } from "./constants.js";

/**
 * Build a consistent finding record. Keep this small so new checks plug in easily.
 */
export const createFinding = ({
  id,
  category,
  title,
  severity,
  affectedObject,
  reason,
  evidence = {},
  recommendation,
  classification = null,
  filterKeys = [],
}) => ({
  id,
  category,
  title,
  severity,
  affectedObject,
  reason,
  evidence,
  recommendation,
  classification,
  filterKeys,
});

export const summarizeFindings = (findings = []) => {
  const bySeverity = {
    [SEVERITY.HIGH]: 0,
    [SEVERITY.REVIEW]: 0,
    [SEVERITY.INFORMATIONAL]: 0,
  };
  const byCategory = {
    [CATEGORY.PROJECTS]: 0,
    [CATEGORY.CUSTOM_FIELDS]: 0,
  };

  for (const finding of findings) {
    if (bySeverity[finding.severity] != null) {
      bySeverity[finding.severity] += 1;
    }
    if (byCategory[finding.category] != null) {
      byCategory[finding.category] += 1;
    }
  }

  return {
    total: findings.length,
    bySeverity,
    byCategory,
    items: findings,
  };
};

export const filterFindings = (findings, { category, filter } = {}) => {
  let list = Array.isArray(findings) ? findings : [];

  if (category) {
    list = list.filter((finding) => finding.category === category);
  }

  if (filter && filter !== "all") {
    list = list.filter((finding) =>
      (finding.filterKeys || []).includes(filter),
    );
  }

  return list;
};
