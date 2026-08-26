import { INACTIVE_DAYS } from "./constants.js";
import { analyzeFields } from "./fields.js";
import { summarizeFindings } from "./findings.js";
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
  const findingRecords = [
    ...(projectSummary.findingRecords || []),
    ...(fieldSummary.findingRecords || []),
  ];
  const findings = summarizeFindings(findingRecords);

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
    findings,
  });

  return {
    generatedAt: now.toISOString(),
    inactiveDays,
    version: "0.3",
    overview: {
      totalProjects: projectSummary.total,
      softwareProjects: projectSummary.byType.software,
      serviceManagementProjects: projectSummary.byType.service_desk,
      businessProjects: projectSummary.byType.business,
      otherProjects: projectSummary.byType.other,
      activeProjects: projectSummary.active,
      potentiallyInactiveProjects: projectSummary.potentiallyInactive,
      emptyProjects: projectSummary.empty,
      lowVolumeProjects: projectSummary.lowVolume,
      missingLeadProjects: projectSummary.missingLead,
      archivedProjects: projectSummary.archived,
      strongArchiveCandidates: projectSummary.strongArchiveCandidates,
      reviewForArchive: projectSummary.reviewForArchive,
      investigateInactivity: projectSummary.investigateInactivity,
      totalCustomFields: fieldSummary.customCount,
      totalSystemFields: fieldSummary.systemCount,
      totalFields: fieldSummary.total,
      duplicateFieldGroups: fieldSummary.duplicateGroupCount,
      typeMismatchFieldGroups: fieldSummary.typeMismatchGroupCount,
      potentialFindings: findings.total,
      findingsTotal: findings.total,
      findingsHigh: findings.bySeverity.High,
      findingsReview: findings.bySeverity.Review,
      findingsInformational: findings.bySeverity.Informational,
    },
    health,
    findings,
    recommendations,
    projects: projectSummary,
    fields: fieldSummary,
    limitations,
  };
};
