import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke, router, view } from "@forge/bridge";
import {
  CURRENT_CHECKS,
  FUTURE_COVERAGE,
  INACTIVITY_THRESHOLD_OPTIONS,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
  TRUST_STATEMENT,
} from "@admin-health/constants.js";
import {
  customFieldConfigureUrl,
  customFieldsAdminUrl,
  projectBrowseUrl,
  projectSettingsLocation,
} from "@admin-health/navigation.js";
import "./App.css";

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
    return formatDate(iso);
  }
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  return formatDate(iso);
};

const scoreTone = (score) => {
  if (score >= 80) {
    return "good";
  }
  if (score >= 60) {
    return "warn";
  }
  return "bad";
};

const scoreLabel = (score) => {
  if (score >= 80) {
    return "Healthy";
  }
  return "Needs attention";
};

const openLocation = async (location) => {
  if (!location) {
    return;
  }
  try {
    await router.open(location);
  } catch {
    // Never surface stack traces.
  }
};

const errorCopy = (code) => {
  if (code === "permission") {
    return "Jira Admin Health could not access this configuration area with the current permissions.";
  }
  return "We couldn’t analyze your Jira site right now. Try again in a moment.";
};

const PROJECT_FILTERS = [
  ["all", "All"],
  ["archive-candidates", "Archive candidates"],
  ["inactive", "Inactive"],
  ["empty", "Empty"],
  ["low-volume", "Low volume"],
  ["ownership", "Ownership"],
];

const filterProjects = (list, projectFilter, projectQuery) => {
  const filtered = (list || []).filter((project) => {
    if (projectFilter === "all") {
      return true;
    }
    if (projectFilter === "archive-candidates") {
      return ["strong-archive-candidate", "review-for-archive"].includes(
        project.classification?.code,
      );
    }
    if (projectFilter === "inactive") {
      return project.inactive && !project.empty;
    }
    if (projectFilter === "empty") {
      return project.empty;
    }
    if (projectFilter === "missing-lead" || projectFilter === "ownership") {
      return !project.leadPresent && !project.archived;
    }
    if (projectFilter === "low-volume") {
      return project.lowVolume;
    }
    return project.classification?.code === projectFilter;
  });

  const q = projectQuery.trim().toLowerCase();
  if (!q) {
    return filtered;
  }
  return filtered.filter(
    (project) =>
      project.name.toLowerCase().includes(q) ||
      project.key.toLowerCase().includes(q),
  );
};

function ProjectCounters({ overview }) {
  return (
    <div className="counters">
      <div className="counter">
        <div className="n">{overview.potentiallyInactiveProjects}</div>
        <div className="l">Inactive</div>
      </div>
      <div className="counter">
        <div className="n">{overview.emptyProjects}</div>
        <div className="l">Empty</div>
      </div>
      <div className="counter">
        <div className="n">{overview.lowVolumeProjects || 0}</div>
        <div className="l">Low volume</div>
      </div>
      <div className="counter">
        <div className="n">{overview.missingLeadProjects || 0}</div>
        <div className="l">Ownership</div>
      </div>
      <div className="counter">
        <div className="n">{overview.activeProjects}</div>
        <div className="l">Active</div>
      </div>
    </div>
  );
}

