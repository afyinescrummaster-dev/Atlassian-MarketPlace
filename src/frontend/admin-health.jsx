import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { invoke, router, view } from "@forge/bridge";
import {
  CURRENT_CHECKS,
  FUTURE_COVERAGE,
  INACTIVITY_THRESHOLD_OPTIONS,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  TRUST_STATEMENT,
} from "../admin-health/constants.js";
import {
  customFieldConfigureUrl,
  customFieldsAdminUrl,
  projectBrowseUrl,
  projectSettingsLocation,
} from "../admin-health/navigation.js";

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
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
};

const formatDate = (value) => {
  if (!value) {
    return "Unknown";
  }
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return String(value);
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

const relativeAnalyzed = (iso) => {
  if (!iso) {
    return "Unknown";
  }
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return formatTimestamp(iso);
  }
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  return formatTimestamp(iso);
};

const severityAppearance = (severity) => {
  if (severity === "High" || severity === "High priority") {
    return "removed";
  }
  if (severity === "Informational") {
    return "new";
  }
  return "moved";
};

const scoreLabel = (score) => {
  if (score >= 80) {
    return "Healthy";
  }
  if (score >= 60) {
    return "Needs attention";
  }
  return "Needs attention";
};

const scoreAppearance = (score) => {
  if (score >= 80) {
    return "success";
  }
  if (score >= 60) {
    return "moved";
  }
  return "removed";
};

const errorMessage = (code) => {
  if (code === "permission") {
    return "Jira Admin Health could not access this configuration area with the current permissions.";
  }
  return "We couldn’t analyze your Jira site right now. Try again in a moment.";
};

const PROJECT_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Archive candidates", value: "archive-candidates" },
  { label: "Inactive", value: "inactive" },
  { label: "Empty", value: "empty" },
  { label: "Low volume", value: "low-volume" },
  { label: "Ownership", value: "missing-lead" },
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

const openLocation = async (location) => {
  if (!location) {
    return;
  }
  try {
    await router.open(location);
  } catch {
    // Swallow — button remains available; never surface stack traces.
  }
};

