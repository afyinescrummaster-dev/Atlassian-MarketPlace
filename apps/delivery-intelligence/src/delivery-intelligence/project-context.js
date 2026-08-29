const asKey = (value) =>
  typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;

export const resolveProjectKey = (payload, context) => {
  const candidates = [
    ["payload.projectKey", payload?.projectKey],
    ["extension.project.key", context?.extension?.project?.key],
    ["extension.projectKey", context?.extension?.projectKey],
    ["extension.jira.project.key", context?.extension?.jira?.project?.key],
    ["context.jira.project.key", context?.jira?.project?.key],
    ["context.project.key", context?.project?.key],
    [
      "payload.context.extension.project.key",
      payload?.context?.extension?.project?.key,
    ],
    ["payload.context.jira.projectKey", payload?.context?.jira?.projectKey],
  ];

  for (const [source, value] of candidates) {
    const key = asKey(value);
    if (key) {
      return { projectKey: key, source };
    }
  }

  return { projectKey: null, source: null };
};
