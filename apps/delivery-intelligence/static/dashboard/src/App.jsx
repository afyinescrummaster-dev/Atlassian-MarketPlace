import { useEffect, useMemo, useState } from "react";
import { invoke, rovo, view } from "@forge/bridge";
import {
  ROVO_INTENTS,
  buildUserPrompt,
} from "../../../src/delivery-intelligence/rovo-intents.js";
import "./App.css";

const AGENT_KEY = "delivery-intelligence-agent";
const AGENT_NAME = "Delivery Intelligence";
const UI_BUILD = "2.9.0";

const formatMetric = (value, suffix = "") => {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${value}${suffix}`;
};

const formatSigned = (value, suffix = "") => {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix}`;
};

const formatShortDate = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const statusClass = (status) => {
  if (status === "On Track") {
    return "good";
  }
  if (status === "Needs Attention") {
    return "bad";
  }
  return "";
};

const directionClass = (direction) => {
  if (direction === "improved") {
    return "good";
  }
  if (direction === "deteriorated") {
    return "bad";
  }
  return "";
};

const directionLabel = (direction) => {
  if (direction === "improved") {
    return "Improved";
  }
  if (direction === "deteriorated") {
    return "Worse";
  }
  if (direction === "unchanged") {
    return "Unchanged";
  }
  return "Unavailable";
};

const IssueRow = ({ issue }) => {
  const parts = [issue.statusName, issue.reason].filter(Boolean);
  if (issue.ageDays != null) {
    const unit = ` ${issue.ageDays} day${issue.ageDays === 1 ? "" : "s"}`;
    if (issue.reason === "Blocked") {
      parts.push(`Blocked for${unit}`);
    } else if (issue.reason === "Stale") {
      parts.push(`No update for${unit}`);
    } else {
      parts.push(unit.trim());
    }
  }
  if (issue.joinedAt) {
    const label = issue.reason === "Added after sprint start" ? "Added" : "Joined";
    parts.push(`${label} ${formatShortDate(issue.joinedAt)}`);
  }

  return (
    <div className="issue-row">
      <div className="issue-key">{issue.key}</div>
      <div className="issue-body">
        <div className="issue-summary">{issue.summary || "No summary"}</div>
        <div className="issue-meta">{parts.join(" · ")}</div>
      </div>
    </div>
  );
};

const IssueList = ({ issues, empty }) => {
  if (!issues?.length) {
    return <p className="sub">{empty}</p>;
  }
  return (
    <div className="issue-list">
      {issues.map((issue) => (
        <IssueRow key={issue.key} issue={issue} />
      ))}
    </div>
  );
};

const DrilldownPanel = ({ title, children, onClose }) => (
  <article className="card drilldown">
    <div className="drilldown-head">
      <strong>{title}</strong>
      <button className="btn" type="button" onClick={onClose}>
        Close
      </button>
    </div>
    {children}
  </article>
);

