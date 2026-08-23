import api, { route } from "@forge/api";

const ISSUE_FIELDS =
  "summary,issuetype,project,status,assignee,reporter,priority,duedate,description";

const getIssueKey = (context) =>
  context?.extension?.issue?.key || context?.extension?.issueKey || null;

const displayName = (user) => {
  if (!user || typeof user.displayName !== "string") {
    return null;
  }

  const name = user.displayName.trim();
  return name.length > 0 ? name : null;
};

const hasVisibleAdfContent = (node) => {
  if (!node || typeof node !== "object") {
    return false;
  }

  if (typeof node.text === "string" && node.text.trim().length > 0) {
    return true;
  }

  if (Array.isArray(node.content)) {
    return node.content.some(hasVisibleAdfContent);
  }

  return false;
};

const toAdfDocument = (description) => {
  if (description == null) {
    return null;
  }

  if (typeof description === "string") {
    const text = description.trim();
    if (!text) {
      return null;
    }

    return {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text }],
        },
      ],
    };
  }

  if (typeof description !== "object" || description.type !== "doc") {
    return null;
  }

  const document = {
    type: "doc",
    version: typeof description.version === "number" ? description.version : 1,
    content: Array.isArray(description.content) ? description.content : [],
  };

  return hasVisibleAdfContent(document) ? document : null;
};

const normalizeIssue = (issue) => {
  const fields = issue?.fields ?? {};

  return {
    key: issue?.key ?? null,
    summary: typeof fields.summary === "string" ? fields.summary : null,
    issueType: fields.issuetype?.name ?? null,
    projectName: fields.project?.name ?? null,
    projectKey: fields.project?.key ?? null,
    status: fields.status?.name ?? null,
    assignee: displayName(fields.assignee),
    reporter: displayName(fields.reporter),
    priority: fields.priority?.name ?? null,
    dueDate: fields.duedate ?? null,
    description: toAdfDocument(fields.description),
  };
};

export const registerIssuePanelResolvers = (resolver) => {
  resolver.define("getIssueData", async (req) => {
    const issueKey = getIssueKey(req.context);

    if (!issueKey) {
      return { ok: false, error: "unavailable" };
    }

    try {
      const response = await api
        .asUser()
        .requestJira(
          route`/rest/api/3/issue/${issueKey}?fields=${ISSUE_FIELDS}`,
          {
            headers: {
              Accept: "application/json",
            },
          },
        );

      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: "permission" };
      }

      if (response.status === 404) {
        return { ok: false, error: "permission" };
      }

      if (!response.ok) {
        return { ok: false, error: "unavailable" };
      }

      const issue = await response.json();
      return { ok: true, issue: normalizeIssue(issue) };
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });
};
