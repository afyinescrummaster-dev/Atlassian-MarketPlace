import { route } from "@forge/api";
import { kvs } from "@forge/kvs";
import { ISSUE_LIMIT, calculateMetrics, utcDateString } from "../report/metrics.js";
import {
  BUSINESS_CONCEPTS,
  STANDARD_MAPPINGS,
  suggestFields,
  summarizeField,
  defaultValueConfig,
} from "../report/field-catalog.js";
import { buildMappingDiagnostics } from "../report/diagnostics.js";
import {
  SITE_MAPPING_KEY,
  projectMappingKey,
  sanitizeMapping,
} from "../report/mapping.js";
import { getProjectKeyFromContext, isValidProjectKey } from "../report/project-key.js";
import { permissionStatus, readJson, requestJira } from "./jira.js";
import { fetchProject, loadIssues } from "./issues.js";

const loadPriorities = async () => {
  const response = await requestJira(route`/rest/api/3/priority`);
  if (!response.ok) {
    return [];
  }

  const payload = (await readJson(response)) ?? [];
  return (Array.isArray(payload) ? payload : [])
    .map((priority) =>
      typeof priority?.name === "string" ? priority.name : null,
    )
    .filter(Boolean);
};

const loadFields = async () => {
  const response = await requestJira(route`/rest/api/3/field`);
  if (permissionStatus(response.status)) {
    return { ok: false, error: "permission" };
  }

  if (!response.ok) {
    return { ok: false, error: "unavailable" };
  }

  const payload = (await readJson(response)) ?? [];
  const fields = (Array.isArray(payload) ? payload : [])
    .map(summarizeField)
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));

  return { ok: true, fields };
};

const readStoredMapping = async (projectKey) => {
  const projectStored = projectKey
    ? await kvs.get(projectMappingKey(projectKey))
    : null;
  if (projectStored) {
    return {
      stored: projectStored,
      source: "project",
    };
  }

  const siteStored = await kvs.get(SITE_MAPPING_KEY);
  if (siteStored) {
    return { stored: siteStored, source: "site" };
  }

  return { stored: null, source: "none" };
};

export const resolveMapping = async (projectKey, priorityNames = []) => {
  const { stored, source } = await readStoredMapping(projectKey);
  return {
    mapping: sanitizeMapping(stored, { projectKey, priorityNames }),
    source,
  };
};

export const registerMappingResolvers = (resolver) => {
  resolver.define("getFieldCatalog", async (req) => {
    const projectKey = getProjectKeyFromContext(req.context);
    if (!projectKey || !isValidProjectKey(projectKey)) {
      return { ok: false, error: "invalid-project" };
    }

    try {
      const fieldResult = await loadFields();
      if (!fieldResult.ok) {
        return fieldResult;
      }

      const priorities = await loadPriorities();
      const { mapping, source } = await resolveMapping(projectKey, priorities);
      const suggestions = Object.fromEntries(
        BUSINESS_CONCEPTS.map((concept) => [
          concept.id,
          suggestFields(fieldResult.fields, concept).map((field) => ({
            id: field.id,
            name: field.name,
            kind: field.kind,
            schemaType: field.schemaType,
          })),
        ]),
      );

      return {
        ok: true,
        projectKey,
        endpoint: "/rest/api/3/field",
        fields: fieldResult.fields,
        priorities,
        standardMappings: STANDARD_MAPPINGS,
        concepts: BUSINESS_CONCEPTS,
        mapping,
        source,
        suggestions,
        defaultValues: defaultValueConfig(priorities),
      };
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

  resolver.define("saveFieldMapping", async (req) => {
    const projectKey = getProjectKeyFromContext(req.context);
    if (!projectKey || !isValidProjectKey(projectKey)) {
      return { ok: false, error: "invalid-project" };
    }

    try {
      const scope = req.payload?.scope === "site" ? "site" : "project";
      const mapping = sanitizeMapping(
        {
          ...req.payload?.mapping,
          scope,
          projectKey: scope === "project" ? projectKey : null,
          updatedAt: new Date().toISOString(),
        },
        { projectKey },
      );

      const key = scope === "site" ? SITE_MAPPING_KEY : projectMappingKey(projectKey);
      await kvs.set(key, mapping);
      return { ok: true, mapping, source: scope };
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

  resolver.define("testFieldMapping", async (req) => {
    const projectKey = getProjectKeyFromContext(req.context);
    if (!projectKey || !isValidProjectKey(projectKey)) {
      return { ok: false, error: "invalid-project" };
    }

    try {
      const fieldResult = await loadFields();
      if (!fieldResult.ok) {
        return fieldResult;
      }

      const priorities = await loadPriorities();
      const draft = sanitizeMapping(req.payload?.mapping, {
        projectKey,
        priorityNames: priorities,
      });
      const projectResult = await fetchProject(projectKey);
      if (!projectResult.ok) {
        return projectResult;
      }

      const issueResult = await loadIssues(projectKey, draft);
      if (!issueResult.ok) {
        return issueResult;
      }

      const metrics = calculateMetrics(issueResult.issues, {
        today: utcDateString(),
        truncated: issueResult.truncated,
        partial: issueResult.partial,
        limit: ISSUE_LIMIT,
        overdueConfigured:
          draft.values.overdueDateSource !== "targetEndDate" ||
          Boolean(draft.fields.targetEndDate),
        blockedConfigured: Boolean(draft.fields.blocked),
        storyPointsConfigured: Boolean(draft.fields.storyPoints),
        completionMetric: draft.values.completionMetric,
        criticalPriorityNames: draft.values.criticalPriorities,
      });

      return {
        ok: true,
        diagnostics: buildMappingDiagnostics({
          issues: issueResult.issues,
          mapping: draft,
          metrics,
          truncated: issueResult.truncated,
          partial: issueResult.partial,
        }),
      };
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });
};
