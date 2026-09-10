const toDate = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const daysBetween = (from, to) => {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) {
    return null;
  }
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
};

const countBlockedByLinks = (links) => {
  if (!Array.isArray(links)) {
    return 0;
  }
  return links.filter((link) => {
    const outward = link?.outwardIssue;
    const inward = link?.inwardIssue;
    const typeName = (link?.type?.outward || link?.type?.inward || "").toLowerCase();
    if (typeName.includes("block")) {
      return true;
    }
    const outwardStatus = outward?.fields?.status?.name?.toLowerCase() || "";
    const inwardStatus = inward?.fields?.status?.name?.toLowerCase() || "";
    return outwardStatus.includes("block") || inwardStatus.includes("block");
  }).length;
};

const relatedIssueFromLink = (link) => link?.outwardIssue || link?.inwardIssue || null;

const classifyLinkRelationship = (link) => {
  const type = link?.type || {};
  const outward = (type.outward || "").toLowerCase();
  const inward = (type.inward || "").toLowerCase();
  const name = (type.name || "").toLowerCase();
  const hasOutward = Boolean(link?.outwardIssue);
  const hasInward = Boolean(link?.inwardIssue);

  if (outward.includes("block") || inward.includes("block") || name.includes("block")) {
    if (hasOutward) {
      // Current issue is the inward side → "is blocked by" outwardIssue
      return { relationship: "is_blocked_by", isBlocking: true };
    }
    if (hasInward) {
      // Current issue is the outward side → blocks inwardIssue
      return { relationship: "blocks", isBlocking: true };
    }
  }

  if (
    outward.includes("depend") ||
    inward.includes("depend") ||
    name.includes("depend")
  ) {
    if (hasOutward) {
      return { relationship: "depends_on", isBlocking: false };
    }
    if (hasInward) {
      return { relationship: "dependency_of", isBlocking: false };
    }
  }

  return null;
};

export const extractDependencyLinks = (links) => {
  if (!Array.isArray(links)) {
    return [];
  }
  const rows = [];
  for (const link of links) {
    const classified = classifyLinkRelationship(link);
    if (!classified) {
      continue;
    }
    const related = relatedIssueFromLink(link);
    if (!related?.key) {
      continue;
    }
    rows.push({
      relationship: classified.relationship,
      isBlocking: classified.isBlocking,
      relatedKey: related.key,
      relatedSummary: related.fields?.summary || "",
      relatedStatusName: related.fields?.status?.name || null,
      relatedStatusCategoryKey: related.fields?.status?.statusCategory?.key || null,
      relatedInSprint: null,
    });
  }
  return rows;
};

