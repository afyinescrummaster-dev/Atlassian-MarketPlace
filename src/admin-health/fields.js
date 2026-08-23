import { CATEGORY, SEVERITY } from "./constants.js";
import { createFinding } from "./findings.js";
import { normalizeFieldName } from "./normalize.js";

const fieldTypeKey = (field) => {
  const schema = field?.schema;
  if (!schema || typeof schema !== "object") {
    return "unknown";
  }

  if (typeof schema.custom === "string" && schema.custom) {
    const parts = schema.custom.split(":");
    return parts[parts.length - 1] || schema.custom;
  }

  if (typeof schema.type === "string" && schema.type) {
    return schema.type;
  }

  return "unknown";
};

const uniqueTypes = (members) =>
  [...new Set(members.map((member) => member.type).filter(Boolean))];

/**
 * Analyze site fields from GET /rest/api/3/field.
 * Duplicate rule: custom fields whose names normalize to the same string
 * (trim + collapse whitespace + lower-case) form a group when size > 1.
 */
export const analyzeFields = (fields) => {
  const list = Array.isArray(fields) ? fields : [];
  const custom = [];
  const system = [];

  for (const field of list) {
    const id = typeof field?.id === "string" ? field.id : "";
    const name = typeof field?.name === "string" ? field.name : id || "(unnamed)";
    const customFlag = field?.custom === true;
    const entry = {
      id,
      name,
      custom: customFlag,
      type: fieldTypeKey(field),
      normalizedName: normalizeFieldName(name),
    };

    if (customFlag) {
      custom.push(entry);
    } else {
      system.push(entry);
    }
  }

  const byType = {};
  for (const field of custom) {
    byType[field.type] = (byType[field.type] || 0) + 1;
  }

  const typeBreakdown = Object.entries(byType)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const groups = new Map();
  for (const field of custom) {
    if (!field.normalizedName) {
      continue;
    }
    if (!groups.has(field.normalizedName)) {
      groups.set(field.normalizedName, []);
    }
    groups.get(field.normalizedName).push(field);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([normalizedName, members]) => {
      const types = uniqueTypes(members);
      const typeMismatch = types.length > 1;

      return {
        normalizedName,
        displayName: members[0]?.name || normalizedName,
        count: members.length,
        types,
        typeMismatch,
        fields: members.map((member) => ({
          id: member.id,
          name: member.name,
          type: member.type,
        })),
        reason: `Exact name match after trim/case-normalize: "${normalizedName}" (${members.length} fields).`,
        recommendation: typeMismatch
          ? `${members.length} custom fields share the same normalized name but use different field types (${types.join(", ")}). This may indicate intentionally different use cases or configuration drift. Confirm purpose before creating additional fields or consolidating configuration.`
          : `${members.length} custom fields share the same normalized name. Confirm whether these fields serve distinct purposes before creating additional fields or consolidating configuration.`,
      };
    })
    .sort((a, b) => b.count - a.count || a.normalizedName.localeCompare(b.normalizedName));

  const duplicateFieldCount = duplicateGroups.reduce(
    (sum, group) => sum + group.count,
    0,
  );

  const typeMismatchGroupCount = duplicateGroups.filter(
    (group) => group.typeMismatch,
  ).length;

  const findingRecords = duplicateGroups.map((group) =>
    createFinding({
      id: `field-dup:${group.normalizedName}`,
      category: CATEGORY.CUSTOM_FIELDS,
      title: group.typeMismatch
        ? `Duplicate name with mixed types: ${group.displayName}`
        : `Duplicate name: ${group.displayName}`,
      severity: SEVERITY.REVIEW,
      affectedObject: {
        type: "custom-field-group",
        key: group.normalizedName,
        name: group.displayName,
      },
      reason: group.reason,
      evidence: {
        count: group.count,
        types: group.types,
        typeMismatch: group.typeMismatch,
        fields: group.fields,
      },
      recommendation: group.recommendation,
      classification: group.typeMismatch ? "type-mismatch" : "duplicate-name",
      filterKeys: group.typeMismatch
        ? ["duplicates", "type-mismatch", "all"]
        : ["duplicates", "all"],
    }),
  );

  return {
    total: list.length,
    customCount: custom.length,
    systemCount: system.length,
    typeBreakdown,
    duplicateGroups,
    duplicateGroupCount: duplicateGroups.length,
    duplicateFieldCount,
    typeMismatchGroupCount,
    customFields: custom,
    findingRecords,
  };
};
