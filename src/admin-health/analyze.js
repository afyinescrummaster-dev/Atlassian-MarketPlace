import { INACTIVE_DAYS } from "./constants.js";
import { analyzeFields } from "./fields.js";
import { summarizeProjects } from "./projects.js";
import { calculateHealthScore } from "./score.js";
import { buildRecommendations } from "./recommendations.js";

/**
 * Pure orchestration: turn raw Jira payloads into the Admin Health Lab report.
 * Safe to unit-test without Forge.
 */
export const buildAdminHealthReport = ({
  projects = [],
  fields = [],
  now = new Date(),
  inactiveDays = INACTIVE_DAYS,
  limitations = [],
} = {}) => {
  const projectSummary = summarizeProjects(projects, { now, inactiveDays });
  const fieldSummary = analyzeFields(fields);
  const health = calculateHealthScore({
    duplicateGroupCount: fieldSummary.duplicateGroupCount,
    emptyProjectCount: projectSummary.empty,
    inactiveProjectCount: projectSummary.potentiallyInactive,
    missingLeadCount: projectSummary.missingLead,
    lowVolumeProjectCount: projectSummary.lowVolume,
  });
  const recommendations = buildRecommendations({
    fields: fieldSummary,
    projects: projectSummary,
  });

  const findingCount =
    fieldSummary.duplicateGroupCount +
    projectSummary.empty +
    projectSummary.potentiallyInactive +
    projectSummary.missingLead +
    projectSummary.lowVolume;

  return {
    generatedAt: now.toISOString(),
    inactiveDays,
    overview: {
      totalProjects: projectSummary.total,
      softwareProjects: projectSummary.byType.software,
      serviceManagementProjects: projectSummary.byType.service_desk,
      businessProjects: projectSummary.byType.business,
      otherProjects: projectSummary.byType.other,
      activeProjects: projectSummary.active,
      potentiallyInactiveProjects: projectSummary.potentiallyInactive,
      emptyProjects: projectSummary.empty,
      archivedProjects: projectSummary.archived,
      totalCustomFields: fieldSummary.customCount,
      totalSystemFields: fieldSummary.systemCount,
      totalFields: fieldSummary.total,
      duplicateFieldGroups: fieldSummary.duplicateGroupCount,
      potentialFindings: findingCount,
    },
    health,
    recommendations,
    projects: projectSummary,
    fields: fieldSummary,
    limitations,
  };
};
