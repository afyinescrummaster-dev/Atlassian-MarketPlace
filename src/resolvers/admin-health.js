import { route } from "@forge/api";
import { kvs } from "@forge/kvs";
import { INACTIVE_DAYS, PRODUCT_NAME } from "../admin-health/constants.js";
import { buildAdminHealthReport } from "../admin-health/analyze.js";
import {
  ADMIN_HEALTH_SETTINGS_KEY,
  normalizeInactiveDays,
  sanitizeSettings,
} from "../admin-health/settings.js";
import { permissionStatus, readJson, requestJira } from "./jira.js";

const PROJECT_PAGE_SIZE = 50;
const MAX_PROJECT_PAGES = 40; // up to 2000 projects

const limitations = [
  {
    id: "insight-experimental",
    detail:
      "Project issue counts and lastIssueUpdateTime come from expand=insight on project/search (documented as experimental by Atlassian).",
  },
  {
    id: "mvp-scope",
    detail:
      "Current checks cover project activity, empty projects, ownership, and custom-field name duplication. Workflows, screens, schemes, and field contexts are future coverage — not missing data.",
  },
  {
    id: "duplicate-rule-simple",
    detail:
      "Duplicate custom fields are detected only by trim/case-normalized exact name match — no fuzzy matching. Type mismatch is reported when types differ within a group.",
  },
  {
    id: "admin-visibility",
    detail:
      "Open Jira Admin Health from Connected Apps → Configure, or the /jira/settings/apps/configure/{appId}/{envId} URL.",
  },
  {
    id: "no-destructive-actions",
    detail:
      "Jira Admin Health never archives, deletes, or modifies projects or fields. Recommendations are advisory only.",
  },
];

const fetchProjectPage = async (startAt) => {
  const response = await requestJira(
    route`/rest/api/3/project/search?startAt=${startAt}&maxResults=${PROJECT_PAGE_SIZE}&expand=insight,lead&status=live&status=archived`,
  );

  if (permissionStatus(response.status)) {
    return { ok: false, error: "permission", status: response.status };
  }

  if (!response.ok) {
    return { ok: false, error: "unavailable", status: response.status };
  }

  const payload = (await readJson(response)) ?? {};
  const values = Array.isArray(payload.values) ? payload.values : [];

  return {
    ok: true,
    values,
    startAt: typeof payload.startAt === "number" ? payload.startAt : startAt,
    maxResults:
      typeof payload.maxResults === "number"
        ? payload.maxResults
        : PROJECT_PAGE_SIZE,
    total: typeof payload.total === "number" ? payload.total : values.length,
    isLast: payload.isLast === true,
  };
};

export const loadAllProjects = async () => {
  const projects = [];
  let startAt = 0;
  let truncated = false;
  let partial = false;
  let pages = 0;

  while (pages < MAX_PROJECT_PAGES) {
    const page = await fetchProjectPage(startAt);
    pages += 1;

    if (!page.ok) {
      if (projects.length === 0) {
        return { ok: false, error: page.error };
      }
      partial = true;
      break;
    }

    projects.push(...page.values);

    if (page.isLast || projects.length >= page.total || page.values.length === 0) {
      break;
    }

    startAt = page.startAt + page.values.length;

    if (pages >= MAX_PROJECT_PAGES && projects.length < page.total) {
      truncated = true;
      break;
    }
  }

  return { ok: true, projects, truncated, partial };
};

export const loadAllFields = async () => {
  const response = await requestJira(route`/rest/api/3/field`);

  if (permissionStatus(response.status)) {
    return { ok: false, error: "permission", status: response.status };
  }

  if (!response.ok) {
    return { ok: false, error: "unavailable", status: response.status };
  }

  const payload = await readJson(response);
  const fields = Array.isArray(payload) ? payload : [];
  return { ok: true, fields };
};

const readSettings = async () => {
  try {
    const stored = await kvs.get(ADMIN_HEALTH_SETTINGS_KEY);
    return sanitizeSettings(stored || {});
  } catch {
    return sanitizeSettings({});
  }
};

export const registerAdminHealthResolvers = (resolver) => {
  resolver.define("getAdminHealthSettings", async () => {
    try {
      const settings = await readSettings();
      return { ok: true, settings };
    } catch {
      return { ok: false, error: "unavailable", settings: sanitizeSettings({}) };
    }
  });

  resolver.define("setAdminHealthSettings", async ({ payload }) => {
    try {
      const settings = sanitizeSettings(payload || {});
      await kvs.set(ADMIN_HEALTH_SETTINGS_KEY, settings);
      return { ok: true, settings };
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

  resolver.define("getAdminHealthReport", async ({ payload } = {}) => {
    try {
      const storedSettings = await readSettings();
      const inactiveDays = normalizeInactiveDays(
        payload?.inactiveDays ?? storedSettings.inactiveDays ?? INACTIVE_DAYS,
      );

      const [projectResult, fieldResult] = await Promise.all([
        loadAllProjects(),
        loadAllFields(),
      ]);

      // Partial success: render whatever we can instead of blanking the dashboard.
      if (!projectResult.ok && !fieldResult.ok) {
        return {
          ok: false,
          error:
            projectResult.error === "permission" ||
            fieldResult.error === "permission"
              ? "permission"
              : "unavailable",
          sectionErrors: {
            projects: projectResult.error,
            fields: fieldResult.error,
          },
        };
      }

      const runtimeLimitations = [...limitations];
      const sectionErrors = {};

      if (!projectResult.ok) {
        sectionErrors.projects = projectResult.error;
        runtimeLimitations.push({
          id: "projects-unavailable",
          detail:
            projectResult.error === "permission"
              ? "Jira Admin Health could not access project configuration with the current permissions."
              : "Projects could not be analyzed right now. Other sections may still be available.",
        });
      } else {
        if (projectResult.truncated) {
          runtimeLimitations.push({
            id: "project-page-cap",
            detail: `Project listing stopped after ${MAX_PROJECT_PAGES} pages (${PROJECT_PAGE_SIZE} per page). Some projects may be missing.`,
          });
        }
        if (projectResult.partial) {
          runtimeLimitations.push({
            id: "project-partial",
            detail:
              "A later project page failed after some projects were loaded. Results may be incomplete.",
          });
        }
      }

      if (!fieldResult.ok) {
        sectionErrors.fields = fieldResult.error;
        runtimeLimitations.push({
          id: "fields-unavailable",
          detail:
            fieldResult.error === "permission"
              ? "Jira Admin Health could not access field configuration with the current permissions."
              : "Custom fields could not be analyzed right now. Other sections may still be available.",
        });
      }

      const report = buildAdminHealthReport({
        projects: projectResult.ok ? projectResult.projects : [],
        fields: fieldResult.ok ? fieldResult.fields : [],
        now: new Date(),
        inactiveDays,
        limitations: runtimeLimitations,
      });

      return {
        ok: true,
        productName: PRODUCT_NAME,
        settings: { inactiveDays },
        sectionErrors,
        report: {
          ...report,
          meta: {
            projectCountLoaded: projectResult.ok
              ? projectResult.projects.length
              : 0,
            fieldCountLoaded: fieldResult.ok ? fieldResult.fields.length : 0,
            truncated: Boolean(projectResult.ok && projectResult.truncated),
            partial: Boolean(projectResult.ok && projectResult.partial),
            inactiveDays,
            projectsLoaded: Boolean(projectResult.ok),
            fieldsLoaded: Boolean(fieldResult.ok),
          },
        },
      };
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });
};
