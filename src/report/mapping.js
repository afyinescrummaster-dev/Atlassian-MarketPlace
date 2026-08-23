import {
  BUSINESS_CONCEPTS,
  STANDARD_SEARCH_FIELDS,
  createMappingDocument,
} from "./field-catalog.js";
import {
  extractDate,
  extractNumber,
  extractScalar,
  mappedFieldId,
  matchesConfiguredValue,
  readIssueField,
} from "./extract.js";

export const SITE_MAPPING_KEY = "field-mapping:site";

export const projectMappingKey = (projectKey) =>
  `field-mapping:project:${projectKey}`;

export { mappedFieldId };

export const buildSearchFields = (mapping) => {
  const ids = new Set(STANDARD_SEARCH_FIELDS);

  for (const concept of BUSINESS_CONCEPTS) {
    const id = mapping?.fields?.[concept.id]?.id;
    if (id && id !== "key") {
      ids.add(id);
    }
  }

  return [...ids];
};

export const sanitizeMapping = (raw, { projectKey = null, priorityNames = [] } = {}) => {
  const base = createMappingDocument({ projectKey, priorityNames });
  if (!raw || typeof raw !== "object") {
    return base;
  }

  const fields = { ...base.fields };
  for (const concept of BUSINESS_CONCEPTS) {
    const selected = raw.fields?.[concept.id];
    if (selected && typeof selected.id === "string" && selected.id.trim()) {
      fields[concept.id] = {
        id: selected.id.trim(),
        name:
          typeof selected.name === "string" && selected.name.trim()
            ? selected.name.trim()
            : selected.id.trim(),
        kind: selected.kind === "standard" ? "standard" : "custom",
      };
    } else {
      fields[concept.id] = null;
    }
  }

  const values = { ...base.values, ...(raw.values || {}) };
  if (!Array.isArray(values.criticalPriorities)) {
    values.criticalPriorities = base.values.criticalPriorities;
  }
  if (!Array.isArray(values.ragAtRiskValues)) {
    values.ragAtRiskValues = base.values.ragAtRiskValues;
  }
  if (!Array.isArray(values.blockedValues)) {
    values.blockedValues = base.values.blockedValues;
  }
  if (values.overdueDateSource !== "targetEndDate") {
    values.overdueDateSource = "dueDate";
  }
  if (values.completionMetric !== "storyPoints") {
    values.completionMetric = "issueCount";
  }

  return {
    version: 1,
    scope: raw.scope === "project" ? "project" : "site",
    projectKey:
      raw.scope === "project"
        ? raw.projectKey || projectKey
        : null,
    fields,
    values,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
};

const displayName = (user) => {
  if (!user || typeof user.displayName !== "string") {
    return null;
  }

  const name = user.displayName.trim();
  return name.length > 0 ? name : null;
};

const asString = (value) => (typeof value === "string" ? value : null);

export const normalizeSearchIssue = (issue, mapping = null) => {
  const fields = issue?.fields ?? {};
  const labels = Array.isArray(fields.labels)
    ? fields.labels.filter((label) => typeof label === "string")
    : [];
  const dueDate = asString(fields.duedate);
  const targetEndDate = extractDate(
    readIssueField(issue, mappedFieldId(mapping, "targetEndDate")),
  );
  const overdueSource = mapping?.values?.overdueDateSource;
  const overdueDate =
    overdueSource === "targetEndDate" ? targetEndDate : dueDate;
  const blockedRaw = readIssueField(issue, mappedFieldId(mapping, "blocked"));
  const blockedConfigured = Boolean(mappedFieldId(mapping, "blocked"));
  const blockedValue = extractScalar(blockedRaw);
  const releaseOverride = extractScalar(
    readIssueField(issue, mappedFieldId(mapping, "release")),
  );
  const epicOverride = extractScalar(
    readIssueField(issue, mappedFieldId(mapping, "epicLink")),
  );

  return {
    key: asString(issue?.key),
    summary: asString(fields.summary),
    issueType: fields.issuetype?.name ?? null,
    status: fields.status?.name ?? null,
    statusCategory: fields.status?.statusCategory?.key ?? null,
    assignee: displayName(fields.assignee),
    reporter: displayName(fields.reporter),
    priority: fields.priority?.name ?? null,
    dueDate,
    created: asString(fields.created),
    updated: asString(fields.updated),
    resolutionDate: asString(fields.resolutiondate),
    labels,
    parentKey: fields.parent?.key ?? null,
    fixVersions: Array.isArray(fields.fixVersions)
      ? fields.fixVersions.map((version) => version?.name).filter(Boolean)
      : [],
    targetStartDate: extractDate(
      readIssueField(issue, mappedFieldId(mapping, "targetStartDate")),
    ),
    targetEndDate,
    overdueDate,
    team: extractScalar(readIssueField(issue, mappedFieldId(mapping, "team"))),
    programIncrement: extractScalar(
      readIssueField(issue, mappedFieldId(mapping, "programIncrement")),
    ),
    rag: extractScalar(readIssueField(issue, mappedFieldId(mapping, "rag"))),
    blocked: blockedConfigured
      ? blockedValue == null
        ? null
        : matchesConfiguredValue(blockedRaw, mapping?.values?.blockedValues)
      : null,
    blockedReason: extractScalar(
      readIssueField(issue, mappedFieldId(mapping, "blockedReason")),
    ),
    acceptanceCriteria: extractScalar(
      readIssueField(issue, mappedFieldId(mapping, "acceptanceCriteria")),
    ),
    storyPoints: extractNumber(
      readIssueField(issue, mappedFieldId(mapping, "storyPoints")),
    ),
    sprint: extractScalar(readIssueField(issue, mappedFieldId(mapping, "sprint"))),
    release: releaseOverride || (Array.isArray(fields.fixVersions)
      ? fields.fixVersions.map((version) => version?.name).filter(Boolean).join(", ") || null
      : null),
    epicKey: epicOverride || fields.parent?.key || null,
    featureKey: extractScalar(
      readIssueField(issue, mappedFieldId(mapping, "featureLink")),
    ),
  };
};
