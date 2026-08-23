import { route } from "@forge/api";
import { INACTIVE_DAYS } from "../admin-health/constants.js";
import { buildAdminHealthReport } from "../admin-health/analyze.js";
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
    id: "no-workflow-screens",
    detail:
      "v0.1 does not analyze workflows, screens, permission schemes, or field contexts.",
  },
  {
    id: "duplicate-rule-simple",
    detail:
      "Duplicate custom fields are detected only by trim/case-normalized exact name match — no fuzzy matching.",
  },
  {
    id: "admin-visibility",
    detail:
      "jira:adminPage is only visible to users who can open Jira Administration. Forge scopes do not grant that product role.",
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

export const registerAdminHealthResolvers = (resolver) => {
  resolver.define("getAdminHealthReport", async () => {
    try {
      const [projectResult, fieldResult] = await Promise.all([
        loadAllProjects(),
        loadAllFields(),
      ]);

      if (!projectResult.ok) {
        return { ok: false, error: projectResult.error };
      }

      if (!fieldResult.ok) {
        return { ok: false, error: fieldResult.error };
      }

      const runtimeLimitations = [...limitations];
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

      const report = buildAdminHealthReport({
        projects: projectResult.projects,
        fields: fieldResult.fields,
        now: new Date(),
        inactiveDays: INACTIVE_DAYS,
        limitations: runtimeLimitations,
      });

      return {
        ok: true,
        report: {
          ...report,
          meta: {
            projectCountLoaded: projectResult.projects.length,
            fieldCountLoaded: fieldResult.fields.length,
            truncated: Boolean(projectResult.truncated),
            partial: Boolean(projectResult.partial),
            inactiveDays: INACTIVE_DAYS,
          },
        },
      };
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });
};
