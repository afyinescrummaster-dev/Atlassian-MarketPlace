import { useEffect, useState } from "react";
import { invoke, rovo, view } from "@forge/bridge";
import "./App.css";

const AGENT_KEY = "delivery-intelligence-agent";
const AGENT_NAME = "Delivery Intelligence";
const UI_BUILD = "2.8.0";

const formatMetric = (value, suffix = "") => {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${value}${suffix}`;
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

const buildUserPrompt = (snapshot, intent) => {
  const projectKey = snapshot?.context?.projectKey;
  if (!projectKey) {
    return intent;
  }

  return `${intent} Focus on the current sprint in project ${projectKey}.`;
};

export default function App() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [projectKey, setProjectKey] = useState(null);
  const [rovoEnabled, setRovoEnabled] = useState(null);
  const [aiMessage, setAiMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requestId, setRequestId] = useState(0);

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
          <section className="grid-2">
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
          </section>

          <section className="kpi-grid" aria-label="Sprint KPIs">
            <div className="kpi">
              <div className="n">{formatMetric(snapshot.completionPercent, "%")}</div>
              <div className="l">Completion</div>
            </div>
            <div className="kpi">
              <div className="n">{formatMetric(snapshot.scopeChangePercent, "%")}</div>
              <div className="l">Scope change</div>
            </div>
            <div className="kpi">
              <div className="n">{formatMetric(snapshot.carryoverCount)}</div>
              <div className="l">Carryover</div>
            </div>
            <div className="kpi">
              <div className="n">{formatMetric(snapshot.blockedCount)}</div>
              <div className="l">Blocked</div>
            </div>
            <div className="kpi">
              <div className="n">{formatMetric(snapshot.staleCount)}</div>
              <div className="l">Stale</div>
            </div>
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
                <div className="anomaly" key={item.id}>
                  <strong>{item.title}</strong>
                  <div className="sub">{item.summary}</div>
                </div>
              ))
            )}
          </section>
        </>
      )}

      <section className="ai-panel card">
        <div className="kicker">AI actions</div>
        <p className="sub">
          Rovo is user-triggered only. The dashboard never calls AI automatically.
        </p>
        <div className="btn-row">
          <button
            className="btn primary"
            type="button"
            disabled={!snapshot?.sprint}
            onClick={() =>
              openRovo("Explain this sprint's top risks in plain language.")
            }
          >
            Explain sprint
          </button>
          <button
            className="btn"
            type="button"
            disabled={!snapshot?.sprint}
            onClick={() =>
              openRovo("Recommend the actions this team should address first.")
            }
          >
            Recommend actions
          </button>
          <button
            className="btn"
            type="button"
            disabled={!snapshot?.sprint}
            onClick={() =>
              openRovo("Draft a concise leadership brief for this sprint.")
            }
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
