import { useEffect, useMemo, useState } from "react";
import { invoke, router, view } from "@forge/bridge";
import { selectAttentionPreview } from "@report/attention-preview.js";
import { calculateMetrics } from "@report/metrics.js";
import { overallHealth } from "@report/health.js";
import {
  getProjectKeyFromContext,
  isValidProjectKey,
} from "@report/project-key.js";
import MappingView from "./MappingView.jsx";
import "./App.css";

const COLORS = {
  total: "#0052CC",
  todo: "#4C9AFF",
  progress: "#6554C0",
  done: "#36B37E",
  overdue: "#DE350B",
  critical: "#BF2600",
  unassigned: "#6B778C",
  track: "#EBECF0",
};

const percent = (part, whole) => {
  if (!whole) {
    return 0;
  }

  return Math.round((part / whole) * 100);
};

const formatGeneratedDate = (value) => {
  if (!value) {
    return "Date unavailable";
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const formatDueDate = (value) => {
  if (!value) {
    return "No due date";
  }

  return value.length >= 10 ? value.slice(0, 10) : value;
};

const priorityColor = (name) => {
  const key = String(name || "none").trim().toLowerCase();

  if (key === "highest" || key === "critical") {
    return "#BF2600";
  }

  if (key === "high") {
    return "#DE350B";
  }

  if (key === "medium") {
    return "#FF8B00";
  }

  if (key === "low") {
    return "#0065FF";
  }

  if (key === "lowest") {
    return "#00B8D9";
  }

  if (key === "informational") {
    return "#6554C0";
  }

  return "#6B778C";
};

const healthFromMetrics = (metrics, reportHealth) =>
  reportHealth || overallHealth(metrics);

const metricDisplay = (availability, value) => {
  if (availability === "not-configured") {
    return "Not configured";
  }

  if (availability === "no-data") {
    return "No data";
  }

  return value;
};

const Icon = ({ name }) => {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  if (name === "stack") {
    return (
      <svg {...common}>
        <rect x="4" y="10" width="16" height="9" rx="1.5" />
        <path d="M7 10V7.5A1.5 1.5 0 0 1 8.5 6h7A1.5 1.5 0 0 1 17 7.5V10" />
        <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" />
      </svg>
    );
  }

  if (name === "clipboard") {
    return (
      <svg {...common}>
        <rect x="6" y="5" width="12" height="15" rx="2" />
        <path d="M9 5.5V4h6v1.5" />
        <path d="M9 11h6M9 15h4" />
      </svg>
    );
  }

  if (name === "cycle") {
    return (
      <svg {...common}>
        <path d="M4.5 12a7.5 7.5 0 0 1 12.4-5.7L18 8" />
        <path d="M19.5 12a7.5 7.5 0 0 1-12.4 5.7L6 16" />
        <path d="M18 4.5V8h-3.5M6 19.5V16h3.5" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M8.5 12.2 11 14.7 15.5 9.5" />
      </svg>
    );
  }

  if (name === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4.5L15 15" />
      </svg>
    );
  }

  if (name === "warning") {
    return (
      <svg {...common}>
        <path d="M12 4 3.8 19h16.4L12 4Z" />
        <path d="M12 10v4.2M12 16.8h.01" />
      </svg>
    );
  }

  if (name === "user") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="4" y="6" width="16" height="14" rx="2" />
        <path d="M8 4v4M16 4v4M4 11h16" />
      </svg>
    );
  }

  if (name === "status") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3 5 6.5v5.2c0 4 2.8 6.8 7 8.3 4.2-1.5 7-4.3 7-8.3V6.5L12 3Z" />
      </svg>
    );
  }

  return null;
};