/** Lightweight ADF/string flatten for normalized descriptionText. */
const flattenDescriptionText = (description) => {
  if (description == null) {
    return "";
  }
  if (typeof description === "string") {
    return description.replace(/\s+/g, " ").trim();
  }
  if (typeof description !== "object") {
    return "";
  }
  const parts = [];
  const walk = (node) => {
    if (node == null) {
      return;
    }
    if (typeof node === "string") {
      if (node.trim()) {
        parts.push(node.trim());
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") {
      return;
    }
    if (typeof node.text === "string" && node.text.trim()) {
      parts.push(node.text.trim());
    }
    if (node.type === "hardBreak" || node.type === "rule") {
      parts.push(" ");
      return;
    }
    if (Array.isArray(node.content)) {
      walk(node.content);
    }
  };
  walk(description);
  return parts.join(" ").replace(/\s+/g, " ").trim();
};

const parseEstimateValue = (raw) => {
  if (raw == null || raw === "") {
    return null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "object") {
    if (typeof raw.value === "number" && Number.isFinite(raw.value)) {
      return raw.value;
    }
    if (typeof raw.value === "string" && raw.value.trim()) {
      const nested = Number(raw.value);
      return Number.isFinite(nested) ? nested : null;
    }
  }
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber : null;
};

/**
 * Normalize a Jira issue into the Delivery Intelligence shape.
 * Optional estimateFieldId fills estimate when the board estimation field is known.
 */
export const normalizeIssue = (issue, options = {}) => {
  const fields = issue?.fields || {};
  const status = fields.status || {};
  const statusCategory = status.statusCategory || {};
  const assignee = fields.assignee || null;
  const issueType = fields.issuetype || {};
  const parent = fields.parent || null;
  const estimateFieldId = options.estimateFieldId || null;

  const hasDescriptionField = Object.prototype.hasOwnProperty.call(fields, "description");
  const description = hasDescriptionField ? fields.description : undefined;
  const descriptionText = hasDescriptionField
    ? flattenDescriptionText(description)
    : undefined;

  let estimate = null;
  if (estimateFieldId && Object.prototype.hasOwnProperty.call(fields, estimateFieldId)) {
    estimate = parseEstimateValue(fields[estimateFieldId]);
  }

  const customFields =
    options.includeCustomFields && typeof fields === "object"
      ? Object.fromEntries(
          Object.entries(fields)
            .filter(([key]) => key.startsWith("customfield_"))
            .map(([key, value]) => [
              key,
              {
                name: options.customFieldNames?.[key] || key,
                value,
              },
            ]),
        )
      : undefined;

  return {
    id: issue?.id || null,
    key: issue?.key || null,
    summary: typeof fields.summary === "string" ? fields.summary : "",
    issueType: issueType.name || null,
    subtask: Boolean(issueType.subtask),
    statusName: status.name || null,
    statusCategoryKey: statusCategory.key || null,
    priorityName: fields.priority?.name || null,
    assigneeDisplayName: assignee?.displayName || null,
    assigneeAccountId: assignee?.accountId || null,
    created: fields.created || null,
    updated: fields.updated || null,
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    blockedLinksCount: countBlockedByLinks(fields.issuelinks),
    description,
    descriptionText,
    estimate,
    estimateFieldId: estimateFieldId || null,
    parentKey: parent?.key || null,
    parentSummary: parent?.fields?.summary || parent?.summary || null,
    dependencyLinks: extractDependencyLinks(fields.issuelinks),
    ...(customFields ? { customFields } : {}),
  };
};

export const isDone = (issue) => issue?.statusCategoryKey === "done";

export const isBlockedIssue = (issue) => {
  if (isDone(issue)) {
    return false;
  }
  const status = (issue?.statusName || "").toLowerCase();
  if (status.includes("block")) {
    return true;
  }
  const labels = (issue?.labels || []).map((label) => label.toLowerCase());
  return labels.includes("blocked") || labels.includes("impediment");
};

export const isStaleIssue = (issue, now, staleDays) => {
  if (isDone(issue)) {
    return false;
  }
  const age = daysBetween(issue.updated, now);
  return age != null && age >= staleDays;
};

/**
 * Extract sprint-field changelog entries.
 * Keeps the historical shape (at/from/to/fromId/toId) and tags field:'sprint'
 * so membership can ignore non-sprint entries if arrays are ever mixed.
 */
export const extractSprintChanges = (changelog) => {
  const histories = Array.isArray(changelog?.values) ? changelog.values : [];
  const changes = [];

  for (const history of histories) {
    const created = history.created;
    const items = Array.isArray(history.items) ? history.items : [];
    for (const item of items) {
      if ((item.field || "").toLowerCase() !== "sprint") {
        continue;
      }
      changes.push({
        field: "sprint",
        at: created,
        from: item.fromString || null,
        to: item.toString || null,
        fromId: item.from || null,
        toId: item.to || null,
      });
    }
  }

  return changes.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
};

/** Status transitions for pace / aging / reopen signals. */
export const extractStatusChanges = (changelog) => {
  const histories = Array.isArray(changelog?.values) ? changelog.values : [];
  const changes = [];

  for (const history of histories) {
    const created = history.created;
    const items = Array.isArray(history.items) ? history.items : [];
    for (const item of items) {
      if ((item.field || "").toLowerCase() !== "status") {
        continue;
      }
      changes.push({
        field: "status",
        at: created,
        from: item.fromString || null,
        to: item.toString || null,
        fromId: item.from || null,
        toId: item.to || null,
      });
    }
  }

  return changes.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
};

/** True when a changelog entry should drive sprint membership classification. */
export const isSprintMembershipChange = (change) =>
  !change?.field || String(change.field).toLowerCase() === "sprint";
