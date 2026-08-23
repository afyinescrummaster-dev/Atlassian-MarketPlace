export const ATTENTION_PREVIEW_LIMIT = 6;

export const attentionSeverity = (reasons = []) => {
  const overdue = reasons.includes("Overdue");
  const critical = reasons.includes("Critical/Highest priority");
  const unassigned = reasons.includes("Unassigned");
  const blocked = reasons.includes("Blocked");

  if (overdue && critical) {
    return 0;
  }

  if (overdue) {
    return 1;
  }

  if (critical) {
    return 2;
  }

  if (blocked) {
    return 3;
  }

  if (unassigned) {
    return 4;
  }

  return 5;
};

export const selectAttentionPreview = (
  attention,
  limit = ATTENTION_PREVIEW_LIMIT,
) =>
  [...(attention ?? [])]
    .sort((left, right) => {
      const severity =
        attentionSeverity(left.reasons) - attentionSeverity(right.reasons);

      if (severity !== 0) {
        return severity;
      }

      const dueLeft = left.dueDate || "9999-99-99";
      const dueRight = right.dueDate || "9999-99-99";
      const dueOrder = dueLeft.localeCompare(dueRight);

      if (dueOrder !== 0) {
        return dueOrder;
      }

      return String(left.key || "").localeCompare(String(right.key || ""));
    })
    .slice(0, Math.max(0, limit));
