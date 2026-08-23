import { SCORE_DISCLAIMER, SCORE_RULES } from "./constants.js";

const cappedDeduction = (count, { perItem, max }) => {
  const raw = Math.max(0, count) * perItem;
  return Math.min(raw, max);
};

/**
 * Transparent, deterministic site health score.
 * Start at 100; subtract capped per-finding costs; clamp to [0, 100].
 */
export const calculateHealthScore = ({
  duplicateGroupCount = 0,
  emptyProjectCount = 0,
  inactiveProjectCount = 0,
  missingLeadCount = 0,
  lowVolumeProjectCount = 0,
} = {}) => {
  const deductions = [
    {
      code: "duplicateFieldGroup",
      label: "Similar / duplicate custom field groups",
      count: duplicateGroupCount,
      points: cappedDeduction(duplicateGroupCount, SCORE_RULES.duplicateFieldGroup),
      rule: `-${SCORE_RULES.duplicateFieldGroup.perItem} per group (max -${SCORE_RULES.duplicateFieldGroup.max})`,
    },
    {
      code: "emptyProject",
      label: "Empty projects",
      count: emptyProjectCount,
      points: cappedDeduction(emptyProjectCount, SCORE_RULES.emptyProject),
      rule: `-${SCORE_RULES.emptyProject.perItem} per project (max -${SCORE_RULES.emptyProject.max})`,
    },
    {
      code: "inactiveProject",
      label: "Potentially inactive projects",
      count: inactiveProjectCount,
      points: cappedDeduction(inactiveProjectCount, SCORE_RULES.inactiveProject),
      rule: `-${SCORE_RULES.inactiveProject.perItem} per project (max -${SCORE_RULES.inactiveProject.max})`,
    },
    {
      code: "missingLead",
      label: "Projects missing a lead",
      count: missingLeadCount,
      points: cappedDeduction(missingLeadCount, SCORE_RULES.missingLead),
      rule: `-${SCORE_RULES.missingLead.perItem} per project (max -${SCORE_RULES.missingLead.max})`,
    },
    {
      code: "lowVolumeProject",
      label: "Very low volume projects",
      count: lowVolumeProjectCount,
      points: cappedDeduction(lowVolumeProjectCount, SCORE_RULES.lowVolumeProject),
      rule: `-${SCORE_RULES.lowVolumeProject.perItem} per project (max -${SCORE_RULES.lowVolumeProject.max})`,
    },
  ];

  const totalDeduction = deductions.reduce((sum, item) => sum + item.points, 0);
  const score = Math.max(0, Math.min(100, SCORE_RULES.start - totalDeduction));

  return {
    score,
    max: 100,
    start: SCORE_RULES.start,
    totalDeduction,
    deductions: deductions.filter((item) => item.count > 0 || item.points > 0),
    allDeductions: deductions,
    disclaimer: SCORE_DISCLAIMER,
  };
};