const SummaryMetricCard = ({ title, children, actionLabel, onAction }) => (
  <Card>
    <Stack space="space.100">
      <Text size="small" weight="medium">
        {title}
      </Text>
      {children}
      {actionLabel && onAction ? (
        <Button appearance="subtle" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Stack>
  </Card>
);

const ProjectFindingCard = ({
  project,
  expanded,
  onToggle,
  siteUrl,
}) => {
  const classification = project.classification;
  const severity = classification?.severity || "Review";
  const projectUrl = projectBrowseUrl(siteUrl, project.key);
  const settingsLocation = projectSettingsLocation(project.key);

  return (
    <Card>
      <Stack space="space.100">
        <Inline spread="space-between" alignBlock="start" shouldWrap>
          <Stack space="space.025">
            <Text weight="medium">
              {project.name} ({project.key})
            </Text>
            <Text size="small">{project.typeLabel}</Text>
          </Stack>
          {classification ? (
            <Lozenge appearance={severityAppearance(severity)}>
              {classification.label}
            </Lozenge>
          ) : null}
        </Inline>

        <Stack space="space.050">
          <Text size="small">
            Last activity:{" "}
            {project.lastIssueUpdateTime
              ? formatDate(project.lastIssueUpdateTime)
              : "Unknown"}
            {project.ageDays != null ? ` · ${project.ageDays.toLocaleString()} days` : ""}
          </Text>
          <Text size="small">
            Issues: {formatIssueCount(project.totalIssueCount)}
          </Text>
          <Text size="small">
            Lead:{" "}
            {project.leadPresent
              ? project.leadName || "Assigned"
              : "None returned"}
          </Text>
        </Stack>

        <Inline space="space.050" shouldWrap>
          <Button appearance="subtle" onClick={onToggle}>
            {expanded ? "Hide details" : "View details"}
          </Button>
          {projectUrl ? (
            <Button
              appearance="subtle"
              onClick={() => openLocation(projectUrl)}
            >
              Open project
            </Button>
          ) : null}
          {settingsLocation ? (
            <Button
              appearance="subtle"
              onClick={() => openLocation(settingsLocation)}
            >
              Open project settings
            </Button>
          ) : null}
        </Inline>

        {expanded ? (
          <Stack space="space.075">
            <Text size="small" weight="medium">
              Why this was flagged
            </Text>
            {project.findings
              .filter((finding) => finding.code !== "archived")
              .map((finding) => (
                <Text key={finding.code} size="small">
                  · {finding.title}: {finding.reason}
                </Text>
              ))}
            {classification?.explanation ? (
              <Stack space="space.050">
                <Text size="small" weight="medium">
                  Recommendation
                </Text>
                <Text size="small">{classification.explanation}</Text>
              </Stack>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
};

const DuplicateGroupCard = ({ group, expanded, onToggle, siteUrl }) => (
  <Card>
    <Stack space="space.100">
      <Inline spread="space-between" alignBlock="center" shouldWrap>
        <Stack space="space.025">
          <Text weight="medium">
            {group.displayName} — {group.count} field
            {group.count === 1 ? "" : "s"}
          </Text>
          <Text size="small">
            Multiple custom fields share this normalized name.
          </Text>
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
            Fields with the same name may still serve different purposes. Review
            their types and configuration before consolidating anything.
          </Text>
        </SectionMessage>
      ) : null}

      {expanded ? (
        <Stack space="space.075">
          {group.fields.map((field) => {
            const fieldUrl = customFieldConfigureUrl(siteUrl, field.id);
            return (
              <Box
                key={field.id}
                padding="space.100"
                backgroundColor="elevation.surface"
                borderRadius="border.radius"
              >
                <Stack space="space.050">
                  <Text weight="medium">{field.name}</Text>
                  <Text size="small">{field.type}</Text>
                  <Text size="small">{field.id}</Text>
                  {fieldUrl ? (
                    <Button
                      appearance="subtle"
                      onClick={() => openLocation(fieldUrl)}
                    >
                      Review field
                    </Button>
                  ) : null}
                </Stack>
              </Box>
            );
          })}
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
  const [sectionErrors, setSectionErrors] = useState({});
  const [settings, setSettings] = useState({ inactiveDays: 90 });
  const [siteUrl, setSiteUrl] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [requestId, setRequestId] = useState(0);
  const [section, setSection] = useState("overview");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showScoreHelp, setShowScoreHelp] = useState(false);
  const [showScanDetails, setShowScanDetails] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    let cancelled = false;
    view
      .getContext()
      .then((context) => {
        if (!cancelled && context?.siteUrl) {
          setSiteUrl(context.siteUrl);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadReport = useCallback(async (inactiveDays) => {
    const result = await invoke("getAdminHealthReport", {
      inactiveDays,
    });
    return result;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await loadReport(settings.inactiveDays);
        if (cancelled) {
          return;
        }

        if (result?.ok && result.report) {
          setReport(result.report);
          setSectionErrors(result.sectionErrors || {});
          if (result.settings?.inactiveDays) {
            setSettings((current) => ({
              ...current,
              inactiveDays: result.settings.inactiveDays,
            }));
          }
          setError(null);
          setStatus("ready");
          setRefreshing(false);
          return;
        }

        setReport(null);
        setSectionErrors(result?.sectionErrors || {});
        setError(result?.error || "unavailable");
        setStatus((current) => (current === "ready" ? current : "error"));
        setRefreshing(false);
      } catch {
        if (cancelled) {
          return;
        }
        setReport(null);
        setError("unavailable");
        setStatus((current) => (current === "ready" ? current : "error"));
        setRefreshing(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [requestId, loadReport, settings.inactiveDays]);

  const refresh = () => {
    setError(null);
    if (report) {
      setRefreshing(true);
    } else {
      setStatus("loading");
    }
    setRequestId((value) => value + 1);
  };

  const changeInactiveDays = async (nextDays) => {
    if (!nextDays || nextDays === settings.inactiveDays) {
      return;
    }
    setSavingSettings(true);
    try {
      const result = await invoke("setAdminHealthSettings", {
        inactiveDays: nextDays,
      });
      const resolved = result?.settings?.inactiveDays || nextDays;
      setSettings({ inactiveDays: resolved });
      setRefreshing(true);
      setRequestId((value) => value + 1);
    } catch {
      // Keep prior setting; avoid raw errors.
    } finally {
      setSavingSettings(false);
    }
  };

  const openRecommendation = (card) => {
    if (card.section === "fields") {
      setSection("fields");
      return;
    }
    setSection("projects");
    if (card.filter === "strong-archive-candidate") {
      setProjectFilter("archive-candidates");
    } else if (card.filter) {
      setProjectFilter(card.filter);
    } else {
      setProjectFilter("all");
    }
  };

  const flaggedProjects = useMemo(() => {
    const list = report?.projects?.flagged || [];
    if (projectFilter === "all") {
      return list;
    }
    if (projectFilter === "archive-candidates") {
      return list.filter((project) =>
        ["strong-archive-candidate", "review-for-archive"].includes(
          project.classification?.code,
        ),
      );
    }
    if (projectFilter === "inactive") {
      return list.filter((project) => project.inactive && !project.empty);
    }
    if (projectFilter === "empty") {
      return list.filter((project) => project.empty);
    }
    if (projectFilter === "missing-lead") {
      return list.filter(
        (project) => !project.leadPresent && !project.archived,
      );
    }
    if (projectFilter === "low-volume") {
      return list.filter((project) => project.lowVolume);
    }
    return list.filter(
      (project) => project.classification?.code === projectFilter,
    );
  }, [report, projectFilter]);

  const duplicateGroups = report?.fields?.duplicateGroups || [];
  const thresholdOptions = INACTIVITY_THRESHOLD_OPTIONS.map((days) => ({
    label: `${days} days`,
    value: String(days),
  }));

  if (status === "loading" && !report) {
    return (
      <Box padding="space.200">
        <Stack space="space.200" alignInline="center">
          <Spinner size="large" />
          <Heading size="medium">Analyzing Jira site…</Heading>
          <Text>Loading projects</Text>
          <Text>Loading custom fields</Text>
        </Stack>
      </Box>
    );
  }

  if (status === "error" && !report) {
    return (
      <Box padding="space.200">
        <Stack space="space.200">
          <Heading size="large">{PRODUCT_NAME}</Heading>
          <SectionMessage appearance="error" title="Unable to analyze site">
            <Text>{errorMessage(error)}</Text>
          </SectionMessage>
          <Button onClick={refresh}>Retry</Button>
        </Stack>
      </Box>
    );
  }

  const overview = report.overview;
  const health = report.health;
  const recommendations = (report.recommendations || []).slice(0, 5);
  const findings = report.findings || {
    total: overview.findingsTotal || 0,
    bySeverity: {
      High: overview.findingsHigh || 0,
      Review: overview.findingsReview || 0,
      Informational: overview.findingsInformational || 0,
    },
  };
  const customFieldsUrl = customFieldsAdminUrl(siteUrl);

  return (
    <Box padding="space.200">
      <Stack space="space.300">
        <Inline spread="space-between" alignBlock="start" shouldWrap>
          <Stack space="space.050">
            <Heading size="large">{PRODUCT_NAME}</Heading>
            <Text>{PRODUCT_TAGLINE}</Text>
          </Stack>
          <Stack space="space.050" alignInline="end">
            <Text size="small">
              Last analyzed: {relativeAnalyzed(report.generatedAt)}
            </Text>
            <LoadingButton isLoading={refreshing} onClick={refresh}>
              Re-run analysis
            </LoadingButton>
          </Stack>
        </Inline>

        <Inline space="space.050" shouldWrap>
          <Button
            appearance={section === "overview" ? "primary" : "subtle"}
            onClick={() => setSection("overview")}
          >
            Overview
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
          <Button
            appearance={section === "settings" ? "primary" : "subtle"}
            onClick={() => setSection("settings")}
          >
            Settings
          </Button>
        </Inline>

        {section === "overview" ? (
          <Stack space="space.300">
            <Inline space="space.100" shouldWrap>
              <SummaryMetricCard
                title="SITE HEALTH"
                actionLabel="How is this calculated?"
                onAction={() => setShowScoreHelp((value) => !value)}
              >
                <Inline space="space.100" alignBlock="center" shouldWrap>
                  <Heading size="large">
                    {health.score} / {health.max}
                  </Heading>
                  <Lozenge appearance={scoreAppearance(health.score)}>
                    {scoreLabel(health.score)}
                  </Lozenge>
                </Inline>
              </SummaryMetricCard>
              <SummaryMetricCard
                title="NEEDS REVIEW"
                actionLabel="View all recommendations"
                onAction={() => {
                  const el = recommendations[0];
                  if (el) {
                    openRecommendation(el);
                  } else {
                    setSection("projects");
                  }
                }}
              >
                <Heading size="large">{findings.total}</Heading>
                <Text size="small">
                  {findings.bySeverity.High || 0} high priority ·{" "}
                  {findings.bySeverity.Review || 0} review
                </Text>
              </SummaryMetricCard>
              <SummaryMetricCard
                title="ANALYZED"
                actionLabel="View scan details"
                onAction={() => setShowScanDetails((value) => !value)}
              >
                <Heading size="medium">
                  {relativeAnalyzed(report.generatedAt)}
                </Heading>
                <Text size="small">Projects · Custom Fields</Text>
              </SummaryMetricCard>
            </Inline>

            {showScoreHelp ? (
              <Card>
                <Stack space="space.100">
                  <Heading size="small">How this score is calculated</Heading>
                  <Text size="small">{health.disclaimer}</Text>
                  {(health.deductions || []).length > 0 ? (
                    health.deductions.map((item) => (
                      <Text key={item.code} size="small">
                        −{item.points}: {item.label} ({item.count}) · {item.rule}
                      </Text>
                    ))
                  ) : (
                    <Text size="small">No deductions from the current rule set.</Text>
                  )}
                </Stack>
              </Card>
            ) : null}

            {showScanDetails ? (
              <Card>
                <Stack space="space.100">
                  <Heading size="small">Current checks</Heading>
                  {CURRENT_CHECKS.map((item) => (
                    <Text key={item} size="small">
                      · {item}
                    </Text>
                  ))}
                  <Heading size="small">Future coverage</Heading>
                  {FUTURE_COVERAGE.map((item) => (
                    <Text key={item} size="small">
                      · {item}
                    </Text>
                  ))}
                </Stack>
              </Card>
            ) : null}

            <Stack space="space.100">
              <Heading size="small">
                Why is my score {health.score}?
              </Heading>
              <Inline space="space.050" shouldWrap>
                <Button
                  appearance="subtle"
                  onClick={() => {
                    setSection("projects");
                    setProjectFilter("inactive");
                  }}
                >
                  {overview.potentiallyInactiveProjects} inactive projects
                </Button>
                <Button
                  appearance="subtle"
                  onClick={() => {
                    setSection("projects");
                    setProjectFilter("empty");
                  }}
                >
                  {overview.emptyProjects} empty
                </Button>
                <Button
                  appearance="subtle"
                  onClick={() => setSection("fields")}
                >
                  {overview.duplicateFieldGroups} duplicate field groups
                </Button>
                <Button
                  appearance="subtle"
                  onClick={() => {
                    setSection("projects");
                    setProjectFilter("missing-lead");
                  }}
                >
                  {overview.missingLeadProjects || 0} ownership
                </Button>
              </Inline>
            </Stack>

            <Stack space="space.100">
              <Heading size="medium">Recommended review</Heading>
              {recommendations.length === 0 ? (
                <EmptyState
                  header="Nothing needs review right now"
                  description="Current checks did not find inactive projects, empty projects, ownership gaps, or duplicate field names."
                />
              ) : (
                <Stack space="space.100">
                  {recommendations.map((card) => (
                    <Card key={card.id}>
                      <Stack space="space.100">
                        <Inline space="space.050" shouldWrap>
                          <Lozenge
                            appearance={severityAppearance(
                              card.severity || "Review",
                            )}
                          >
                            {card.severity === "High"
                              ? "High priority"
                              : card.severity || "Review"}
                          </Lozenge>
                          <Lozenge>{card.count}</Lozenge>
                        </Inline>
                        <Heading size="small">{card.title}</Heading>
                        <Text>{card.summary}</Text>
                        <Inline space="space.050" shouldWrap>
                          <Button
                            appearance="primary"
                            onClick={() => openRecommendation(card)}
                          >
                            {card.actionLabel}
                          </Button>
                          {card.section === "fields" && customFieldsUrl ? (
                            <Button
                              appearance="subtle"
                              onClick={() => openLocation(customFieldsUrl)}
                            >
                              Open Jira admin
                            </Button>
                          ) : null}
                        </Inline>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>

            <Card>
              <Stack space="space.100">
                <Inline spread="space-between" alignBlock="center" shouldWrap>
                  <Heading size="small">Project Hygiene</Heading>
                  <Button
                    appearance="subtle"
                    onClick={() => setSection("projects")}
                  >
                    Open
                  </Button>
                </Inline>
                {sectionErrors.projects ? (
                  <SectionMessage appearance="warning" title="Projects unavailable">
                    <Text>{errorMessage(sectionErrors.projects)}</Text>
                  </SectionMessage>
                ) : (
                  <Text size="small">
                    {overview.potentiallyInactiveProjects} Inactive ·{" "}
                    {overview.emptyProjects} Empty ·{" "}
                    {overview.lowVolumeProjects || 0} Low volume ·{" "}
                    {overview.missingLeadProjects || 0} Ownership ·{" "}
                    {overview.activeProjects} Active
                  </Text>
                )}
              </Stack>
            </Card>

            <Card>
              <Stack space="space.100">
                <Inline spread="space-between" alignBlock="center" shouldWrap>
                  <Heading size="small">Custom Field Hygiene</Heading>
                  <Button
                    appearance="subtle"
                    onClick={() => setSection("fields")}
                  >
                    Open
                  </Button>
                </Inline>
                {sectionErrors.fields ? (
                  <SectionMessage appearance="warning" title="Custom fields unavailable">
                    <Text>{errorMessage(sectionErrors.fields)}</Text>
                  </SectionMessage>
                ) : (
                  <Text size="small">
                    {overview.totalCustomFields} custom fields ·{" "}
                    {overview.duplicateFieldGroups} possible duplicate group
                    {overview.duplicateFieldGroups === 1 ? "" : "s"}
                  </Text>
                )}
              </Stack>
            </Card>
          </Stack>
        ) : null}

        {section === "projects" ? (
          <Stack space="space.200">
            <Inline spread="space-between" alignBlock="center" shouldWrap>
              <Heading size="medium">Project Hygiene</Heading>
              <Button appearance="subtle" onClick={() => setSection("overview")}>
                Back to overview
              </Button>
            </Inline>

            {sectionErrors.projects ? (
              <Stack space="space.100">
                <SectionMessage appearance="error" title="Projects could not be analyzed">
                  <Text>{errorMessage(sectionErrors.projects)}</Text>
                </SectionMessage>
                <Button onClick={refresh}>Retry</Button>
              </Stack>
            ) : (
              <>
                <Text size="small">
                  {overview.potentiallyInactiveProjects} Inactive ·{" "}
                  {overview.emptyProjects} Empty ·{" "}
                  {overview.lowVolumeProjects || 0} Low volume ·{" "}
                  {overview.missingLeadProjects || 0} Ownership ·{" "}
                  {overview.activeProjects} Active
                </Text>

                <Select
                  label="Filter"
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
                    description={`No matches for the current filter. Inactivity threshold is ${settings.inactiveDays} days.`}
                  />
                ) : (
                  <Stack space="space.100">
                    <Text size="small">
                      Showing {flaggedProjects.length} project
                      {flaggedProjects.length === 1 ? "" : "s"}
                    </Text>
                    {flaggedProjects.map((project) => (
                      <ProjectFindingCard
                        key={project.key}
                        project={project}
                        siteUrl={siteUrl}
                        expanded={Boolean(expandedProjects[project.key])}
                        onToggle={() =>
                          setExpandedProjects((current) => ({
                            ...current,
                            [project.key]: !current[project.key],
                          }))
                        }
                      />
                    ))}
                  </Stack>
                )}
              </>
            )}
          </Stack>
        ) : null}

        {section === "fields" ? (
          <Stack space="space.200">
            <Inline spread="space-between" alignBlock="center" shouldWrap>
              <Heading size="medium">Custom Field Hygiene</Heading>
              <Button appearance="subtle" onClick={() => setSection("overview")}>
                Back to overview
              </Button>
            </Inline>

            {sectionErrors.fields ? (
              <Stack space="space.100">
                <SectionMessage appearance="error" title="Custom fields could not be analyzed">
                  <Text>{errorMessage(sectionErrors.fields)}</Text>
                </SectionMessage>
                <Button onClick={refresh}>Retry</Button>
              </Stack>
            ) : (
              <>
                <Text size="small">
                  {overview.totalCustomFields} custom fields ·{" "}
                  {overview.duplicateFieldGroups} possible duplicate group
                  {overview.duplicateFieldGroups === 1 ? "" : "s"}
                </Text>

                {customFieldsUrl ? (
                  <Button
                    appearance="subtle"
                    onClick={() => openLocation(customFieldsUrl)}
                  >
                    Open custom fields
                  </Button>
                ) : null}

                {duplicateGroups.length === 0 ? (
                  <EmptyState
                    header="No possible duplicate field names found"
                    description="We did not find custom fields sharing the same normalized name."
                  />
                ) : (
                  <Stack space="space.100">
                    {duplicateGroups.map((group) => (
                      <DuplicateGroupCard
                        key={group.normalizedName}
                        group={group}
                        siteUrl={siteUrl}
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
              </>
            )}
          </Stack>
        ) : null}

        {section === "settings" ? (
          <Stack space="space.200">
            <Inline spread="space-between" alignBlock="center" shouldWrap>
              <Heading size="medium">Settings</Heading>
              <Button appearance="subtle" onClick={() => setSection("overview")}>
                Back to overview
              </Button>
            </Inline>
            <Card>
              <Stack space="space.100">
                <Heading size="small">Inactivity threshold</Heading>
                <Text size="small">
                  Projects with no issue activity for at least this many days are
                  treated as inactive. Default is 90 days.
                </Text>
                <Select
                  label="Threshold"
                  isDisabled={savingSettings}
                  options={thresholdOptions}
                  value={thresholdOptions.find(
                    (option) =>
                      option.value === String(settings.inactiveDays),
                  )}
                  onChange={(event) => {
                    const next = optionFromEvent(event);
                    if (next) {
                      changeInactiveDays(Number(next));
                    }
                  }}
                />
                {savingSettings ? (
                  <Text size="small">Saving and re-analyzing…</Text>
                ) : null}
              </Stack>
            </Card>
          </Stack>
        ) : null}

        <Text size="small">{TRUST_STATEMENT}</Text>
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
