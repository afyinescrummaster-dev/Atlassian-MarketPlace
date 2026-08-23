import { mappedFieldId } from "./extract.js";
import { BUSINESS_CONCEPTS } from "./field-catalog.js";

const previewValue = (issue, conceptId) => {
  const map = {
    targetStartDate: issue.targetStartDate,
    targetEndDate: issue.targetEndDate,
    team: issue.team,
    programIncrement: issue.programIncrement,
    rag: issue.rag,
    blocked: issue.blocked,
    blockedReason: issue.blockedReason,
    acceptanceCriteria: issue.acceptanceCriteria,
    storyPoints: issue.storyPoints,
    sprint: issue.sprint,
    release: issue.release,
    epicLink: issue.epicKey,
    featureLink: issue.featureKey,
  };

  const value = map[conceptId];
  if (value == null || value === "") {
    return null;
  }

  return value;
};

export const buildMappingDiagnostics = ({
  issues = [],
  mapping,
  metrics,
  truncated = false,
  partial = false,
} = {}) => {
  const mapped = [];
  const unmapped = [];
  const noData = [];

  for (const concept of BUSINESS_CONCEPTS) {
    const field = mapping?.fields?.[concept.id];
    if (!field?.id) {
      unmapped.push({ id: concept.id, label: concept.label });
      continue;
    }

    mapped.push({
      id: concept.id,
      label: concept.label,
      fieldId: field.id,
      fieldName: field.name,
    });

    const hasValue = issues.some((issue) => previewValue(issue, concept.id) != null);
    if (!hasValue) {
      noData.push({
        id: concept.id,
        label: concept.label,
        fieldId: field.id,
        fieldName: field.name,
      });
    }
  }

  const preview = issues.slice(0, 3).map((issue) => ({
    key: issue.key,
    summary: issue.summary,
    status: issue.status,
    statusCategory: issue.statusCategory,
    priority: issue.priority,
    assignee: issue.assignee,
    dueDate: issue.dueDate,
    overdueDate: issue.overdueDate,
    blocked: issue.blocked,
    storyPoints: issue.storyPoints,
    team: issue.team,
    rag: issue.rag,
  }));

  return {
    issueCount: issues.length,
    truncated,
    partial,
    mapped,
    unmapped,
    noData,
    preview,
    totals: metrics
      ? {
          total: metrics.total,
          toDo: metrics.toDo,
          inProgress: metrics.inProgress,
          completed: metrics.completed,
          unassigned: metrics.unassigned,
          overdue: metrics.overdue,
          criticalOpen: metrics.criticalOpen,
          blocked: metrics.blocked,
          completionPercent: metrics.completionPercent,
          availability: metrics.availability,
        }
      : null,
    overdueDateSource: mapping?.values?.overdueDateSource || "dueDate",
    completionMetric: mapping?.values?.completionMetric || "issueCount",
    targetEndMapped: Boolean(mappedFieldId(mapping, "targetEndDate")),
  };
};