const Donut = ({
  size = 118,
  thickness = 14,
  segments,
  whole,
  center,
  caption,
  showLabels = false,
}) => {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total =
    whole ?? segments.reduce((sum, segment) => sum + segment.value, 0);
  let dashOffset = 0;

  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={COLORS.track}
          strokeWidth={thickness}
        />
        {total > 0
          ? segments
              .filter((segment) => segment.value > 0)
              .map((segment) => {
                const length = (segment.value / total) * circumference;
                const currentOffset = dashOffset;
                dashOffset += length;

                return (
                  <circle
                    key={segment.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={thickness}
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-currentOffset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    strokeLinecap="butt"
                  />
                );
              })
          : null}
      </svg>
      <div className="donut-center">
        <strong>{center}</strong>
        {caption ? <span>{caption}</span> : null}
      </div>
      {showLabels && total > 0
        ? segments
            .filter((segment) => segment.value > 0)
            .map((segment) => {
              const share = percent(segment.value, total);
              return (
                <span
                  key={`${segment.label}-label`}
                  className={`donut-chip donut-chip-${segment.key}`}
                >
                  {share}%
                </span>
              );
            })
        : null}
    </div>
  );
};

const KpiCard = ({ label, value, tone, icon }) => (
  <article className={`kpi kpi-${tone}`}>
    <span className="kpi-icon">
      <Icon name={icon} />
    </span>
    <p className="kpi-label">{label}</p>
    <p className={`kpi-value${typeof value === "string" ? " kpi-value-text" : ""}`}>
      {value}
    </p>
  </article>
);