export default function App() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [projectKey, setProjectKey] = useState(null);
  const [rovoEnabled, setRovoEnabled] = useState(null);
  const [aiMessage, setAiMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requestId, setRequestId] = useState(0);
  const [drilldown, setDrilldown] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setError(null);
      try {
        const context = await view.getContext();
        if (cancelled) {
          return;
        }
        const key =
          context?.extension?.project?.key ||
          context?.extension?.projectKey ||
          context?.project?.key ||
          null;
        setProjectKey(key);

        const result = await invoke("getDeliveryHealth", {
          projectKey: key,
        });
        if (cancelled) {
          return;
        }

        if (result?.ok && result.snapshot) {
          setSnapshot(result.snapshot);
          setStatus("ready");
          setRefreshing(false);
          return;
        }

        setSnapshot(null);
        setError(result?.error || "unavailable");
        setStatus("error");
        setRefreshing(false);
      } catch {
        if (cancelled) {
          return;
        }
        setSnapshot(null);
        setError("unavailable");
        setStatus("error");
        setRefreshing(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    let cancelled = false;
    rovo
      .isEnabled()
      .then((enabled) => {
        if (!cancelled) {
          setRovoEnabled(Boolean(enabled));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRovoEnabled(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = () => {
    setRefreshing(true);
    setRequestId((value) => value + 1);
  };

  const toggleDrilldown = (id) => {
    setDrilldown((current) => (current === id ? null : id));
  };

  const openRovo = async (intent) => {
    setAiMessage(null);
    if (!snapshot) {
      return;
    }
    if (rovoEnabled === false) {
      setAiMessage(
        "Atlassian Rovo is not enabled on this site. Deterministic sprint intelligence below still works.",
      );
      return;
    }

    try {
      if (typeof globalThis.console?.debug === "function") {
        globalThis.console.debug("[delivery-intelligence] rovo-handoff", {
          projectKey: snapshot?.context?.projectKey,
          boardId: snapshot?.context?.boardId,
          sprintId: snapshot?.sprint?.id,
          originalCommittedCount: snapshot?.originalCommittedCount,
          addedIssueCount: snapshot?.addedIssueCount,
          scopeChangePercent: snapshot?.scopeChangePercent,
          carryoverCount: snapshot?.carryoverCount,
        });
      }

      await rovo.open({
        type: "forge",
        agentKey: AGENT_KEY,
        agentName: AGENT_NAME,
        prompt: buildUserPrompt(snapshot, intent),
      });
    } catch {
      setAiMessage(
        "Could not open the Delivery Intelligence agent. Check that Rovo is enabled and this app is installed.",
      );
    }
  };

  const lists = useMemo(() => {
    if (!snapshot) {
      return {};
    }
    return {
      original: snapshot.originalCommittedIssues || [],
      added: snapshot.addedIssues || [],
      blocked: snapshot.blockedIssues || [],
      carryover: snapshot.carryoverIssues || [],
      stale: snapshot.staleIssues || [],
      done: snapshot.doneIssues || [],
      open: snapshot.openIssues || [],
    };
  }, [snapshot]);

  if (status === "loading" && !snapshot) {
    return (
      <div className="state">
        <div className="spinner" />
        <p>Loading sprint intelligence…</p>
      </div>
    );
  }

  if (status === "error" && !snapshot) {
    return (
      <div className="state">
        <h2>Delivery Intelligence</h2>
        <p className="sub">
          {error === "permission"
            ? "This app could not read sprint data with the current permissions."
            : error === "missing-project"
              ? "Open Delivery Intelligence from a Jira Software project with an active sprint."
              : "We couldn’t analyze this sprint right now. Open a Jira Software project that has a board and an active sprint, then retry."}
        </p>
        {error && error !== "permission" && error !== "missing-project" ? (
          <p className="sub">Error code: {error}</p>
        ) : null}
        <button className="btn primary" type="button" onClick={refresh}>
          Retry
        </button>
      </div>
    );
  }

  const contextLine = [
    projectKey ? `Project ${projectKey}` : null,
    snapshot?.context?.boardName ? `Board ${snapshot.context.boardName}` : null,
    snapshot?.sprint?.name ? `Sprint ${snapshot.sprint.name}` : "No active sprint",
  ]
    .filter(Boolean)
    .join(" · ");

  const renderDrilldown = (id) => {
    if (drilldown !== id) {
      return null;
    }
    if (id === "completion") {
      return (
        <DrilldownPanel title="Sprint issues" onClose={() => setDrilldown(null)}>
          <div className="split-lists">
            <div>
              <div className="kicker">Done ({lists.done.length})</div>
              <IssueList issues={lists.done} empty="No Done issues in this sprint." />
            </div>
            <div>
              <div className="kicker">Open ({lists.open.length})</div>
              <IssueList issues={lists.open} empty="No open issues in this sprint." />
            </div>
          </div>
        </DrilldownPanel>
      );
    }

    const config = {
      original: {
        title: "Original commitment",
        issues: lists.original,
        empty: "No original-commitment issues were classified.",
      },
      added: {
        title: "Added after start",
        issues: lists.added,
        empty: "No issues were added after sprint start.",
      },
      blocked: {
        title: "Blocked issues",
        issues: lists.blocked,
        empty: "No blocked issues were detected.",
      },
      carryover: {
        title: "Carryover issues",
        issues: lists.carryover,
        empty: "No carryover issues were detected.",
      },
      stale: {
        title: "Stale issues",
        issues: lists.stale,
        empty: "No stale issues were detected.",
      },
    }[id];

    if (!config) {
      return null;
    }

    return (
      <DrilldownPanel title={config.title} onClose={() => setDrilldown(null)}>
        <IssueList issues={config.issues} empty={config.empty} />
      </DrilldownPanel>
    );
  };

  return (
    <div className="shell">
      <header className="header">
        <div>
          <h1>Delivery Intelligence</h1>
          <div className="meta">
            {contextLine}
            {contextLine ? " · " : ""}
            Build {UI_BUILD}
          </div>
        </div>
        <div className="btn-row">
          <button
            className="btn"
            type="button"
            disabled={refreshing}
            onClick={refresh}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {!snapshot?.sprint ? (
        <article className="card">
          <strong>No active sprint</strong>
          <p className="sub">
            Open this page on a Jira Software project with an active sprint on
            its board. Metrics are not estimated when sprint data is unavailable.
          </p>
          {(snapshot?.limitations || []).map((item) => (
            <p className="sub" key={item}>
              {item}
            </p>
          ))}
        </article>
      ) : (
        <>
          <section>
            <h2 className="section-title">Sprint Overview</h2>
            <div className="grid-2">
              <article className="card">
                <div className="kicker">Sprint Health</div>
                <div className="score">
                  {formatMetric(snapshot.healthScore)} / {snapshot.healthMax || 100}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span className={`pill ${statusClass(snapshot.healthStatus)}`}>
                    {snapshot.healthStatus || "—"}
                  </span>
                </div>
              </article>
              <article className="card">
                <div className="kicker">Snapshot</div>
                <p className="sub">
                  Generated {new Date(snapshot.generatedAt).toLocaleString()}
                </p>
                <p className="sub">
                  {snapshot.currentIssueCount ?? snapshot.totalIssueCount ?? 0} current
                  {snapshot.originalCommittedCount != null
                    ? ` · ${snapshot.originalCommittedCount} original commitment`
                    : ""}
                  {snapshot.addedIssueCount != null
                    ? ` · ${snapshot.addedIssueCount} added after start`
                    : ""}
                </p>
                {(snapshot.limitations || []).slice(0, 2).map((item) => (
                  <p className="sub" key={item}>
                    {item}
                  </p>
                ))}
              </article>
            </div>

            <section className="kpi-grid" aria-label="Sprint KPIs">
              <button
                className={`kpi ${drilldown === "completion" ? "active" : ""}`}
                type="button"
                onClick={() => toggleDrilldown("completion")}
              >
                <div className="n">{formatMetric(snapshot.completionPercent, "%")}</div>
                <div className="l">Completion</div>
              </button>
              <button
                className={`kpi ${drilldown === "added" ? "active" : ""}`}
                type="button"
                onClick={() => toggleDrilldown("added")}
              >
                <div className="n">{formatMetric(snapshot.scopeChangePercent, "%")}</div>
                <div className="l">Scope change</div>
              </button>
              <button
                className={`kpi ${drilldown === "carryover" ? "active" : ""}`}
                type="button"
                onClick={() => toggleDrilldown("carryover")}
              >
                <div className="n">{formatMetric(snapshot.carryoverCount)}</div>
                <div className="l">Carryover</div>
              </button>
              <button
                className={`kpi ${drilldown === "blocked" ? "active" : ""}`}
                type="button"
                onClick={() => toggleDrilldown("blocked")}
              >
                <div className="n">{formatMetric(snapshot.blockedCount)}</div>
                <div className="l">Blocked</div>
              </button>
              <button
                className={`kpi ${drilldown === "stale" ? "active" : ""}`}
                type="button"
                onClick={() => toggleDrilldown("stale")}
              >
                <div className="n">{formatMetric(snapshot.staleCount)}</div>
                <div className="l">Stale</div>
              </button>
            </section>
          </section>

          <section>
            <h2 className="section-title">Scope Movement</h2>
            <article className="card scope-card">
              <p className="sub scope-intro">
                Original commitment versus work added after the sprint started.
                Growth is added after start divided by original commitment, not
                current total.
              </p>
              <div className="scope-grid">
                <button
                  className={`scope-stat ${drilldown === "original" ? "active" : ""}`}
                  type="button"
                  onClick={() => toggleDrilldown("original")}
                >
                  <div className="n">{formatMetric(snapshot.originalCommittedCount)}</div>
                  <div className="l">Original commitment</div>
                </button>
                <button
                  className={`scope-stat ${drilldown === "added" ? "active" : ""}`}
                  type="button"
                  onClick={() => toggleDrilldown("added")}
                >
                  <div className="n">{formatMetric(snapshot.addedIssueCount)}</div>
                  <div className="l">Added after start</div>
                </button>
                <div className="scope-stat">
                  <div className="n">{formatMetric(snapshot.currentIssueCount)}</div>
                  <div className="l">Current scope</div>
                </div>
                <button
                  className={`scope-stat ${drilldown === "added" ? "active" : ""}`}
                  type="button"
                  onClick={() => toggleDrilldown("added")}
                >
                  <div className="n">{formatSigned(snapshot.scopeChangePercent, "%")}</div>
                  <div className="l">Scope growth</div>
                </button>
              </div>
              <p className="note">
                Removed / De-scoped is unavailable. Reliable removal history is
                not available yet, so net change is not shown.
              </p>
              <div className="btn-row">
                <button
                  className="btn"
                  type="button"
                  onClick={() => toggleDrilldown("original")}
                >
                  View original commitment
                </button>
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => toggleDrilldown("added")}
                >
                  View added issues
                </button>
              </div>
            </article>
            {["original", "added"].includes(drilldown) ? renderDrilldown(drilldown) : null}
          </section>

          <section>
            <h2 className="section-title">What needs attention</h2>
            {(snapshot.topAnomalies || []).length === 0 ? (
              <article className="card">
                <p className="sub">
                  No ranked anomalies were detected from the current sprint data.
                </p>
              </article>
            ) : (
              snapshot.topAnomalies.map((item) => (
                <article className="anomaly" key={item.id}>
                  <div className="anomaly-head">
                    <span className={`pill ${item.severity === "High" ? "bad" : ""}`}>
                      {item.severity}
                    </span>
                    <strong>{item.title}</strong>
                  </div>
                  <p className="sub">{item.explanation || item.summary}</p>
                  {item.evidence ? <p className="note">{item.evidence}</p> : null}
                  <div className="anomaly-meta">
                    {item.affectedIssueCount != null
                      ? `${item.affectedIssueCount} issue${item.affectedIssueCount === 1 ? "" : "s"}`
                      : null}
                    {item.issueKey ? ` · ${item.issueKey}` : ""}
                  </div>
                  {item.suggestedAction && item.drillDown ? (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => toggleDrilldown(item.drillDown)}
                    >
                      {item.suggestedAction}
                    </button>
                  ) : null}
                </article>
              ))
            )}
            {drilldown && !["original", "added"].includes(drilldown)
              ? renderDrilldown(drilldown)
              : null}
          </section>

          <section>
            <h2 className="section-title">Sprint Trends</h2>
            <article className="card">
              <div className="kicker">Current sprint vs previous sprint</div>
              {snapshot.comparison?.capability?.status === "unavailable" ||
              !snapshot.comparison?.rows?.length ? (
                <p className="sub">
                  {snapshot.comparison?.capability?.reason ||
                    "Previous sprint comparison is unavailable."}
                </p>
              ) : (
                <>
                  <p className="sub">
                    {snapshot.sprint?.name || "Current sprint"} vs{" "}
                    {snapshot.comparison.previousSprint?.name || "previous sprint"}
                    {snapshot.comparison.capability.status === "partial"
                      ? " · Partial historical data"
                      : ""}
                  </p>
                  {snapshot.comparison.capability.status === "partial" ? (
                    <p className="note">{snapshot.comparison.capability.reason}</p>
                  ) : null}
                  <div className="compare-list">
                    {snapshot.comparison.rows.map((row) => (
                      <div className="compare-row" key={row.key}>
                        <div className="compare-label">{row.label}</div>
                        <div className="compare-values">
                          {formatMetric(
                            row.current,
                            row.key.includes("Percent") || row.key === "healthScore"
                              ? row.key === "healthScore"
                                ? ""
                                : "%"
                              : "",
                          )}{" "}
                          vs{" "}
                          {formatMetric(
                            row.previous,
                            row.key.includes("Percent") || row.key === "healthScore"
                              ? row.key === "healthScore"
                                ? ""
                                : "%"
                              : "",
                          )}
                        </div>
                        <div className="compare-delta">
                          <span className={`pill ${directionClass(row.direction)}`}>
                            {directionLabel(row.direction)}
                          </span>
                          <span className="sub">
                            {row.delta == null
                              ? "—"
                              : formatSigned(
                                  row.delta,
                                  row.key === "healthScore" || row.key.includes("Percent")
                                    ? row.key === "healthScore"
                                      ? " points"
                                      : " points"
                                    : "",
                                )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </article>
          </section>
        </>
      )}

      <section className="ai-panel card">
        <div className="kicker">AI actions</div>
        <p className="sub">
          Rovo is user-triggered only. The dashboard never calls AI automatically.
          Each action retrieves deterministic sprint facts behind the scenes.
        </p>
        <div className="btn-row">
          <button
            className="btn primary"
            type="button"
            disabled={!snapshot?.sprint}
            onClick={() => openRovo(ROVO_INTENTS.explain)}
          >
            Explain sprint
          </button>
          <button
            className="btn"
            type="button"
            disabled={!snapshot?.sprint}
            onClick={() => openRovo(ROVO_INTENTS.recommend)}
          >
            Recommend actions
          </button>
          <button
            className="btn"
            type="button"
            disabled={!snapshot?.sprint}
            onClick={() => openRovo(ROVO_INTENTS.brief)}
          >
            Generate leadership brief
          </button>
        </div>
        {rovoEnabled === false ? (
          <p className="note">
            Atlassian Rovo is not enabled on this site. Deterministic metrics
            remain available; AI explanations require Rovo on a paid Jira plan.
          </p>
        ) : null}
        {aiMessage ? <p className="note">{aiMessage}</p> : null}
      </section>
    </div>
  );
}
