export const STANDARD_SEARCH_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "assignee",
  "reporter",
  "priority",
  "duedate",
  "created",
  "updated",
  "resolutiondate",
  "project",
  "parent",
  "fixVersions",
  "labels",
];

export const STANDARD_MAPPINGS = [
  {
    id: "issueKey",
    label: "Issue key",
    fieldId: "key",
    fieldName: "Issue key",
    automatic: true,
  },
  {
    id: "summary",
    label: "Summary",
    fieldId: "summary",
    fieldName: "Summary",
    automatic: true,
  },
  {
    id: "project",
    label: "Project key and name",
    fieldId: "project",
    fieldName: "Project",
    automatic: true,
  },
  {
    id: "status",
    label: "Status",
    fieldId: "status",
    fieldName: "Status",
    automatic: true,
  },
  {
    id: "statusCategory",
    label: "Status category",
    fieldId: "status.statusCategory",
    fieldName: "Status category",
    automatic: true,
  },
  {
    id: "priority",
    label: "Priority",
    fieldId: "priority",
    fieldName: "Priority",
    automatic: true,
  },
  {
    id: "assignee",
    label: "Assignee",
    fieldId: "assignee",
    fieldName: "Assignee",
    automatic: true,
  },
  {
    id: "dueDate",
    label: "Due date",
    fieldId: "duedate",
    fieldName: "Due date",
    automatic: true,
  },
  {
    id: "created",
    label: "Created date",
    fieldId: "created",
    fieldName: "Created",
    automatic: true,
  },
  {
    id: "updated",
    label: "Updated date",
    fieldId: "updated",
    fieldName: "Updated",
    automatic: true,
  },
  {
    id: "resolutionDate",
    label: "Resolution date",
    fieldId: "resolutiondate",
    fieldName: "Resolved",
    automatic: true,
  },
  {
    id: "issueType",
    label: "Issue type",
    fieldId: "issuetype",
    fieldName: "Issue Type",
    automatic: true,
  },
  {
    id: "parent",
    label: "Parent",
    fieldId: "parent",
    fieldName: "Parent",
    automatic: true,
  },
  {
    id: "fixVersions",
    label: "Fix Version / Release",
    fieldId: "fixVersions",
    fieldName: "Fix versions",
    automatic: true,
  },
];

export const BUSINESS_CONCEPTS = [
  {
    id: "targetStartDate",
    label: "Target start date",
    description: "Planned start used for timeline context. Not used for overdue.",
    types: ["date", "datetime"],
    keywords: ["target start", "planned start", "start date"],
  },
  {
    id: "targetEndDate",
    label: "Target end date",
    description:
      "Planned finish. Can be selected as the overdue date instead of Jira due date.",
    types: ["date", "datetime"],
    keywords: ["target end", "target date", "planned end", "end date"],
  },
  {
    id: "team",
    label: "Team or squad",
    description: "Owning team or squad for diagnostics and issue preview.",
    types: ["option", "string", "user", "array", "any"],
    keywords: ["team", "squad", "group"],
  },
  {
    id: "programIncrement",
    label: "Program Increment / PI",
    description: "PI or increment label for the issue.",
    types: ["option", "string", "array", "any"],
    keywords: ["program increment", "pi ", "increment"],
  },
  {
    id: "rag",
    label: "RAG or health status",
    description: "Issue-level RAG/health. Used only when mapped.",
    types: ["option", "string", "any"],
    keywords: ["rag", "health", "at risk", "status rag"],
  },
  {
    id: "blocked",
    label: "Blocked indicator",
    description: "Marks an issue blocked. Feeds Requires Attention and At Risk.",
    types: ["option", "string", "array", "any"],
    keywords: ["blocked", "flagged", "impediment"],
  },
  {
    id: "blockedReason",
    label: "Blocked reason",
    description: "Why the issue is blocked. Shown in diagnostics and preview.",
    types: ["string", "option", "any"],
    keywords: ["blocked reason", "impediment", "flag reason"],
  },
  {
    id: "acceptanceCriteria",
    label: "Acceptance criteria",
    description: "Acceptance criteria text. Shown in mapping diagnostics only.",
    types: ["string", "any"],
    keywords: ["acceptance", "ac"],
  },
  {
    id: "storyPoints",
    label: "Story points / estimate",
    description:
      "Numeric estimate. Used for completion only when that mode is selected.",
    types: ["number"],
    keywords: ["story points", "story point", "estimate", "points"],
  },
  {
    id: "sprint",
    label: "Sprint",
    description: "Sprint name for diagnostics and issue preview.",
    types: ["array", "string", "any"],
    keywords: ["sprint"],
  },
  {
    id: "release",
    label: "Release / Fix Version",
    description:
      "Override for release. Leave unconfigured to keep standard Fix versions.",
    types: ["array", "version", "option", "string", "any"],
    keywords: ["fix version", "release", "version"],
  },
  {
    id: "epicLink",
    label: "Epic link or parent",
    description:
      "Override for epic/parent. Leave unconfigured to keep standard Parent.",
    types: ["any", "string"],
    keywords: ["epic", "parent", "epic link"],
  },
  {
    id: "featureLink",
    label: "Feature link / higher-level parent",
    description: "Higher-level parent such as a Feature or Initiative.",
    types: ["any", "string"],
    keywords: ["feature", "initiative", "parent"],
  },
];

