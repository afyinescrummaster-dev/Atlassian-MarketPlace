import React, { useEffect, useMemo, useState } from "react";
import ForgeReconciler, {
  Box,
  Button,
  EmptyState,
  Heading,
  Inline,
  LoadingButton,
  Lozenge,
  SectionMessage,
  Select,
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
      <Heading size="medium">{String(value)}</Heading>
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

const formatIssueCount = (value) => {
  if (value == null) {
    return "—";
  }
  try {
    return Number(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const severityAppearance = (severity) => {
  if (severity === "High") {
    return "removed";
  }
  if (severity === "Informational") {
    return "new";
  }
  return "moved";
};

const errorMessage = (code) => {
  if (code === "permission") {
    return "Jira did not allow this admin health read. Confirm you can browse projects and fields, and that the app has read:jira-work.";
  }
  return "Admin Health Lab could not load site data right now. Try again in a moment.";
};

const PROJECT_FILTER_OPTIONS = [
  { label: "All findings", value: "all" },
  { label: "Inactive", value: "inactive" },
  { label: "Empty", value: "empty" },
  { label: "Low volume", value: "low-volume" },
  { label: "Missing lead", value: "missing-lead" },
  { label: "Strong archive candidate", value: "strong-archive-candidate" },
  { label: "Review for archive", value: "review-for-archive" },
  { label: "Investigate inactivity", value: "investigate-inactivity" },
];

const FIELD_FILTER_OPTIONS = [
  { label: "All duplicate groups", value: "duplicates" },
  { label: "Type mismatch only", value: "type-mismatch" },
];

const optionFromEvent = (value) => {
  if (value == null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0]?.value || null;
  }
  return value.value || null;
};

const ProjectFindingCard = ({ project }) => {
  const classification = project.classification;
  const severity = classification?.severity || "Review";

  return (
    <Card>
      <Stack space="space.100">
        <Stack space="space.025">
          <Text weight="medium">
            {project.name} ({project.key})
          </Text>
          <Text size="small">{project.typeLabel}</Text>
        </Stack>

        {classification ? (
          <Inline space="space.050" alignBlock="center" shouldWrap>
            <Lozenge appearance={severityAppearance(severity)}>
              {classification.label}
            </Lozenge>
            <Lozenge>{severity}</Lozenge>
          </Inline>
        ) : null}

        <Stack space="space.050">
          <Text size="small">
            Issues: {formatIssueCount(project.totalIssueCount)}
          </Text>
          <Text size="small">
            Last activity:{" "}
            {project.ageDays != null
              ? `${project.ageDays} days ago`
              : project.lastIssueUpdateTime
                ? formatTimestamp(project.lastIssueUpdateTime)
                : "Unknown"}
          </Text>
          <Text size="small">
            Lead: {project.leadPresent ? project.leadName || "Assigned" : "None returned"}
          </Text>
        </Stack>

        {classification?.explanation ? (
          <Text size="small">{classification.explanation}</Text>
        ) : null}

        <Stack space="space.050">
          <Text size="small" weight="medium">
            Findings
          </Text>
          {project.findings
            .filter((finding) => finding.code !== "archived")
            .map((finding) => (
              <Text key={finding.code} size="small">
                · {finding.title}: {finding.reason}
              </Text>
            ))}
        </Stack>
      </Stack>
    </Card>
  );
};

const DuplicateGroupCard = ({ group, expanded, onToggle }) => (
  <Card>
    <Stack space="space.100">
      <Inline spread="space-between" alignBlock="center" shouldWrap>
        <Stack space="space.025">
          <Text weight="medium">
            {group.displayName} — {group.count} field{group.count === 1 ? "" : "s"}
          </Text>
          <Text size="small">Normalized: {group.normalizedName}</Text>
        </Stack>
        <Inline space="space.050" shouldWrap>
          {group.typeMismatch ? (
            <Lozenge appearance="moved">Different field types</Lozenge>
          ) : (
            <Lozenge appearance="inprogress">Same types</Lozenge>
          )}
          <Button appearance="subtle" onClick={onToggle}>
            {expanded ? "Hide fields" : "Show fields"}
          </Button>
        </Inline>
      </Inline>

      {group.typeMismatch ? (
        <SectionMessage appearance="warning" title="Different field types detected">
          <Text>
            Fields share this name but use different Jira types (
            {(group.types || []).join(", ")}). This may indicate intentionally
            different use cases or configuration drift.
          </Text>
        </SectionMessage>
      ) : null}

      {expanded ? (
        <Stack space="space.075">
          {group.fields.map((field) => (
            <Box
              key={field.id}
              padding="space.100"
              backgroundColor="elevation.surface"
              borderRadius="border.radius"
            >
              <Stack space="space.025">
                <Text weight="medium">{field.name}</Text>
                <Text size="small">{field.id}</Text>
                <Text size="small">Type: {field.type}</Text>
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : null}

      <Text size="small">{group.recommendation}</Text>
    </Stack>
  </Card>
);

const App = () => {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requestId, setRequestId] = useState(0);
  const [section, setSection] = useState("overview");
  const [projectFilter, setProjectFilter] = useState("all");
  const [fieldFilter, setFieldFilter] = useState("duplicates");
  const [expandedGroups, setExpandedGroups] = useState({});

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

  const openRecommendation = (card) => {
    if (card.section === "fields") {
      setSection("fields");
      setFieldFilter(card.filter || "duplicates");
      return;
    }

    setSection("projects");
    setProjectFilter(card.filter || "all");
  };

  const flaggedProjects = useMemo(() => {
    const list = report?.projects?.flagged || [];
    if (projectFilter === "all") {
      return list;
    }

    return list.filter((project) => {
      if (projectFilter === "inactive") {
        return project.inactive && !project.empty;
      }
      if (projectFilter === "empty") {
        return project.empty;
      }
      if (projectFilter === "missing-lead") {
        return !project.leadPresent && !project.archived;
      }
      if (projectFilter === "low-volume") {
        return project.lowVolume;
      }
      return project.classification?.code === projectFilter;
    });
  }, [report, projectFilter]);

  const duplicateGroups = useMemo(() => {
    const list = report?.fields?.duplicateGroups || [];
    if (fieldFilter === "type-mismatch") {
      return list.filter((group) => group.typeMismatch);
    }
    return list;
  }, [report, fieldFilter]);

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
  const findings = report.findings || {
    total: overview.findingsTotal || 0,
    bySeverity: {
      High: overview.findingsHigh || 0,
      Review: overview.findingsReview || 0,
      Informational: overview.findingsInformational || 0,
    },
  };

  return (
    <Box padding="space.200">
      <Stack space="space.300">
        <Inline spread="space-between" alignBlock="start" shouldWrap>
          <Stack space="space.050">
            <Heading size="large">Admin Health Lab</Heading>
            <Text size="small">
              Detect → Explain → Recommend · read-only · v0.2
            </Text>
          </Stack>
          <LoadingButton isLoading={refreshing} onClick={refresh}>
            Refresh
          </LoadingButton>
        </Inline>

        <Inline space="space.050" shouldWrap>
          <Button
            appearance={section === "overview" ? "primary" : "subtle"}
            onClick={() => setSection("overview")}
          >
            Summary
          </Button>
          <Button
            appearance={section === "projects" ? "primary" : "subtle"}
            onClick={() => setSection("projects")}
          >
            Projects
          </Button>
          <Button
            appearance={section === "fields" ? "primary" : "subtle"}
            onClick={() => setSection("fields")}
          >
            Custom fields
          </Button>
        </Inline>

        {section === "overview" ? (
          <Stack space="space.300">
            <Card>
              <Stack space="space.150">
                <Inline space="space.100" alignBlock="center" shouldWrap>
                  <Heading size="medium">Site Health</Heading>
                  <Lozenge
                    appearance={
                      health.score >= 80
                        ? "success"
                        : health.score >= 60
                          ? "inprogress"
                          : "removed"
                    }
                  >
                    {health.score} / {health.max}
                  </Lozenge>
                </Inline>

                <Heading size="small">
                  {findings.total} finding{findings.total === 1 ? "" : "s"}
                </Heading>
                <Stack space="space.050">
                  <Text size="small">
                    · {findings.bySeverity.High || 0} High priority
                  </Text>
                  <Text size="small">
                    · {findings.bySeverity.Review || 0} Review
                  </Text>
                  <Text size="small">
                    · {findings.bySeverity.Informational || 0} Informational
                  </Text>
                </Stack>

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
                  <Text size="small">
                    No hygiene deductions from the current rule set.
                  </Text>
                )}
              </Stack>
            </Card>

            <Stack space="space.100">
              <Heading size="medium">Category summary</Heading>
              <Card>
                <Stack space="space.100">
                  <Inline spread="space-between" alignBlock="center" shouldWrap>
                    <Heading size="small">Projects</Heading>
                    <Button
                      appearance="subtle"
                      onClick={() => {
                        setSection("projects");
                        setProjectFilter("all");
                      }}
                    >
                      Open
                    </Button>
                  </Inline>
                  <Text size="small">
                    {overview.potentiallyInactiveProjects} inactive ·{" "}
                    {overview.emptyProjects} empty ·{" "}
                    {overview.lowVolumeProjects || 0} low-volume ·{" "}
                    {overview.missingLeadProjects || 0} missing lead
                  </Text>
                  <Text size="small">
                    {(overview.strongArchiveCandidates || 0)} strong archive
                    candidates · {(overview.reviewForArchive || 0)} review for
                    archive · {(overview.investigateInactivity || 0)} investigate
                    inactivity
                  </Text>
                </Stack>
              </Card>
              <Card>
                <Stack space="space.100">
                  <Inline spread="space-between" alignBlock="center" shouldWrap>
                    <Heading size="small">Custom Fields</Heading>
                    <Button
                      appearance="subtle"
                      onClick={() => {
                        setSection("fields");
                        setFieldFilter("duplicates");
                      }}
                    >
                      Open
                    </Button>
                  </Inline>
                  <Text size="small">
                    {overview.totalCustomFields} custom fields ·{" "}
                    {overview.duplicateFieldGroups} duplicate-name group
                    {overview.duplicateFieldGroups === 1 ? "" : "s"}
                    {overview.typeMismatchFieldGroups
                      ? ` · ${overview.typeMismatchFieldGroups} with mixed types`
                      : ""}
                  </Text>
                </Stack>
              </Card>
            </Stack>

            <Stack space="space.100">
              <Heading size="medium">Site Overview</Heading>
              <Inline space="space.100" shouldWrap>
                <Kpi label="Projects" value={overview.totalProjects} />
                <Kpi label="Software" value={overview.softwareProjects} />
                <Kpi
                  label="Service Management"
                  value={overview.serviceManagementProjects}
                />
                <Kpi label="Business" value={overview.businessProjects} />
                <Kpi label="Active" value={overview.activeProjects} />
                <Kpi
                  label={`Inactive (≥${report.inactiveDays}d)`}
                  value={overview.potentiallyInactiveProjects}
                />
                <Kpi label="Custom fields" value={overview.totalCustomFields} />
                <Kpi label="Findings" value={findings.total} />
              </Inline>
              <Text size="small">
                Generated {formatTimestamp(report.generatedAt)}. Counts come from
                live Jira project/search and field APIs.
              </Text>
            </Stack>

            <Stack space="space.100">
              <Heading size="medium">Recommended review</Heading>
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
                        <Inline
                          spread="space-between"
                          alignBlock="center"
                          shouldWrap
                        >
                          <Heading size="small">{card.title}</Heading>
                          <Inline space="space.050">
                            {card.severity ? (
                              <Lozenge
                                appearance={severityAppearance(card.severity)}
                              >
                                {card.severity}
                              </Lozenge>
                            ) : null}
                            <Lozenge>{card.count}</Lozenge>
                          </Inline>
                        </Inline>
                        <Text>{card.summary}</Text>
                        <Button
                          appearance="primary"
                          onClick={() => openRecommendation(card)}
                        >
                          {card.actionLabel}
                        </Button>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          </Stack>
        ) : null}

        {section === "projects" ? (
          <Stack space="space.200">
            <Inline spread="space-between" alignBlock="center" shouldWrap>
              <Heading size="medium">Project Hygiene</Heading>
              <Button appearance="subtle" onClick={() => setSection("overview")}>
                Back to summary
              </Button>
            </Inline>

            <Select
              label="Filter findings"
              options={PROJECT_FILTER_OPTIONS}
              value={PROJECT_FILTER_OPTIONS.find(
                (option) => option.value === projectFilter,
              )}
              onChange={(event) => {
                const next = optionFromEvent(event);
                if (next) {
                  setProjectFilter(next);
                }
              }}
            />

            {flaggedProjects.length === 0 ? (
              <EmptyState
                header="No project findings in this view"
                description="Try another filter, or refresh after projects change."
              />
            ) : (
              <Stack space="space.100">
                <Text size="small">
                  Showing {flaggedProjects.length} project
                  {flaggedProjects.length === 1 ? "" : "s"}
                </Text>
                {flaggedProjects.map((project) => (
                  <ProjectFindingCard key={project.key} project={project} />
                ))}
              </Stack>
            )}
          </Stack>
        ) : null}

        {section === "fields" ? (
          <Stack space="space.200">
            <Inline spread="space-between" alignBlock="center" shouldWrap>
              <Heading size="medium">Custom Field Hygiene</Heading>
              <Button appearance="subtle" onClick={() => setSection("overview")}>
                Back to summary
              </Button>
            </Inline>

            <Text size="small">
              {overview.totalCustomFields} custom · {overview.totalSystemFields}{" "}
              system · {overview.duplicateFieldGroups} duplicate-name group
              {overview.duplicateFieldGroups === 1 ? "" : "s"}
            </Text>

            <Select
              label="Filter duplicate groups"
              options={FIELD_FILTER_OPTIONS}
              value={FIELD_FILTER_OPTIONS.find(
                (option) => option.value === fieldFilter,
              )}
              onChange={(event) => {
                const next = optionFromEvent(event);
                if (next) {
                  setFieldFilter(next);
                }
              }}
            />

            {duplicateGroups.length === 0 ? (
              <EmptyState
                header="No duplicate groups in this view"
                description="No custom fields share a trim/case-normalized name for the current filter."
              />
            ) : (
              <Stack space="space.100">
                {duplicateGroups.map((group) => (
                  <DuplicateGroupCard
                    key={group.normalizedName}
                    group={group}
                    expanded={Boolean(expandedGroups[group.normalizedName])}
                    onToggle={() =>
                      setExpandedGroups((current) => ({
                        ...current,
                        [group.normalizedName]: !current[group.normalizedName],
                      }))
                    }
                  />
                ))}
              </Stack>
            )}
          </Stack>
        ) : null}

        {(report.limitations || []).length > 0 && section === "overview" ? (
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
