import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  Box,
  Button,
  DynamicTable,
  EmptyState,
  Heading,
  Inline,
  LoadingButton,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Text,
} from "@forge/react";
import { invoke } from "@forge/bridge";

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

const Card = ({ children }) => (
  <Box
    padding="space.200"
    backgroundColor="elevation.surface.raised"
    borderRadius="border.radius"
  >
    {children}
  </Box>
);

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

const errorMessage = (code) => {
  if (code === "permission") {
    return "Jira did not allow this admin health read. Confirm you can browse projects and fields, and that the app has read:jira-work.";
  }
  return "Admin Health Lab could not load site data right now. Try again in a moment.";
};

const App = () => {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requestId, setRequestId] = useState(0);
  const [focus, setFocus] = useState("all");

  useEffect(() => {
    let cancelled = false;

    invoke("getAdminHealthReport")
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

        setReport(null);
        setError(result?.error || "unavailable");
        setStatus((current) => (current === "ready" ? current : "error"));
        setRefreshing(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setReport(null);
        setError("unavailable");
        setStatus((current) => (current === "ready" ? current : "error"));
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const refresh = () => {
    setError(null);
    if (report) {
      setRefreshing(true);
    } else {
      setStatus("loading");
    }
    setRequestId((value) => value + 1);
  };

  if (status === "loading" && !report) {
    return (
      <Box padding="space.200">
        <Stack space="space.200" alignInline="center">
          <Spinner size="large" />
          <Text>Analyzing site configuration…</Text>
        </Stack>
      </Box>
    );
  }

  if (status === "error" && !report) {
    return (
      <Box padding="space.200">
        <Stack space="space.200">
          <Heading size="large">Admin Health Lab</Heading>
          <SectionMessage appearance="error" title="Unable to load">
            <Text>{errorMessage(error)}</Text>
          </SectionMessage>
          <Button onClick={refresh}>Try again</Button>
        </Stack>
      </Box>
    );
  }

  const overview = report.overview;
  const health = report.health;
  const recommendations = report.recommendations || [];
  const duplicateGroups = report.fields?.duplicateGroups || [];
  const flaggedProjects = (report.projects?.flagged || []).filter((project) => {
    if (focus === "inactive") {
      return project.inactive && !project.empty;
    }
    if (focus === "empty") {
      return project.empty;
    }
    if (focus === "leads") {
      return !project.leadPresent && !project.archived;
    }
    if (focus === "low-volume") {
      return project.lowVolume;
    }
    return project.findings.length > 0;
  });

  const typeRows = (report.fields?.typeBreakdown || []).map((row) => ({
    key: row.type,
    cells: [{ key: "t", content: row.type }, { key: "c", content: String(row.count) }],
  }));

  const duplicateRows = duplicateGroups.map((group) => ({
    key: group.normalizedName,
    cells: [
      { key: "n", content: group.displayName },
      { key: "c", content: String(group.count) },
      {
        key: "f",
        content: group.fields.map((field) => `${field.name} (${field.id})`).join(", "),
      },
    ],
  }));

  const projectRows = flaggedProjects.map((project) => ({
    key: project.key,
    cells: [
      {
        key: "p",
        content: (
          <Stack space="space.025">
            <Text weight="medium">
              {project.name} ({project.key})
            </Text>
            <Text size="small">{project.typeLabel}</Text>
          </Stack>
        ),
      },
      {
        key: "f",
        content: (
          <Stack space="space.050">
            {project.findings.map((finding) => (
              <Inline key={finding.code} space="space.050" alignBlock="center">
                <Lozenge appearance="moved">{finding.title}</Lozenge>
                <Text size="small">{finding.reason}</Text>
              </Inline>
            ))}
          </Stack>
        ),
      },
      {
        key: "i",
        content:
          project.totalIssueCount == null
            ? "—"
            : String(project.totalIssueCount),
      },
      {
        key: "u",
        content: project.lastIssueUpdateTime
          ? formatTimestamp(project.lastIssueUpdateTime)
          : "—",
      },
    ],
  }));

  return (
    <Box padding="space.200">
      <Stack space="space.300">
        <Inline spread="space-between" alignBlock="center">
          <Stack space="space.050">
            <Heading size="large">Admin Health Lab</Heading>
            <Text size="small">
              Read-only site hygiene signals for Jira administrators · v0.1
            </Text>
          </Stack>
          <LoadingButton isLoading={refreshing} onClick={refresh}>
            Refresh
          </LoadingButton>
        </Inline>

        <Card>
          <Stack space="space.150">
            <Inline space="space.100" alignBlock="center">
              <Heading size="medium">Site Health</Heading>
              <Lozenge appearance={health.score >= 80 ? "success" : health.score >= 60 ? "inprogress" : "removed"}>
                {health.score} / {health.max}
              </Lozenge>
            </Inline>
            <Text size="small">{health.disclaimer}</Text>
            {(health.deductions || []).length > 0 ? (
              <Stack space="space.050">
                {health.deductions.map((item) => (
                  <Text key={item.code} size="small">
                    −{item.points}: {item.label} ({item.count}) · {item.rule}
                  </Text>
                ))}
              </Stack>
            ) : (
              <Text size="small">No hygiene deductions from the current rule set.</Text>
            )}
          </Stack>
        </Card>

        <Stack space="space.100">
          <Heading size="medium">Site Overview</Heading>
          <Inline space="space.100" shouldWrap>
            <Kpi label="Projects" value={overview.totalProjects} />
            <Kpi label="Software" value={overview.softwareProjects} />
            <Kpi label="Service Management" value={overview.serviceManagementProjects} />
            <Kpi label="Business" value={overview.businessProjects} />
            <Kpi label="Active" value={overview.activeProjects} />
            <Kpi
              label={`Inactive (≥${report.inactiveDays}d)`}
              value={overview.potentiallyInactiveProjects}
            />
            <Kpi label="Custom fields" value={overview.totalCustomFields} />
            <Kpi label="Potential findings" value={overview.potentialFindings} />
          </Inline>
          <Text size="small">
            Potentially inactive = last issue update older than {report.inactiveDays}{" "}
            days (from project insight). Generated {formatTimestamp(report.generatedAt)}.
          </Text>
        </Stack>

        <Stack space="space.100">
          <Heading size="medium">Recommended Review</Heading>
          {recommendations.length === 0 ? (
            <EmptyState
              header="No review items"
              description="Current rules did not flag duplicate fields, empty projects, inactive projects, missing leads, or low-volume projects."
            />
          ) : (
            <Stack space="space.100">
              {recommendations.map((card) => (
                <Card key={card.id}>
                  <Stack space="space.100">
                    <Inline spread="space-between" alignBlock="center">
                      <Heading size="small">{card.title}</Heading>
                      <Lozenge>{card.count}</Lozenge>
                    </Inline>
                    <Text>{card.summary}</Text>
                    <Button
                      appearance="subtle"
                      onClick={() =>
                        setFocus(
                          card.id === "duplicate-fields"
                            ? "fields"
                            : card.id === "inactive-projects"
                              ? "inactive"
                              : card.id === "empty-projects"
                                ? "empty"
                                : card.id === "missing-leads"
                                  ? "leads"
                                  : card.id === "low-volume"
                                    ? "low-volume"
                                    : "all",
                        )
                      }
                    >
                      {card.actionLabel}
                    </Button>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>

        <Stack space="space.100">
          <Inline spread="space-between" alignBlock="center">
            <Heading size="medium">Custom Field Hygiene</Heading>
            <Text size="small">
              {overview.totalCustomFields} custom · {overview.totalSystemFields} system
            </Text>
          </Inline>
          {typeRows.length > 0 ? (
            <DynamicTable
              head={{
                cells: [
                  { key: "t", content: "Custom field type" },
                  { key: "c", content: "Count" },
                ],
              }}
              rows={typeRows}
              rowsPerPage={8}
            />
          ) : (
            <Text size="small">No custom fields returned by Jira.</Text>
          )}

          <Heading size="small">Similar / duplicate names</Heading>
          {duplicateRows.length === 0 ? (
            <Text size="small">
              No custom fields share a trim/case-normalized name.
            </Text>
          ) : (
            <DynamicTable
              head={{
                cells: [
                  { key: "n", content: "Normalized name" },
                  { key: "c", content: "Count" },
                  { key: "f", content: "Fields" },
                ],
              }}
              rows={duplicateRows}
              rowsPerPage={5}
            />
          )}
          {focus === "fields" ? (
            <Button appearance="subtle" onClick={() => setFocus("all")}>
              Clear field focus
            </Button>
          ) : null}
        </Stack>

        <Stack space="space.100">
          <Inline spread="space-between" alignBlock="center">
            <Heading size="medium">Project Hygiene</Heading>
            <Inline space="space.050">
              <Button
                appearance={focus === "all" ? "primary" : "subtle"}
                onClick={() => setFocus("all")}
              >
                All flagged
              </Button>
              <Button
                appearance={focus === "inactive" ? "primary" : "subtle"}
                onClick={() => setFocus("inactive")}
              >
                Inactive
              </Button>
              <Button
                appearance={focus === "empty" ? "primary" : "subtle"}
                onClick={() => setFocus("empty")}
              >
                Empty
              </Button>
            </Inline>
          </Inline>

          {projectRows.length === 0 ? (
            <EmptyState
              header="No project findings in this view"
              description="Try another filter, or refresh after projects change."
            />
          ) : (
            <DynamicTable
              head={{
                cells: [
                  { key: "p", content: "Project" },
                  { key: "f", content: "Why flagged" },
                  { key: "i", content: "Issues" },
                  { key: "u", content: "Last issue update" },
                ],
              }}
              rows={projectRows}
              rowsPerPage={8}
            />
          )}
        </Stack>

        {(report.limitations || []).length > 0 ? (
          <Stack space="space.100">
            <Heading size="small">Known limitations</Heading>
            {report.limitations.map((item) => (
              <Text key={item.id} size="small">
                · {item.detail}
              </Text>
            ))}
          </Stack>
        ) : null}

        {report.meta?.truncated || report.meta?.partial ? (
          <SectionMessage appearance="warning" title="Partial project data">
            <Text>
              Not all projects may be included in this run. Counts and the score
              are based on the projects successfully loaded.
            </Text>
          </SectionMessage>
        ) : null}
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