const App = () => {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);
  const [report, setReport] = useState(null);
  const [requestId, setRequestId] = useState(0);
  const [screen, setScreen] = useState("report");

  const projectKeyFromContext = getProjectKeyFromContext(context);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextContext = await view.getContext();
        if (cancelled) {
          return;
        }

        setContext(nextContext);

        const key = getProjectKeyFromContext(nextContext);
        if (!isValidProjectKey(key)) {
          setReport(null);
          setError("invalid-project");
          setStatus("error");
          return;
        }

        const result = await invoke("getProjectHealthReport");
        if (cancelled) {
          return;
        }

        if (result?.ok && result.report) {
          setReport(result.report);
          setError(null);
          setStatus("ready");
          return;
        }

        setReport(null);
        setError(result?.error || "unavailable");
        setStatus("error");
      } catch {
        if (cancelled) {
          return;
        }

        setReport(null);
        setError("unavailable");
        setStatus("error");
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const metrics = useMemo(() => {
    if (!report) {
      return null;
    }

    if (report.metrics) {
      return report.metrics;
    }

    return calculateMetrics(report.issues, {
      today: report.today,
      truncated: report.truncated,
      partial: report.partial,
      limit: report.limit,
    });
  }, [report]);

  const attention = useMemo(
    () => selectAttentionPreview(metrics?.attention ?? []),
    [metrics],
  );

  const statusSegments = useMemo(() => {
    if (!metrics) {
      return [];
    }

    const other = Math.max(
      0,
      metrics.total - metrics.toDo - metrics.inProgress - metrics.completed,
    );

    return [
      { key: "todo", label: "To Do", value: metrics.toDo, color: COLORS.todo },
      {
        key: "progress",
        label: "In Progress",
        value: metrics.inProgress,
        color: COLORS.progress,
      },
      { key: "done", label: "Done", value: metrics.completed, color: COLORS.done },
      other > 0
        ? {
            key: "other",
            label: "Other",
            value: other,
            color: COLORS.unassigned,
          }
        : null,
    ].filter(Boolean);
  }, [metrics]);

  const reload = () => {
    setStatus("loading");
    setError(null);
    setRequestId((id) => id + 1);
  };

  const openIssue = (key) => {
    const siteUrl = context?.siteUrl;
    if (!siteUrl || !key) {
      return;
    }

    router.open(`${siteUrl}/browse/${key}`);
  };

  const projectName = report?.project?.name || projectKeyFromContext || "Project";
  const projectKey = report?.project?.key || projectKeyFromContext || "";
  const completion =
    metrics?.completionPercent == null
      ? percent(metrics?.completed || 0, metrics?.total || 0)
      : metrics.completionPercent;
  const health = healthFromMetrics(metrics, report?.health);
  const maxPriority = Math.max(
    1,
    ...(metrics?.priorityBreakdown ?? []).map((row) => row.count),
  );

  return (
    <div className="desk">
      <nav className="app-nav">
        <button
          type="button"
          className={screen === "report" ? "active" : ""}
          onClick={() => setScreen("report")}
        >
          Executive report
        </button>
        <button
          type="button"
          className={screen === "mapping" ? "active" : ""}
          onClick={() => setScreen("mapping")}
        >
          Field mapping
        </button>
      </nav>
      {screen === "mapping" ? (
        <MappingView
          projectKey={projectKeyFromContext || projectKey}
          onClose={() => {
            setScreen("report");
            reload();
          }}
        />
      ) : (
      <article className="sheet" aria-label="Executive Project Health">
        <header className="masthead">
          <div className="masthead-copy">
            <p className="eyebrow">Executive project health</p>
            <h1>
              {projectName}
              {projectKey ? ` · ${projectKey}` : ""}
            </h1>
            <p className="generated">
              <Icon name="calendar" />
              <span>
                {status === "ready"
                  ? formatGeneratedDate(report?.refreshedAt)
                  : "—"}
              </span>
              <button type="button" className="text-button" onClick={reload}>
                Refresh
              </button>
            </p>
          </div>
          {status === "ready" && metrics ? (
            <div
              className={`health-badge health-${health.tone}`}
              title={(health.reasons || []).join(" ")}
            >
              <Icon name={health.tone === "good" ? "check" : "warning"} />
              <span>{health.label}</span>
              <div className="health-tip">
                {(health.reasons || []).map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            </div>
          ) : null}
        </header>

        {status === "loading" ? (
          <div className="state-block">
            <p className="state-title">Preparing the report</p>
            <p className="empty-copy">
              Retrieving live Jira data for the current project.
            </p>
          </div>
        ) : null}

        {status === "error" && error === "invalid-project" ? (
          <div className="state-block">
            <p className="state-title">Project context unavailable</p>
            <p className="empty-copy">
              Open this preview from a Jira project so it can read the current
              project key.
            </p>
            <button type="button" className="primary-button" onClick={reload}>
              Retry
            </button>
          </div>
        ) : null}

        {status === "error" && error === "permission" ? (
          <div className="state-block">
            <p className="state-title">Permission denied</p>
            <p className="empty-copy">
              You do not have permission to view issues in this project.
            </p>
            <button type="button" className="primary-button" onClick={reload}>
              Retry
            </button>
          </div>
        ) : null}

        {status === "error" &&
        error !== "invalid-project" &&
        error !== "permission" ? (
          <div className="state-block">
            <p className="state-title">Report unavailable</p>
            <p className="empty-copy">
              The executive preview could not retrieve project data right now.
            </p>
            <button type="button" className="primary-button" onClick={reload}>
              Retry
            </button>
          </div>
        ) : null}

        {status === "ready" && metrics ? (
          <>
            <section className="kpi-row">
              <KpiCard
                label="Total"
                value={metrics.total}
                tone="total"
                icon="stack"
              />
              <KpiCard
                label="To Do"
                value={metrics.toDo}
                tone="todo"
                icon="clipboard"
              />
              <KpiCard
                label="In Progress"
                value={metrics.inProgress}
                tone="progress"
                icon="cycle"
              />
              <article className="kpi kpi-completion">
                <p className="kpi-label">Completion</p>
                {metrics.availability?.completion === "not-configured" ? (
                  <p className="empty-copy">Not configured</p>
                ) : metrics.availability?.completion === "no-data" ? (
                  <p className="empty-copy">No data</p>
                ) : metrics.total === 0 ? (
                  <p className="empty-copy">No issues to measure.</p>
                ) : (
                  <>
                    <Donut
                      size={108}
                      thickness={11}
                      whole={
                        metrics.completionMetric === "storyPoints"
                          ? metrics.storyPointTotal || 0
                          : metrics.total
                      }
                      center={`${completion}%`}
                      segments={[
                        {
                          key: "done",
                          label: "Done",
                          value:
                            metrics.completionMetric === "storyPoints"
                              ? metrics.storyPointDone
                              : metrics.completed,
                          color: COLORS.done,
                        },
                      ]}
                    />
                    <p className="completion-copy">
                      {metrics.completionMetric === "storyPoints"
                        ? `${metrics.storyPointDone} of ${metrics.storyPointTotal} story points in Done`
                        : `${metrics.completed} of ${metrics.total} issues in Done`}
                    </p>
                  </>
                )}
              </article>
              <KpiCard
                label="Done"
                value={metrics.completed}
                tone="done"
                icon="check"
              />
              <KpiCard
                label="Overdue"
                value={metricDisplay(
                  metrics.availability?.overdue,
                  metrics.overdue,
                )}
                tone="overdue"
                icon="clock"
              />
              <KpiCard
                label="Critical"
                value={metrics.criticalOpen}
                tone="critical"
                icon="warning"
              />
              <KpiCard
                label="Unassigned"
                value={metrics.unassigned}
                tone="unassigned"
                icon="user"
              />
            </section>

            <section className="mid-row">
              <section className="panel">
                <header className="panel-header">
                  <span className="panel-icon panel-icon-status">
                    <Icon name="status" />
                  </span>
                  <h2>Status distribution</h2>
                </header>
                {metrics.total === 0 ? (
                  <p className="empty-copy">No status data is available.</p>
                ) : (
                  <div className="status-layout">
                    <ul className="status-list">
                      {statusSegments.map((segment) => (
                        <li key={segment.key}>
                          <div className="status-copy">
                            <span>
                              <i
                                className="dot"
                                style={{ background: segment.color }}
                              />
                              {segment.label}
                            </span>
                            <strong>
                              {segment.value}
                              <span className="muted">
                                {" "}
                                {percent(segment.value, metrics.total)}%
                              </span>
                            </strong>
                          </div>
                          <div className="track">
                            <span
                              className="track-fill"
                              style={{
                                width: `${percent(segment.value, metrics.total)}%`,
                                background: segment.color,
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                    <Donut
                      size={168}
                      thickness={22}
                      showLabels
                      center={String(metrics.total)}
                      caption="Total issues"
                      segments={statusSegments}
                    />
                  </div>
                )}
              </section>

              <section className="panel">
                <header className="panel-header">
                  <span className="panel-icon panel-icon-priority">
                    <Icon name="shield" />
                  </span>
                  <h2>Priority / risk breakdown</h2>
                </header>
                {metrics.priorityBreakdown.length === 0 ? (
                  <p className="empty-copy">No priority data is available.</p>
                ) : (
                  <ul className="priority-list">
                    {metrics.priorityBreakdown.map((row) => {
                      const color = priorityColor(row.name);
                      return (
                        <li key={row.name}>
                          <span className="priority-mark" style={{ color }}>
                            ▲
                          </span>
                          <span className="priority-name">{row.name}</span>
                          <div className="track">
                            <span
                              className="track-fill"
                              style={{
                                width: `${percent(row.count, maxPriority)}%`,
                                background: color,
                              }}
                            />
                          </div>
                          <strong>
                            {row.count}
                            <span className="muted">
                              {" "}
                              {percent(row.count, metrics.total)}%
                            </span>
                          </strong>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </section>

            <section className="panel attention">
              <header className="panel-header attention-header">
                <span className="panel-icon panel-icon-alert">
                  <Icon name="warning" />
                </span>
                <div>
                  <h2>Requires attention</h2>
                  <p>
                    Most important overdue, critical, or unassigned issues. Each
                    item is listed once.
                  </p>
                </div>
              </header>
              {attention.length === 0 ? (
                <p className="empty-copy">
                  No items currently require attention.
                </p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Summary</th>
                      <th>Reasons</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attention.map((row) => {
                      const duePast =
                        Boolean(row.dueDate) &&
                        Boolean(report.today) &&
                        row.dueDate < report.today;

                      return (
                        <tr key={row.key}>
                          <td>
                            <button
                              type="button"
                              className="issue-link"
                              onClick={() => openIssue(row.key)}
                            >
                              {row.key}
                            </button>
                          </td>
                          <td>{row.summary || "No summary"}</td>
                          <td>
                            <span className="reason-row">
                              {row.reasons.map((reason) => (
                                <span
                                  key={reason}
                                  className={`pill ${
                                    reason === "Unassigned"
                                      ? "pill-amber"
                                      : "pill-red"
                                  }`}
                                >
                                  {reason}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className={duePast ? "due-past" : ""}>
                            <span className="due-cell">
                              <Icon name="calendar" />
                              {formatDueDate(row.dueDate)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </>
        ) : null}

        <footer className="colophon">
          <p>
            {report?.jql ? `Query ${report.jql}` : "Live Jira data"}
          </p>
          <p>Read-only preview · Same source as Project Health Report</p>
        </footer>
      </article>
      )}
    </div>
  );
};

export default App;