function ProjectTable({
  projects,
  siteUrl,
  expandedProject,
  setExpandedProject,
  emptyMessage,
}) {
  if (projects.length === 0) {
    return <p className="sub">{emptyMessage}</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Project</th>
            <th>Last activity</th>
            <th>Issues</th>
            <th>Status</th>
            <th>Recommendation</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const projectUrl = projectBrowseUrl(siteUrl, project.key);
            const settingsLoc = projectSettingsLocation(project.key);
            const open = expandedProject === project.key;
            return (
              <tr key={project.key}>
                <td>
                  <div className="project-name">
                    {project.name}{" "}
                    <span className="project-key">({project.key})</span>
                  </div>
                  <div className="project-meta">{project.typeLabel}</div>
                  {open ? (
                    <div className="detail-panel">
                      <p>
                        <strong>Why flagged:</strong>{" "}
                        {project.findings
                          .filter((f) => f.code !== "archived")
                          .map((f) => f.title)
                          .join(", ") || "—"}
                      </p>
                      <p>
                        {project.classification?.explanation ||
                          "Review whether this project is still required."}
                      </p>
                      <p>
                        Lead:{" "}
                        {project.leadPresent
                          ? project.leadName || "Assigned"
                          : "None returned"}
                      </p>
                    </div>
                  ) : null}
                </td>
                <td>
                  {project.lastIssueUpdateTime
                    ? formatDate(project.lastIssueUpdateTime)
                    : "Unknown"}
                </td>
                <td>{formatIssueCount(project.totalIssueCount)}</td>
                <td>
                  {project.ageDays != null ? (
                    <span className="status-pill inactive">
                      Inactive for {project.ageDays.toLocaleString()} days
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {project.classification ? (
                    <span
                      className={`pill ${
                        project.classification.severity === "High"
                          ? "high"
                          : project.classification.severity === "Informational"
                            ? "info"
                            : "review"
                      }`}
                    >
                      {project.classification.label}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        setExpandedProject(open ? null : project.key)
                      }
                    >
                      {open ? "Hide" : "Details"}
                    </button>
                    {projectUrl ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => openLocation(projectUrl)}
                      >
                        Open project
                      </button>
                    ) : null}
                    {settingsLoc ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => openLocation(settingsLoc)}
                      >
                        Settings
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DuplicateGroupBlock({
  group,
  siteUrl,
  expanded,
  onToggle,
}) {
  return (
    <div className="dup-block">
      <div className="dup-head">
        <div>
          <div className="dup-kicker">Possible duplication</div>
          <strong>
            {group.displayName} — {group.count} fields
          </strong>
          <div className="sub">Multiple custom fields share this name.</div>
        </div>
        <div className="row-actions">
          {group.typeMismatch ? (
            <span className="pill review">Different field types</span>
          ) : null}
          <button type="button" className="btn" onClick={onToggle}>
            {expanded ? "Hide fields" : "Show fields"}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="dup-body">
          {group.typeMismatch ? (
            <div className="warn-banner">
              Different field types detected. Fields with the same name may still
              serve different purposes. Review types and configuration before
              consolidating.
            </div>
          ) : null}
          <div className="table-wrap nested">
            <table className="data">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>ID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {group.fields.map((field) => {
                  const fieldUrl = customFieldConfigureUrl(siteUrl, field.id);
                  return (
                    <tr key={field.id}>
                      <td>
                        <strong>{field.name}</strong>
                      </td>
                      <td>{field.type}</td>
                      <td className="sub">{field.id}</td>
                      <td>
                        {fieldUrl ? (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => openLocation(fieldUrl)}
                          >
                            Review in Jira
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="sub" style={{ marginTop: 8 }}>
            {group.recommendation}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [sectionErrors, setSectionErrors] = useState({});
  const [settings, setSettings] = useState({ inactiveDays: 90 });
  const [siteUrl, setSiteUrl] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requestId, setRequestId] = useState(0);
  const [section, setSection] = useState("overview");
  const [projectFilter, setProjectFilter] = useState("all");
  const [projectQuery, setProjectQuery] = useState("");
  const [expandedProject, setExpandedProject] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [showScoreHelp, setShowScoreHelp] = useState(false);
  const [showScanDetails, setShowScanDetails] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await invoke("getAdminHealthReport", {
          inactiveDays: settings.inactiveDays,
        });
        if (cancelled) {
          return;
        }

        if (result?.ok && result.report) {
          setReport(result.report);
          setSectionErrors(result.sectionErrors || {});
          if (result.settings?.inactiveDays) {
            setSettings({ inactiveDays: result.settings.inactiveDays });
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
  }, [requestId, settings.inactiveDays]);

  const refresh = () => {
    setError(null);
    setShowMenu(false);
    if (report) {
      setRefreshing(true);
    } else {
      setStatus("loading");
    }
    setRequestId((value) => value + 1);
  };

  const changeInactiveDays = async (nextDays) => {
    const numeric = Number(nextDays);
    if (!numeric || numeric === settings.inactiveDays) {
      return;
    }
    try {
      const result = await invoke("setAdminHealthSettings", {
        inactiveDays: numeric,
      });
      setSettings({
        inactiveDays: result?.settings?.inactiveDays || numeric,
      });
      setRefreshing(true);
      setRequestId((value) => value + 1);
    } catch {
      // keep prior
    }
  };

  const openRecommendation = useCallback((card) => {
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
  }, []);

  const flaggedProjects = useMemo(
    () =>
      filterProjects(
        report?.projects?.flagged || [],
        projectFilter,
        projectQuery,
      ),
    [report, projectFilter, projectQuery],
  );

  const overviewProjects = useMemo(() => {
    const inactive = filterProjects(
      report?.projects?.flagged || [],
      "inactive",
      "",
    );
    if (inactive.length > 0) {
      return inactive.slice(0, 5);
    }
    return (report?.projects?.flagged || []).slice(0, 5);
  }, [report]);

  if (status === "loading" && !report) {
    return (
      <div className="state-screen">
        <div className="box">
          <div className="spinner" />
          <h2>Analyzing Jira site…</h2>
          <p className="sub">Loading projects</p>
          <p className="sub">Loading custom fields</p>
        </div>
      </div>
    );
  }

  if (status === "error" && !report) {
    return (
      <div className="state-screen">
        <div className="box">
          <h2>{PRODUCT_NAME}</h2>
          <p>{errorCopy(error)}</p>
          <button className="btn primary" type="button" onClick={refresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const overview = report.overview;
  const health = report.health;
  const findings = report.findings || {
    total: overview.findingsTotal || 0,
    bySeverity: {
      High: overview.findingsHigh || 0,
      Review: overview.findingsReview || 0,
      Informational: overview.findingsInformational || 0,
    },
  };
  const recommendations = (report.recommendations || []).slice(0, 3);
  const duplicateGroups = report.fields?.duplicateGroups || [];
  const tone = scoreTone(health.score);
  const customFieldsUrl = customFieldsAdminUrl(siteUrl);
  const inactiveCount = overview.potentiallyInactiveProjects || 0;
  const previewGroup = duplicateGroups[0] || null;

  const navBtn = (id, label) => (
    <button
      key={id}
      type="button"
      className={`nav-btn ${section === id ? "active" : ""}`}
      onClick={() => setSection(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>{PRODUCT_NAME}</h1>
          <p>Cleanup Control Center</p>
        </div>

        <nav className="nav-section" aria-label="Primary">
          {navBtn("overview", "Overview")}

          <div className="nav-label">Project hygiene</div>
          {navBtn("projects", "Projects")}
          <button
            type="button"
            className="nav-btn"
            onClick={() => {
              setSection("projects");
              setProjectFilter("archive-candidates");
            }}
          >
            Project findings
          </button>
          {navBtn("settings", "Settings")}

          <div className="nav-label">Custom field hygiene</div>
          {navBtn("fields", "Custom fields")}
          <button
            type="button"
            className="nav-btn"
            onClick={() => setSection("fields")}
          >
            Field findings
          </button>

          <div className="nav-label">Reports</div>
          <button type="button" className="nav-btn" disabled title="Coming soon">
            Executive summary
          </button>
          <button type="button" className="nav-btn" disabled title="Coming soon">
            Health history
          </button>

          <button
            type="button"
            className="nav-btn"
            onClick={() => setShowScanDetails(true)}
          >
            About
          </button>
        </nav>

        <div className="sidebar-foot">
          <div className="threshold-box">
            <div className="label">Inactivity threshold</div>
            <div className="value">
              <span>{settings.inactiveDays} days</span>
              <select
                aria-label="Inactivity threshold"
                value={settings.inactiveDays}
                onChange={(event) => changeInactiveDays(event.target.value)}
              >
                {INACTIVITY_THRESHOLD_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="help-link">Need help? View documentation</div>
        </div>
      </aside>

      <main className="main">
        <header className="page-header">
          <div>
            <h2>
              <span className="brand-mark" aria-hidden="true" />
              {PRODUCT_NAME}
            </h2>
            <p className="tagline">{PRODUCT_TAGLINE}</p>
          </div>
          <div className="header-actions">
            <div className="analyzed-meta">
              <span className="dot-ok" aria-hidden="true" />
              Last analyzed: {relativeAnalyzed(report.generatedAt)}
            </div>
            <div className="btn-row">
              <button
                className="btn primary"
                type="button"
                disabled={refreshing}
                onClick={refresh}
              >
                {refreshing ? "Analyzing…" : "Re-run analysis"}
              </button>
              <div className="menu-wrap">
                <button
                  className="btn icon"
                  type="button"
                  aria-label="More actions"
                  onClick={() => setShowMenu((value) => !value)}
                >
                  ···
                </button>
                {showMenu ? (
                  <div className="menu">
                    <button
                      type="button"
                      onClick={() => {
                        setShowScoreHelp(true);
                        setShowMenu(false);
                      }}
                    >
                      Score calculation
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowScanDetails(true);
                        setShowMenu(false);
                      }}
                    >
                      Scan details
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSection("settings");
                        setShowMenu(false);
                      }}
                    >
                      Settings
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {(section === "overview" || section === "settings") && (
          <>
            <section className="grid-3" aria-label="Summary">
              <article className="card equal">
                <div className="card-kicker">Site Health</div>
                <div className="score-row">
                  <div
                    className={`score-num ${
                      tone === "good" ? "good" : tone === "bad" ? "bad" : ""
                    }`}
                  >
                    {health.score} / {health.max}
                  </div>
                </div>
                <div className="score-caption">
                  <span
                    className={`pill ${tone === "good" ? "ok" : "review"}`}
                  >
                    {scoreLabel(health.score)}
                  </span>
                </div>
                <div
                  className={`meter ${
                    tone === "good" ? "good" : tone === "bad" ? "bad" : ""
                  }`}
                >
                  <span
                    style={{
                      width: `${Math.max(0, Math.min(100, health.score))}%`,
                    }}
                  />
                </div>
                <div className="card-foot">
                  <button
                    type="button"
                    className="btn linkish"
                    onClick={() => setShowScoreHelp((value) => !value)}
                  >
                    How is this score calculated?
                  </button>
                </div>
              </article>

              <article className="card equal">
                <div className="card-kicker">Needs Review</div>
                <div className="big-num">
                  {findings.total}{" "}
                  <span className="unit">
                    item{findings.total === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="sub">
                  {findings.bySeverity.High || 0} high priority ·{" "}
                  {findings.bySeverity.Review || 0} review
                </div>
                <div className="card-foot">
                  <button
                    type="button"
                    className="btn linkish"
                    onClick={() => {
                      if (recommendations[0]) {
                        openRecommendation(recommendations[0]);
                      } else {
                        setSection("projects");
                      }
                    }}
                  >
                    View all recommendations
                  </button>
                </div>
              </article>

              <article className="card equal">
                <div className="card-kicker">Analyzed</div>
                <div className="big-num analyzed-now">
                  <span className="dot-ok lg" aria-hidden="true" />
                  {relativeAnalyzed(report.generatedAt)}
                </div>
                <div className="sub">Projects · Custom Fields</div>
                <div className="card-foot">
                  <button
                    type="button"
                    className="btn linkish"
                    onClick={() => setShowScanDetails((value) => !value)}
                  >
                    View scan details
                  </button>
                </div>
              </article>
            </section>

            {showScoreHelp ? (
              <article className="card soft-panel">
                <div className="card-kicker">Score calculation</div>
                <p className="sub">{health.disclaimer}</p>
                {(health.deductions || []).map((item) => (
                  <p key={item.code} className="sub">
                    −{item.points}: {item.label} ({item.count}) · {item.rule}
                  </p>
                ))}
              </article>
            ) : null}

            {showScanDetails ? (
              <article className="card soft-panel">
                <div className="card-kicker">Scan details</div>
                <p className="sub">
                  <strong>Current checks:</strong> {CURRENT_CHECKS.join(" · ")}
                </p>
                <p className="sub">
                  <strong>Future coverage:</strong> {FUTURE_COVERAGE.join(" · ")}
                </p>
              </article>
            ) : null}

            <h3 className="section-title">
              Why is my score {health.score}?
            </h3>
            <div className="why-grid">
              <button
                type="button"
                className="why-chip"
                onClick={() => {
                  setSection("projects");
                  setProjectFilter("inactive");
                }}
              >
                <strong>{overview.potentiallyInactiveProjects}</strong>
                <span>Inactive projects</span>
              </button>
              <button
                type="button"
                className="why-chip"
                onClick={() => {
                  setSection("projects");
                  setProjectFilter("empty");
                }}
              >
                <strong>{overview.emptyProjects}</strong>
                <span>
                  Empty project{overview.emptyProjects === 1 ? "" : "s"}
                </span>
              </button>
              <button
                type="button"
                className="why-chip"
                onClick={() => setSection("fields")}
              >
                <strong>{overview.duplicateFieldGroups}</strong>
                <span>Duplicate field groups</span>
              </button>
              <button
                type="button"
                className="why-chip"
                onClick={() => {
                  setSection("projects");
                  setProjectFilter("ownership");
                }}
              >
                <strong>{overview.missingLeadProjects || 0}</strong>
                <span>
                  Ownership issue
                  {(overview.missingLeadProjects || 0) === 1 ? "" : "s"}
                </span>
              </button>
            </div>
          </>
        )}

        {section === "overview" ? (
          <>
            <div className="rec-head">
              <h3 className="section-title">Recommended review</h3>
            </div>
            {recommendations.length === 0 ? (
              <article className="card">
                <strong>Nothing needs review right now</strong>
                <p className="sub">
                  Current checks did not find inactive projects, empty projects,
                  ownership gaps, or duplicate field names.
                </p>
              </article>
            ) : (
              <div className="rec-grid">
                {recommendations.map((card) => {
                  const firstMatch =
                    card.section === "projects"
                      ? filterProjects(
                          report.projects?.flagged || [],
                          card.filter === "strong-archive-candidate"
                            ? "archive-candidates"
                            : card.filter || "all",
                          "",
                        )[0]
                      : null;
                  const firstUrl = firstMatch
                    ? projectBrowseUrl(siteUrl, firstMatch.key)
                    : null;

                  return (
                    <article className="card rec-card" key={card.id}>
                      <div>
                        <span
                          className={`pill ${
                            card.severity === "High"
                              ? "high"
                              : card.severity === "Informational"
                                ? "info"
                                : "review"
                          }`}
                        >
                          {card.severity === "High"
                            ? "High priority"
                            : card.severity || "Review"}
                        </span>
                      </div>
                      <strong className="rec-title">{card.title}</strong>
                      <p className="sub">{card.summary}</p>
                      <div className="actions">
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => openRecommendation(card)}
                        >
                          {card.actionLabel}
                        </button>
                        {card.section === "fields" && customFieldsUrl ? (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => openLocation(customFieldsUrl)}
                          >
                            Open Jira admin
                          </button>
                        ) : null}
                        {card.section === "projects" && firstUrl ? (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => openLocation(firstUrl)}
                          >
                            Open in Jira
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <section className="module card">
              <div className="module-head">
                <h3>Project Hygiene</h3>
                <button
                  type="button"
                  className="btn linkish"
                  onClick={() => {
                    setSection("projects");
                    setProjectFilter("all");
                  }}
                >
                  View all projects
                </button>
              </div>
              {sectionErrors.projects ? (
                <p className="sub">{errorCopy(sectionErrors.projects)}</p>
              ) : (
                <>
                  <ProjectCounters overview={overview} />
                  <ProjectTable
                    projects={overviewProjects}
                    siteUrl={siteUrl}
                    expandedProject={expandedProject}
                    setExpandedProject={setExpandedProject}
                    emptyMessage="No project findings in this preview."
                  />
                  {inactiveCount > 0 ? (
                    <div className="module-foot">
                      <button
                        type="button"
                        className="btn linkish"
                        onClick={() => {
                          setSection("projects");
                          setProjectFilter("inactive");
                        }}
                      >
                        View all {inactiveCount} inactive project
                        {inactiveCount === 1 ? "" : "s"}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>

            <section className="module card">
              <div className="module-head">
                <h3>Custom Field Hygiene</h3>
                <button
                  type="button"
                  className="btn linkish"
                  onClick={() => setSection("fields")}
                >
                  View all fields
                </button>
              </div>
              {sectionErrors.fields ? (
                <p className="sub">{errorCopy(sectionErrors.fields)}</p>
              ) : (
                <>
                  <div className="counters two">
                    <div className="counter">
                      <div className="n">{overview.totalCustomFields}</div>
                      <div className="l">Custom fields</div>
                    </div>
                    <div className="counter">
                      <div className="n">{overview.duplicateFieldGroups}</div>
                      <div className="l">Possible duplicate groups</div>
                    </div>
                  </div>

                  {previewGroup ? (
                    <DuplicateGroupBlock
                      group={previewGroup}
                      siteUrl={siteUrl}
                      expanded={
                        expandedGroup === previewGroup.normalizedName ||
                        expandedGroup == null
                      }
                      onToggle={() =>
                        setExpandedGroup((current) => {
                          const isOpen =
                            current === previewGroup.normalizedName ||
                            current == null;
                          return isOpen
                            ? "__closed__"
                            : previewGroup.normalizedName;
                        })
                      }
                    />
                  ) : (
                    <p className="sub">
                      No possible duplicate field names found.
                    </p>
                  )}

                  {duplicateGroups.length > 0 ? (
                    <div className="module-foot">
                      <button
                        type="button"
                        className="btn linkish"
                        onClick={() => setSection("fields")}
                      >
                        View all {duplicateGroups.length} duplicate group
                        {duplicateGroups.length === 1 ? "" : "s"}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </>
        ) : null}

        {section === "projects" ? (
          <section className="module card">
            <div className="module-head">
              <h3>Project Hygiene</h3>
              <button
                type="button"
                className="btn linkish"
                onClick={() => setSection("overview")}
              >
                Back to overview
              </button>
            </div>

            {sectionErrors.projects ? (
              <div>
                <p>{errorCopy(sectionErrors.projects)}</p>
                <button type="button" className="btn primary" onClick={refresh}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                <ProjectCounters overview={overview} />

                <div className="toolbar">
                  <div className="tabs">
                    {PROJECT_FILTERS.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`tab ${projectFilter === value ? "active" : ""}`}
                        onClick={() => setProjectFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    className="search"
                    placeholder="Search projects"
                    value={projectQuery}
                    onChange={(event) => setProjectQuery(event.target.value)}
                  />
                </div>

                <ProjectTable
                  projects={flaggedProjects}
                  siteUrl={siteUrl}
                  expandedProject={expandedProject}
                  setExpandedProject={setExpandedProject}
                  emptyMessage={`No project findings in this view. Inactivity threshold is ${settings.inactiveDays} days.`}
                />
              </>
            )}
          </section>
        ) : null}

        {section === "fields" ? (
          <section className="module card">
            <div className="module-head">
              <h3>Custom Field Hygiene</h3>
              <button
                type="button"
                className="btn linkish"
                onClick={() => setSection("overview")}
              >
                Back to overview
              </button>
            </div>

            {sectionErrors.fields ? (
              <div>
                <p>{errorCopy(sectionErrors.fields)}</p>
                <button type="button" className="btn primary" onClick={refresh}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="counters two">
                  <div className="counter">
                    <div className="n">{overview.totalCustomFields}</div>
                    <div className="l">Custom fields</div>
                  </div>
                  <div className="counter">
                    <div className="n">{overview.duplicateFieldGroups}</div>
                    <div className="l">Possible duplicate groups</div>
                  </div>
                </div>

                {customFieldsUrl ? (
                  <div style={{ marginBottom: 12 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => openLocation(customFieldsUrl)}
                    >
                      Open custom fields
                    </button>
                  </div>
                ) : null}

                {duplicateGroups.length === 0 ? (
                  <p className="sub">
                    No possible duplicate field names found. We did not find
                    custom fields sharing the same normalized name.
                  </p>
                ) : (
                  <div className="dup-list">
                    {duplicateGroups.map((group, index) => {
                      const open =
                        expandedGroup === group.normalizedName ||
                        (expandedGroup == null && index === 0);
                      return (
                        <DuplicateGroupBlock
                          key={group.normalizedName}
                          group={group}
                          siteUrl={siteUrl}
                          expanded={open}
                          onToggle={() =>
                            setExpandedGroup(
                              open ? "__closed__" : group.normalizedName,
                            )
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        ) : null}

        {section === "settings" ? (
          <section className="module card">
            <div className="module-head">
              <h3>Settings</h3>
              <button
                type="button"
                className="btn linkish"
                onClick={() => setSection("overview")}
              >
                Back to overview
              </button>
            </div>
            <p className="sub">
              Projects with no issue activity for at least this many days are
              treated as inactive. Default is 90 days.
            </p>
            <label className="sub" htmlFor="threshold-main">
              Inactivity threshold
            </label>
            <div style={{ marginTop: 8 }}>
              <select
                id="threshold-main"
                value={settings.inactiveDays}
                onChange={(event) => changeInactiveDays(event.target.value)}
              >
                {INACTIVITY_THRESHOLD_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days} days
                  </option>
                ))}
              </select>
            </div>
          </section>
        ) : null}

        <p className="trust">
          <span className="shield" aria-hidden="true" />
          {TRUST_STATEMENT}
        </p>
      </main>
    </div>
  );
}
