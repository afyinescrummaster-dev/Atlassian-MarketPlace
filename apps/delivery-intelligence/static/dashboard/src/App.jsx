import { useEffect, useState } from "react";
import { invoke, rovo, view } from "@forge/bridge";
import "./App.css";

const AGENT_KEY = "delivery-intelligence-agent";
const AGENT_NAME = "Delivery Intelligence";

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

const buildFactsPrompt = (snapshot, intent) => {
  const facts = {
    projectKey: snapshot?.context?.projectKey,
    boardName: snapshot?.context?.boardName,
    sprint: snapshot?.sprint,
    healthScore: snapshot?.healthScore,
    healthStatus: snapshot?.healthStatus,
    completionPercent: snapshot?.completionPercent,
    scopeChangePercent: snapshot?.scopeChangePercent,
    addedIssueCount: snapshot?.addedIssueCount,
    carryoverCount: snapshot?.carryoverCount,
    blockedCount: snapshot?.blockedCount,
    staleCount: snapshot?.staleCount,
    topAnomalies: (snapshot?.topAnomalies || []).slice(0, 5),
    capabilities: snapshot?.capabilities,
    limitations: snapshot?.limitations,
  };

  return `${intent}

Use these deterministic FACTS as the source of quantitative truth. Do not invent metrics.

FACTS:
${JSON.stringify(facts, null, 2)}`;
};

const errorCopy = (code, detail) => {
  if (code === "permission") {
    return "This app could not read sprint data with the current permissions.";
  }
  if (code === "missing-project") {
    return "Enter a Jira Software project key (for example the Platform project key).";
  }
  if (code === "project-not-found") {
    return "No Jira project was found for that key. Check the project key and try again.";
  }
  if (detail) {
    return `We couldn’t analyze this sprint right now. ${detail}`;
  }
  return "We couldn’t analyze this sprint right now.";
};

export default function App() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [errorDetail, setErrorDetail] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [projectKey, setProjectKey] = useState(null);
  const [projectInput, setProjectInput] = useState("PLAT");
  const [needsProject, setNeedsProject] = useState(false);
  const [rovoEnabled, setRovoEnabled] = useState(null);
  const [aiMessage, setAiMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setError(null);
      setErrorDetail(null);
      try {
        const context = await view.getContext();
        if (cancelled) {
          return;
        }

        const fromContext =
          context?.extension?.project?.key ||
          context?.extension?.projectKey ||
          context?.project?.key ||
          null;

        if (fromContext) {
          setProjectInput(String(fromContext).toUpperCase());
        }

        const key = (fromContext || projectKey || projectInput || "")
          .toString()
          .trim()
          .toUpperCase();

        if (!fromContext && !projectKey) {
          setNeedsProject(true);
          setStatus("ready");
          setRefreshing(false);
          setSnapshot(null);
          return;
        }

        setNeedsProject(false);
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
        setErrorDetail(result?.detail || null);
        setStatus("error");
        setRefreshing(false);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setSnapshot(null);
        setError("unavailable");
        setErrorDetail(
          typeof err?.message === "string" ? err.message.slice(0, 200) : null,
        );
        setStatus("error");
        setRefreshing(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [requestId, projectKey]);

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

  const loadProject = () => {
    const next = projectInput.trim().toUpperCase();
    if (!next) {
      return;
    }
    setRefreshing(true);
    setProjectKey(next);
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
      await rovo.open({
        type: "forge",
        agentKey: AGENT_KEY,
        agentName: AGENT_NAME,
        prompt: buildFactsPrompt(snapshot, intent),
      });
    } catch {
      setAiMessage(
        "Could not open the Delivery Intelligence agent. Check that Rovo is enabled and this app is installed.",
      );
    }
  };

  if (status === "loading" && !snapshot && !needsProject) {
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
        <p className="sub">{errorCopy(error, errorDetail)}</p>
        <div className="btn-row" style={{ justifyContent: "center" }}>
          <input
            className="search"
            value={projectInput}
            onChange={(event) => setProjectInput(event.target.value)}
            placeholder="Project key"
            aria-label="Project key"
          />
          <button className="btn primary" type="button" onClick={loadProject}>
            Load project
          </button>
          <button className="btn" type="button" onClick={refresh}>
            Retry
          </button>
        </div>
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
          <div className="meta">{contextLine || "Choose a project to analyze"}</div>
        </div>
        <div className="btn-row">
          <input
            className="search"
            value={projectInput}
            onChange={(event) => setProjectInput(event.target.value)}
            placeholder="Project key"
            aria-label="Project key"
          />
          <button className="btn" type="button" onClick={loadProject}>
            Load
          </button>
          <button
            className="btn"
            type="button"
            disabled={refreshing || !projectKey}
            onClick={refresh}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {needsProject && !snapshot ? (
        <article className="card">
          <strong>Choose a project</strong>
          <p className="sub">
            Enter a Software project key for the Platform board, then tap Load.
          </p>
          <div className="btn-row">
            <button
              className="btn primary"
              type="button"
              onClick={loadProject}
            >
              Load project
            </button>
          </div>
        </article>
      ) : null}

      {!needsProject && !snapshot?.sprint ? (
        <article className="card">
          <strong>No active sprint</strong>
          <p className="sub">
            Open this on a Jira Software project with an active sprint on its
            board. Metrics are not estimated when sprint data is unavailable.
          </p>
          {(snapshot?.limitations || []).map((item) => (
            <p className="sub" key={item}>
              {item}
            </p>
          ))}
        </article>
      ) : null}

      {snapshot?.sprint ? (
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
                {snapshot.totalIssueCount ?? 0} sprint issues analyzed
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
      ) : null}

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
              openRovo(
                "Explain this sprint's top risks in plain language for the delivery team.",
              )
            }
          >
            Explain sprint
          </button>
          <button
            className="btn"
            type="button"
            disabled={!snapshot?.sprint}
            onClick={() =>
              openRovo(
                "Recommend the top actions the team should address first. Stay read-only.",
              )
            }
          >
            Recommend actions
          </button>
          <button
            className="btn"
            type="button"
            disabled={!snapshot?.sprint}
            onClick={() =>
              openRovo(
                "Draft a concise leadership brief using only the supplied FACTS.",
              )
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
