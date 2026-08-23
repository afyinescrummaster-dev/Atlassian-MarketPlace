import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  AdfRenderer,
  Button,
  Inline,
  SectionMessage,
  Spinner,
  Stack,
  Text,
} from "@forge/react";
import { invoke } from "@forge/bridge";

const FALLBACKS = {
  key: "Unknown",
  summary: "No summary",
  issueType: "Unknown",
  project: "Unknown",
  status: "Unknown",
  assignee: "Unassigned",
  reporter: "Unknown",
  priority: "None",
  dueDate: "No due date",
};

const display = (value, fallback) => {
  if (value == null) {
    return fallback;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
};

const projectLabel = (issue) => {
  const name = display(issue.projectName, "");
  const key = display(issue.projectKey, "");

  if (name && key) {
    return `${name} (${key})`;
  }

  return name || key || FALLBACKS.project;
};

const Field = ({ label, value }) => (
  <Inline space="space.100" alignBlock="start">
    <Text weight="medium">{label}</Text>
    <Text>{value}</Text>
  </Inline>
);

const App = () => {
  const [status, setStatus] = useState("loading");
  const [issue, setIssue] = useState(null);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;

    invoke("getIssueData")
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result?.ok && result.issue) {
          setIssue(result.issue);
          setStatus("ready");
          return;
        }

        setIssue(null);
        setError(result?.error === "permission" ? "permission" : "unavailable");
        setStatus("error");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setIssue(null);
        setError("unavailable");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const retry = () => {
    setError(null);
    setStatus("loading");
    setRequestId((id) => id + 1);
  };

  if (status === "loading") {
    return (
      <Stack space="space.100">
        <Inline space="space.100" alignBlock="center">
          <Spinner size="medium" label="loading" />
          <Text>Loading issue data…</Text>
        </Inline>
      </Stack>
    );
  }

  if (status === "error" && error === "permission") {
    return (
      <Stack space="space.150">
        <SectionMessage appearance="warning" title="Permission denied">
          <Text>
            You do not have permission to view this issue. Ask a project admin
            for access, then try again.
          </Text>
        </SectionMessage>
        <Button onClick={retry}>Retry</Button>
      </Stack>
    );
  }

  if (status === "error" || !issue) {
    return (
      <Stack space="space.150">
        <SectionMessage appearance="error" title="Could not load issue data">
          <Text>
            The issue details could not be retrieved right now. Try again in a
            moment.
          </Text>
        </SectionMessage>
        <Button appearance="primary" onClick={retry}>
          Retry
        </Button>
      </Stack>
    );
  }

  return (
    <Stack space="space.075">
      <Field label="Key" value={display(issue.key, FALLBACKS.key)} />
      <Field
        label="Summary"
        value={display(issue.summary, FALLBACKS.summary)}
      />
      <Field
        label="Issue type"
        value={display(issue.issueType, FALLBACKS.issueType)}
      />
      <Field label="Project" value={projectLabel(issue)} />
      <Field label="Status" value={display(issue.status, FALLBACKS.status)} />
      <Field
        label="Assignee"
        value={display(issue.assignee, FALLBACKS.assignee)}
      />
      <Field
        label="Reporter"
        value={display(issue.reporter, FALLBACKS.reporter)}
      />
      <Field
        label="Priority"
        value={display(issue.priority, FALLBACKS.priority)}
      />
      <Field
        label="Due date"
        value={display(issue.dueDate, FALLBACKS.dueDate)}
      />
      <Stack space="space.050">
        <Text weight="medium">Description</Text>
        {issue.description ? (
          <AdfRenderer document={issue.description} />
        ) : (
          <Text>No description provided.</Text>
        )}
      </Stack>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
