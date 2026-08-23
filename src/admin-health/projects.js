import { INACTIVE_DAYS, LOW_VOLUME_MAX_ISSUES } from "./constants.js";
import {
  daysSince,
  isPotentiallyInactive,
  projectTypeLabel,
} from "./normalize.js";

const hasLead = (project) => {
  const lead = project?.lead;
  if (!lead || typeof lead !== "object") {
    return false;
  }

  return Boolean(
    lead.accountId ||
      lead.displayName ||
      lead.name ||
      lead.key ||
      lead.self,
  );
};

/**
 * Classify a single project into hygiene findings.
 * Relies on GET /rest/api/3/project/search?expand=insight,lead
 */
export const analyzeProject = (
  project,
  { now = new Date(), inactiveDays = INACTIVE_DAYS } = {},
) => {
  const key = project?.key || "";
  const name = typeof project?.name === "string" ? project.name : key;
  const typeKey =
    typeof project?.projectTypeKey === "string" ? project.projectTypeKey : null;
  const insight = project?.insight && typeof project.insight === "object"
    ? project.insight
    : {};
  const totalIssueCount =
    typeof insight.totalIssueCount === "number" ? insight.totalIssueCount : null;
  const lastIssueUpdateTime =
    typeof insight.lastIssueUpdateTime === "string"
      ? insight.lastIssueUpdateTime
      : null;
  const archived = project?.archived === true || project?.status === "archived";
  const leadPresent = hasLead(project);
  const ageDays = daysSince(lastIssueUpdateTime, now);
  const inactive = isPotentiallyInactive(lastIssueUpdateTime, {
    now,
    inactiveDays,
  });
  const empty = totalIssueCount === 0;
  const lowVolume =
    totalIssueCount != null &&
    totalIssueCount > 0 &&
    totalIssueCount < LOW_VOLUME_MAX_ISSUES;

  const findings = [];

  if (empty) {
    findings.push({
      code: "empty",
      title: "Empty project",
      reason: "This project currently contains no issues.",
    });
  }

  if (inactive && !empty) {
    findings.push({
      code: "inactive",
      title: "Potentially inactive",
      reason:
        ageDays == null
          ? `No issue updated within the last ${inactiveDays} days.`
          : `No issue updated in ${ageDays} days (threshold: ${inactiveDays} days).`,
    });
  }

  if (!leadPresent && !archived) {
    findings.push({
      code: "missing-lead",
      title: "Missing project lead",
      reason:
        "Jira did not return a project lead for this project (expand=lead).",
    });
  }

  if (lowVolume) {
    findings.push({
      code: "low-volume",
      title: "Very low issue volume",
      reason: `Only ${totalIssueCount} issue${totalIssueCount === 1 ? "" : "s"} in the project.`,
    });
  }

  if (archived) {
    findings.push({
      code: "archived",
      title: "Archived project",
      reason: "This project is archived in Jira.",
    });
  }

  return {
    key,
    name,
    typeKey,
    typeLabel: projectTypeLabel(typeKey),
    archived,
    leadPresent,
    totalIssueCount,
    lastIssueUpdateTime,
    ageDays,
    inactive,
    empty,
    lowVolume,
    findings,
  };
};

export const summarizeProjects = (
  projects,
  { now = new Date(), inactiveDays = INACTIVE_DAYS } = {},
) => {
  const analyzed = projects.map((project) =>
    analyzeProject(project, { now, inactiveDays }),
  );

  const byType = {
    software: 0,
    service_desk: 0,
    business: 0,
    other: 0,
  };

  let active = 0;
  let potentiallyInactive = 0;
  let empty = 0;
  let missingLead = 0;
  let lowVolume = 0;
  let archived = 0;
  let insightMissing = 0;

  for (const project of analyzed) {
    if (project.typeKey && byType[project.typeKey] != null) {
      byType[project.typeKey] += 1;
    } else {
      byType.other += 1;
    }

    if (project.totalIssueCount == null && project.lastIssueUpdateTime == null) {
      insightMissing += 1;
    }

    if (project.archived) {
      archived += 1;
    }

    if (project.empty) {
      empty += 1;
    }

    if (project.inactive && !project.empty) {
      potentiallyInactive += 1;
    }

    if (
      !project.empty &&
      !project.inactive &&
      !project.archived &&
      project.lastIssueUpdateTime
    ) {
      active += 1;
    } else if (
      !project.empty &&
      !project.inactive &&
      !project.archived &&
      project.totalIssueCount != null &&
      project.totalIssueCount > 0 &&
      !project.lastIssueUpdateTime
    ) {
      // Has issues but no last-update timestamp — treat as active-unknown, count as active.
      active += 1;
    }

    if (!project.leadPresent && !project.archived) {
      missingLead += 1;
    }

    if (project.lowVolume) {
      lowVolume += 1;
    }
  }

  const flagged = analyzed.filter((project) =>
    project.findings.some((finding) =>
      ["empty", "inactive", "missing-lead", "low-volume"].includes(finding.code),
    ),
  );

  return {
    total: analyzed.length,
    byType,
    active,
    potentiallyInactive,
    empty,
    missingLead,
    lowVolume,
    archived,
    insightMissing,
    inactiveDays,
    projects: analyzed,
    flagged,
  };
};
