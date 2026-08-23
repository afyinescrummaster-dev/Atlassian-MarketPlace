import React, { useEffect, useMemo, useState } from "react";
import ForgeReconciler, {
  BarChart,
  Box,
  Button,
  DynamicTable,
  EmptyState,
  Heading,
  Inline,
  Label,
  Link,
  LoadingButton,
  Lozenge,
  ProgressBar,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Text,
  Textfield,
  useProductContext,
} from "@forge/react";
import { invoke } from "@forge/bridge";
import { calculateMetrics } from "../report/metrics.js";
import { UNASSIGNED_FILTER, filterIssues } from "../report/filters.js";
import { isValidProjectKey, getProjectKeyFromContext } from "../report/project-key.js";

const ALL_OPTION = { label: "All", value: "" };

const formatDate = (value) => {
  if (!value) {
    return "No due date";
  }

  return value.length >= 10 ? value.slice(0, 10) : value;
};

const formatTimestamp = (value) => {
  if (!value) {
    return "Unknown";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const lozengeForCategory = (category) => {
  if (category === "done") {
    return "success";
  }

  if (category === "indeterminate") {
    return "inprogress";
  }

  if (category === "new") {
    return "new";
  }

  return "default";
};

const optionFromEvent = (value) => {
  if (value == null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0]?.value || null;
  }

  return value.value || null;
};

const Kpi = ({ label, value }) => (
  <Box
    padding="space.150"
    backgroundColor="elevation.surface.raised"
    borderRadius="border.radius"
  >
    <Stack space="space.050">
      <Text size="small">{label}</Text>
      <Heading size="large">{String(value)}</Heading>
    </Stack>
  </Box>
);

const App = () => {
  const context = useProductContext();
  const projectKeyFromContext = getProjectKeyFromContext(context);
  const siteUrl = context?.siteUrl || "";

  const contextReady = Boolean(context);
  const hasValidProjectKey = isValidProjectKey(projectKeyFromContext);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requestId, setRequestId] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState(null);
  const [assigneeFilter, setAssigneeFilter] = useState(null);
  const [filterProjectKey, setFilterProjectKey] = useState(projectKeyFromContext);

  if (projectKeyFromContext && filterProjectKey !== projectKeyFromContext) {
    setFilterProjectKey(projectKeyFromContext);
    setQuery("");
    setStatusFilter(null);
    setPriorityFilter(null);
    setAssigneeFilter(null);
  }

  useEffect(() => {
    if (!contextReady || !hasValidProjectKey) {
      return undefined;
    }

    let cancelled = false;

    invoke("getProjectHealthReport")
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result?.ok && result.report) {
          setReport(result.report);
          setError(null);
          setStatus("ready");
          setRefreshing(false);
          return;
        }

        setError(result?.error || "unavailable");
        setStatus((current) => (current === "ready" ? current : "error"));
        setRefreshing(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setError("unavailable");
        setStatus((current) => (current === "ready" ? current : "error"));
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contextReady, hasValidProjectKey, projectKeyFromContext, requestId]);

  const reload = () => {
    setError(null);
    if (report?.project?.key === projectKeyFromContext) {
      setRefreshing(true);
    } else {
      setStatus("loading");
    }
    setRequestId((id) => id + 1);
  };

  const clearFilters = () => {
    setQuery("");
    setStatusFilter(null);
    setPriorityFilter(null);
    setAssigneeFilter(null);
  };

  const reportForProject =
    report?.project?.key === projectKeyFromContext ? report : null;
  const waitingForProject =
    Boolean(report?.project?.key) &&
    Boolean(projectKeyFromContext) &&
    report.project.key !== projectKeyFromContext;

  const metrics = useMemo(() => {
    if (!reportForProject) {
      return null;
    }

    return reportForProject.metrics
      ? reportForProject.metrics
      : calculateMetrics(reportForProject.issues, {
          today: reportForProject.today,
          truncated: reportForProject.truncated,
          partial: reportForProject.partial,
          limit: reportForProject.limit,
        });
  }, [reportForProject]);

  const filteredIssues = useMemo(() => {
    if (!reportForProject) {
      return [];
    }

    return filterIssues(reportForProject.issues, {
      query,
      status: statusFilter,
      priority: priorityFilter,
      assignee: assigneeFilter,
    });
  }, [reportForProject, query, statusFilter, priorityFilter, assigneeFilter]);

  const statusOptions = useMemo(() => {
    const names = [
      ...new Set(
        (reportForProject?.issues ?? [])
          .map((issue) => issue.status)
          .filter(Boolean),
      ),
    ].sort();
    return [ALL_OPTION, ...names.map((name) => ({ label: name, value: name }))];
  }, [reportForProject]);

  const priorityOptions = useMemo(() => {
    const names = [
      ...new Set(
        (reportForProject?.issues ?? [])
          .map((issue) => issue.priority)
          .filter(Boolean),
      ),
    ].sort();
    return [ALL_OPTION, ...names.map((name) => ({ label: name, value: name }))];
  }, [reportForProject]);

  const assigneeOptions = useMemo(() => {
    const names = [
      ...new Set(
        (reportForProject?.issues ?? [])
          .map((issue) => issue.assignee)
          .filter(Boolean),
      ),
    ].sort();
    return [
      ALL_OPTION,
      { label: "Unassigned", value: UNASSIGNED_FILTER },
      ...names.map((name) => ({ label: name, value: name })),
    ];
  }, [reportForProject]);

  if (!context) {
    return (
      <Stack space="space.100">
        <Inline space="space.100" alignBlock="center">
          <Spinner label="loading" />
          <Text>Loading project context…</Text>
        </Inline>
      </Stack>
    );
  }

  if (!hasValidProjectKey) {
    return (
      <Stack space="space.150">
        <SectionMessage appearance="warning" title="Invalid project context">
          <Text>
            This page needs to be opened from a Jira project so it can read the
            current project key.
          </Text>
        </SectionMessage>
      </Stack>
    );
  }

  if (status === "loading" || (waitingForProject && !error)) {
    return (
      <Stack space="space.100">
        <Inline space="space.100" alignBlock="center">
          <Spinner size="medium" label="loading" />
          <Text>Loading project health report…</Text>
        </Inline>
      </Stack>
    );
  }

  if (status === "error" && error === "permission") {
    return (
      <Stack space="space.150">
        <SectionMessage appearance="warning" title="Permission denied">
          <Text>
            You do not have permission to view issues in this project. Ask a
            project admin for access, then try again.
          </Text>
        </SectionMessage>
        <Button onClick={reload}>Retry</Button>
      </Stack>
    );
  }

  if ((status === "error" || waitingForProject || !reportForProject || !metrics) && error) {
    return (
      <Stack space="space.150">
        <SectionMessage appearance="error" title="Could not load project data">
          <Text>
            The project health report could not be retrieved right now. Try
            again in a moment.
          </Text>
        </SectionMessage>
        <Button appearance="primary" onClick={reload}>
          Retry
        </Button>
      </Stack>
    );
  }

  if (!reportForProject || !metrics) {
    return (
      <Stack space="space.100">
        <Inline space="space.100" alignBlock="center">
          <Spinner size="medium" label="loading" />
          <Text>Loading project health report…</Text>
        </Inline>
      </Stack>
    );
  }

  const projectName = reportForProject.project?.name || projectKeyFromContext || "Project";
  const projectKey = reportForProject.project?.key || projectKeyFromContext || "";
  const projectType = reportForProject.project?.type;
  const browseBase = siteUrl ? `${siteUrl}/browse` : "/browse";
  const hasFilters = Boolean(
    query || statusFilter || priorityFilter || assigneeFilter,
  );

  const issueLink = (key) => (
    <Link href={`${browseBase}/${key}`} openNewTab>
      {key}
    </Link>
  );

  const tableHead = {
    cells: [
      { key: "key", content: "Key", isSortable: true },
      { key: "summary", content: "Summary", shouldTruncate: true, isSortable: true },
      { key: "type", content: "Issue type", isSortable: true },
      { key: "status", content: "Status", isSortable: true },
      { key: "priority", content: "Priority", isSortable: true },
      { key: "assignee", content: "Assignee", isSortable: true },
      { key: "due", content: "Due date", isSortable: true },
      { key: "updated", content: "Updated", isSortable: true },
    ],
  };

  const tableRows = filteredIssues.map((issue) => ({
    key: issue.key,
    cells: [
      { key: issue.key, content: issueLink(issue.key) },
      { key: issue.summary || "", content: issue.summary || "No summary" },
      { key: issue.issueType || "", content: issue.issueType || "Unknown" },
      {
        key: issue.status || "",
        content: (
          <Lozenge appearance={lozengeForCategory(issue.statusCategory)}>
            {issue.status || "Unknown"}
          </Lozenge>
        ),
      },
      { key: issue.priority || "None", content: issue.priority || "None" },
      { key: issue.assignee || "Unassigned", content: issue.assignee || "Unassigned" },
      { key: issue.dueDate || "", content: formatDate(issue.dueDate) },
      { key: issue.updated || "", content: formatDate(issue.updated) },
    ],
  }));

  const attentionRows = metrics.attention.map((row) => ({
    key: row.key,
    cells: [
      { key: row.key, content: issueLink(row.key) },
      { key: row.summary || "", content: row.summary || "No summary" },
      { key: row.reasons.join(", "), content: row.reasons.join(" · ") },
      { key: row.status || "", content: row.status || "Unknown" },
      { key: row.priority || "None", content: row.priority || "None" },
      { key: row.assignee || "Unassigned", content: row.assignee || "Unassigned" },
      { key: row.dueDate || "", content: formatDate(row.dueDate) },
    ],
  }));

  return (
    <Stack space="space.200">
      <Inline spread="space-between" alignBlock="start">
        <Stack space="space.050">
          <Heading size="large">Project Health Report</Heading>
          <Text>
            {projectName} ({projectKey})
            {projectType ? ` · ${projectType}` : ""}
          </Text>
          {reportForProject.jql ? (
            <Text size="small">JQL: {reportForProject.jql}</Text>
          ) : null}
          <Text size="small">
            Data refreshed {formatTimestamp(reportForProject.refreshedAt)}
          </Text>
        </Stack>
        <LoadingButton
          appearance="primary"
          isLoading={refreshing}
          onClick={reload}
        >
          Refresh
        </LoadingButton>
      </Inline>

      {metrics.truncated ? (
        <SectionMessage appearance="warning" title="Report uses a retrieval limit">
          <Text>
            This report is based on the first {metrics.limit} issues, ordered by
            most recently updated. Additional issues exist in the project and
            were not loaded.
          </Text>
        </SectionMessage>
      ) : null}

      {metrics.partial ? (
        <SectionMessage appearance="warning" title="Partial data">
          <Text>
            Pagination stopped before every permitted issue could be retrieved.
            Metrics below are based on the issues that loaded successfully.
          </Text>
        </SectionMessage>
      ) : null}

      {error && reportForProject ? (
        <SectionMessage appearance="error" title="Refresh failed">
          <Text>
            The latest refresh did not complete. The report below still shows
            the last successful load.
          </Text>
        </SectionMessage>
      ) : null}

      {reportForProject.issues.length === 0 ? (
        <EmptyState
          header="No issues in this project"
          description="There are no issues you can see in this project, or the project is empty."
          primaryAction={<Button onClick={reload}>Refresh</Button>}
        />
      ) : (
        <Stack space="space.200">
          <Stack space="space.100">
            <Heading size="medium">Summary</Heading>
            <Inline space="space.100" shouldWrap>
              <Kpi label="Total" value={metrics.total} />
              <Kpi label="To Do" value={metrics.toDo} />
              <Kpi label="In Progress" value={metrics.inProgress} />
              <Kpi label="Completed" value={metrics.completed} />
              <Kpi label="Unassigned" value={metrics.unassigned} />
              <Kpi label="Overdue" value={metrics.overdue} />
            </Inline>
            <Text size="small">
              Critical/Highest open issues: {metrics.criticalOpen}. Rule:{" "}
              {metrics.criticalPriorityRule}.
            </Text>
          </Stack>

          <Stack space="space.100">
            <Heading size="medium">Status breakdown</Heading>
            {metrics.statusBreakdown.length > 0 ? (
              <BarChart
                title="Issues by status"
                subtitle="Counts use the actual Jira status name"
                height={280}
                data={metrics.statusBreakdown.map((row) => ({
                  status: row.name,
                  count: row.count,
                }))}
                xAccessor="status"
                yAccessor="count"
              />
            ) : null}
            <Stack space="space.100">
              {metrics.statusBreakdown.map((row) => (
                <Stack key={row.name} space="space.050">
                  <Inline space="space.100" alignBlock="center">
                    <Lozenge>{row.name}</Lozenge>
                    <Text>
                      {row.name}: {row.count}
                    </Text>
                  </Inline>
                  <ProgressBar
                    value={metrics.total ? row.count / metrics.total : 0}
                  />
                </Stack>
              ))}
            </Stack>
          </Stack>

          <Stack space="space.100">
            <Heading size="medium">Priority breakdown</Heading>
            <Text size="small">
              Priority is shown by Jira priority name and count, not by color
              alone.
            </Text>
            {metrics.priorityBreakdown.length > 0 ? (
              <BarChart
                title="Issues by priority name"
                height={280}
                data={metrics.priorityBreakdown.map((row) => ({
                  priority: row.name,
                  count: row.count,
                }))}
                xAccessor="priority"
                yAccessor="count"
              />
            ) : null}
            <Stack space="space.050">
              {metrics.priorityBreakdown.map((row) => (
                <Text key={row.name}>
                  {row.name}: {row.count}
                </Text>
              ))}
            </Stack>
          </Stack>

          <Stack space="space.100">
            <Heading size="medium">Issues requiring attention</Heading>
            <Text size="small">
              Overdue open issues, unassigned issues, and open issues with
              priority Critical or Highest. Each issue appears once, with every
              matching reason listed.
            </Text>
            <DynamicTable
              caption="Attention list"
              head={{
                cells: [
                  { key: "key", content: "Key", isSortable: true },
                  { key: "summary", content: "Summary", shouldTruncate: true },
                  { key: "reasons", content: "Reasons" },
                  { key: "status", content: "Status" },
                  { key: "priority", content: "Priority" },
                  { key: "assignee", content: "Assignee" },
                  { key: "due", content: "Due date" },
                ],
              }}
              rows={attentionRows}
              rowsPerPage={10}
              emptyView="No issues currently require attention."
              isLoading={refreshing}
            />
          </Stack>

          <Stack space="space.100">
            <Heading size="medium">Issue table</Heading>
            <Inline space="space.100" shouldWrap alignBlock="end">
              <Stack space="space.050">
                <Label labelFor="report-search">Search key or summary</Label>
                <Textfield
                  id="report-search"
                  placeholder="Search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </Stack>
              <Stack space="space.050">
                <Label labelFor="report-status">Status</Label>
                <Select
                  id="report-status"
                  options={statusOptions}
                  value={
                    statusFilter
                      ? { label: statusFilter, value: statusFilter }
                      : ALL_OPTION
                  }
                  onChange={(value) =>
                    setStatusFilter(optionFromEvent(value) || null)
                  }
                />
              </Stack>
              <Stack space="space.050">
                <Label labelFor="report-priority">Priority</Label>
                <Select
                  id="report-priority"
                  options={priorityOptions}
                  value={
                    priorityFilter
                      ? { label: priorityFilter, value: priorityFilter }
                      : ALL_OPTION
                  }
                  onChange={(value) =>
                    setPriorityFilter(optionFromEvent(value) || null)
                  }
                />
              </Stack>
              <Stack space="space.050">
                <Label labelFor="report-assignee">Assignee</Label>
                <Select
                  id="report-assignee"
                  options={assigneeOptions}
                  value={
                    assigneeFilter
                      ? {
                          label:
                            assigneeFilter === UNASSIGNED_FILTER
                              ? "Unassigned"
                              : assigneeFilter,
                          value: assigneeFilter,
                        }
                      : ALL_OPTION
                  }
                  onChange={(value) =>
                    setAssigneeFilter(optionFromEvent(value) || null)
                  }
                />
              </Stack>
              <Button onClick={clearFilters} isDisabled={!hasFilters}>
                Clear filters
              </Button>
            </Inline>
            {hasFilters && filteredIssues.length === 0 ? (
              <EmptyState
                header="No issues match these filters"
                description="Clear filters to see the full loaded issue list again. Jira data was not changed."
                primaryAction={
                  <Button appearance="primary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <DynamicTable
                caption="Project issues"
                head={tableHead}
                rows={tableRows}
                rowsPerPage={20}
                isLoading={refreshing}
                emptyView="No issues to display"
              />
            )}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