export const DEFAULT_CRITICAL_PRIORITIES = ["Critical", "Highest"];
export const DEFAULT_BLOCKED_VALUES = ["Yes", "True", "Blocked", "Y"];
export const DEFAULT_RAG_AT_RISK_VALUES = ["At Risk", "Red", "R"];
export const OVERDUE_AT_RISK_PERCENT = 20;

const typeOf = (field) => field?.schema?.type || field?.schema?.items || "any";

export const summarizeField = (field) => {
  if (!field || typeof field.id !== "string") {
    return null;
  }

  return {
    id: field.id,
    name: typeof field.name === "string" ? field.name : field.id,
    custom: field.custom === true,
    searchable: field.searchable === true,
    clauseNames: Array.isArray(field.clauseNames) ? field.clauseNames : [],
    schemaType: typeOf(field),
    schemaCustom: field?.schema?.custom || null,
    kind: field.custom === true ? "custom" : "standard",
  };
};

export const isCompatibleField = (field, concept) => {
  if (!concept?.types?.length) {
    return true;
  }

  const type = typeOf(field);
  if (concept.types.includes("any") || concept.types.includes(type)) {
    return true;
  }

  if (type === "array" && field?.schema?.items) {
    return concept.types.includes(field.schema.items);
  }

  return false;
};

const scoreField = (field, concept) => {
  const name = String(field.name || "").toLowerCase();
  const id = String(field.id || "").toLowerCase();
  let score = 0;

  for (const keyword of concept.keywords || []) {
    const needle = keyword.toLowerCase();
    if (name === needle) {
      score += 8;
    } else if (name.includes(needle)) {
      score += 4;
    } else if (id.includes(needle.replaceAll(" ", ""))) {
      score += 1;
    }
  }

  if (isCompatibleField(field, concept)) {
    score += 2;
  }

  return score;
};

export const suggestFields = (fields, concept, limit = 3) =>
  (fields ?? [])
    .map((field) => ({ field, score: scoreField(field, concept) }))
    .filter((row) => row.score >= 4)
    .sort((left, right) => right.score - left.score || left.field.name.localeCompare(right.field.name))
    .slice(0, limit)
    .map((row) => row.field);

export const defaultValueConfig = (priorityNames = []) => {
  const available = new Set(
    (priorityNames ?? []).map((name) => String(name).trim()).filter(Boolean),
  );
  const criticalPriorities = DEFAULT_CRITICAL_PRIORITIES.filter((name) =>
    available.size === 0 ? true : available.has(name),
  );

  return {
    criticalPriorities:
      criticalPriorities.length > 0
        ? criticalPriorities
        : [...DEFAULT_CRITICAL_PRIORITIES],
    ragAtRiskValues: [...DEFAULT_RAG_AT_RISK_VALUES],
    blockedValues: [...DEFAULT_BLOCKED_VALUES],
    overdueDateSource: "dueDate",
    completionMetric: "issueCount",
  };
};

export const emptyBusinessFields = () =>
  Object.fromEntries(BUSINESS_CONCEPTS.map((concept) => [concept.id, null]));

export const createMappingDocument = ({
  projectKey = null,
  scope = projectKey ? "project" : "site",
  fields = {},
  values = {},
  priorityNames = [],
} = {}) => ({
  version: 1,
  scope,
  projectKey: scope === "project" ? projectKey : null,
  fields: { ...emptyBusinessFields(), ...fields },
  values: { ...defaultValueConfig(priorityNames), ...values },
  updatedAt: null,
});
