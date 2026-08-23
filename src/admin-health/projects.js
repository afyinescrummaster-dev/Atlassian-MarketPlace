import {
  CATEGORY,
  CLASSIFICATION,
  INACTIVE_DAYS,
  LOW_VOLUME_MAX_ISSUES,
  SEVERITY,
} from "./constants.js";
import { classifyProjectRecommendation } from "./classify.js";
import { createFinding } from "./findings.js";
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

const leadDisplayName = (project) => {
  const lead = project?.lead;
  if (!lead || typeof lead !== "object") {
    return null;
  }

  if (typeof lead.displayName === "string" && lead.displayName.trim()) {
    return lead.displayName.trim();
  }

  if (typeof lead.name === "string" && lead.name.trim()) {
    return lead.name.trim();
  }

  return null;
};

const severityForCode = (code, classification) => {
  if (
    classification?.code === CLASSIFICATION.STRONG_ARCHIVE &&
    (code === "empty" || code === "inactive" || code === "low-volume")
  ) {
    return SEVERITY.HIGH;
  }

  if (code === "archived" || code === "low-volume") {
    return SEVERITY.INFORMATIONAL;
  }

  return SEVERITY.REVIEW;
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
  const leadName = leadDisplayName(project);
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

  const base = {
    key,
    name,
    typeKey,
    typeLabel: projectTypeLabel(typeKey),
    archived,
    leadPresent,
    leadName,
    totalIssueCount,
    lastIssueUpdateTime,
    ageDays,
    inactive,
    empty,
    lowVolume,
  };

  const classification = classifyProjectRecommendation(base);

  const findings = [];

  if (empty) {
    findings.push({
      code: "empty",
      title: "Empty project",
      reason: "This project currently contains no issues.",
      severity: severityForCode("empty", classification),
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
      severity: severityForCode("inactive", classification),
    });
  }

  if (!leadPresent && !archived) {
    findings.push({
      code: "missing-lead",
      title: "Missing project lead",
      reason:
        "Jira did not return a project lead for this project (expand=lead).",
      severity: severityForCode("missing-lead", classification),
    });
  }

  if (lowVolume) {
    findings.push({
      code: "low-volume",
      title: "Very low issue volume",
      reason: `Only ${totalIssueCount} issue${totalIssueCount === 1 ? "" : "s"} in the project.`,
      severity: severityForCode("low-volume", classification),
    });
  }

  if (archived) {
    findings.push({
      code: "archived",
      title: "Archived project",
      reason: "This project is archived in Jira.",
      severity: severityForCode("archived", classification),
    });
  }

  return {
    ...base,
    classification,
    findings,
  };
};

const buildProjectFindingRecords = (project) => {
  const classification = project.classification;
  const records = [];

  for (const finding of project.findings) {
    if (finding.code === "archived") {
      // Keep archived as evidence on the project, but do not inflate actionable finding counts.
      continue;
    }

    const filterKeys = [finding.code, "all"];
    if (classification?.code) {
      filterKeys.push(classification.code);
    }

    records.push(
      createFinding({
        id: `project:${project.key}:${finding.code}`,
        category: CATEGORY.PROJECTS,
        title: finding.title,
        severity: finding.severity || SEVERITY.REVIEW,
        affectedObject: {
          type: "project",
          key: project.key,
          name: project.name,
          projectType: project.typeLabel,
        },
        reason: finding.reason,
        evidence: {
          totalIssueCount: project.totalIssueCount,
          lastIssueUpdateTime: project.lastIssueUpdateTime,
          ageDays: project.ageDays,
          leadName: project.leadName,
          leadPresent: project.leadPresent,
          archived: project.archived,
          findingCodes: project.findings.map((item) => item.code),
        },
        recommendation:
          classification?.explanation ||
          "Review this project with its owners. Admin Health Lab does not change Jira configuration.",
        classification: classification?.code || null,
        filterKeys,
      }),
    );
  }

  return records;
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
  let strongArchiveCandidates = 0;
  let reviewForArchive = 0;
  let investigateInactivity = 0;
  let reviewOwnership = 0;

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
      active += 1;
    }

    if (!project.leadPresent && !project.archived) {
      missingLead += 1;
    }

    if (project.lowVolume) {
      lowVolume += 1;
    }

    if (project.classification?.code === CLASSIFICATION.STRONG_ARCHIVE) {
      strongArchiveCandidates += 1;
    } else if (project.classification?.code === CLASSIFICATION.REVIEW_ARCHIVE) {
      reviewForArchive += 1;
    } else if (project.classification?.code === CLASSIFICATION.INVESTIGATE) {
      investigateInactivity += 1;
    } else if (project.classification?.code === CLASSIFICATION.OWNERSHIP) {
      reviewOwnership += 1;
    }
  }

  const flagged = analyzed.filter((project) =>
    project.findings.some((finding) =>
      ["empty", "inactive", "missing-lead", "low-volume"].includes(finding.code),
    ),
  );

  const findingRecords = flagged.flatMap((project) =>
    buildProjectFindingRecords(project),
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
    strongArchiveCandidates,
    reviewForArchive,
    investigateInactivity,
    reviewOwnership,
    projects: analyzed,
    flagged,
    findingRecords,
  };
};
