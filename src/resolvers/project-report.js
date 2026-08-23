import { ISSUE_LIMIT, calculateMetrics, utcDateString } from "../report/metrics.js";
import { overallHealth } from "../report/health.js";
import { STANDARD_MAPPINGS } from "../report/field-catalog.js";
import {
  buildProjectJql,
  getProjectKeyFromContext,
  isValidProjectKey,
} from "../report/project-key.js";
import { fetchProject, loadIssues } from "./issues.js";
import { resolveMapping } from "./mapping.js";

const metricOptions = (mapping) => ({
  overdueConfigured:
    mapping.values.overdueDateSource !== "targetEndDate" ||
    Boolean(mapping.fields.targetEndDate),
  blockedConfigured: Boolean(mapping.fields.blocked),
  storyPointsConfigured: Boolean(mapping.fields.storyPoints),
  completionMetric: mapping.values.completionMetric,
  criticalPriorityNames: mapping.values.criticalPriorities,
});

export const registerProjectReportResolvers = (resolver) => {
  resolver.define("getProjectHealthReport", async (req) => {
    const projectKey = getProjectKeyFromContext(req.context);

    if (!projectKey || !isValidProjectKey(projectKey)) {
      return { ok: false, error: "invalid-project" };
    }

    try {
      const projectResult = await fetchProject(projectKey);
      if (!projectResult.ok) {
        return projectResult;
      }

      const { mapping, source } = await resolveMapping(projectKey);
      const issueResult = await loadIssues(projectKey, mapping);
      if (!issueResult.ok) {
        return issueResult;
      }

      const today = utcDateString();
      const metrics = calculateMetrics(issueResult.issues, {
        today,
        truncated: issueResult.truncated,
        partial: issueResult.partial,
        limit: ISSUE_LIMIT,
        ...metricOptions(mapping),
      });

      return {
        ok: true,
        report: {
          project: projectResult.project,
          jql: buildProjectJql(projectKey),
          refreshedAt: new Date().toISOString(),
          today,
          issues: issueResult.issues,
          truncated: issueResult.truncated,
          partial: issueResult.partial,
          limit: ISSUE_LIMIT,
          mapping: {
            source,
            scope: mapping.scope,
            projectKey: mapping.projectKey,
            fields: mapping.fields,
            values: mapping.values,
            standard: STANDARD_MAPPINGS,
          },
          metrics,
          health: overallHealth(metrics),
        },
      };
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });
};
