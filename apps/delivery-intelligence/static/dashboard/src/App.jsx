import { useEffect, useMemo, useState } from "react";
import { invoke, router, rovo, view } from "@forge/bridge";
import {
  ROVO_INTENTS,
  buildUserPrompt,
} from "../../../src/delivery-intelligence/rovo-intents.js";
import {
  cardsFromIssuesOrKeys,
  jiraPathForJql,
  jiraPathForKeys,
  jqlForSprint,
} from "../../../src/delivery-intelligence/jira-links.js";
import {
  DASHBOARD_TABS,
  allFindingsCount,
  attentionLevelLabel,
  buildCoachAttentionItems,
  groupPaceSignals,
  groupReadinessFindings,
  isSprintEndPassed,
  overviewReadinessCounts,
  paceHeadline,
  paceSummaryCopy,
  pickLearningInsight,
  topCoachAttention,
} from "./dashboard-ia.js";
import "./App.css";

const AGENT_KEY = "delivery-intelligence-agent";
const AGENT_NAME = "Delivery Intelligence";
const UI_BUILD = "2.11.0";

const BRIEF_KEYS = {
  team: "teamUpdate",
  leadership: "leadershipBrief",
  retro: "retrospectiveSummary",
};

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

const readinessTone = (assessment) => {
  if (assessment === "Ready") {
    return "good";
  }
  if (assessment === "Needs attention") {
    return "bad";
  }
  return "";
};

const IssueRow = ({ issue, onOpen }) => {
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
    <button className="issue-row" type="button" onClick={() => onOpen(issue.key)}>
      <div className="issue-key">{issue.key}</div>
      <div className="issue-body">
        <div className="issue-summary">{issue.summary || "Open this issue in Jira"}</div>
        <div className="issue-meta">{parts.join(" · ")}</div>
      </div>
    </button>
  );
};

const IssueList = ({ issues, empty, onOpen }) => {
  if (!issues?.length) {
    return <p className="sub">{empty}</p>;
  }
  return (
    <div className="issue-list">
      {issues.map((issue) => (
        <IssueRow key={issue.key} issue={issue} onOpen={onOpen} />
      ))}
    </div>
  );
};

const DrilldownPanel = ({ title, onClose, onOpenJira, canOpenJira, children }) => (
  <article className="card drilldown">
    <div className="drilldown-head">
      <strong>{title}</strong>
      <div className="btn-row">
        {canOpenJira ? (
          <button className="btn primary" type="button" onClick={onOpenJira}>
            Show in Jira
          </button>
        ) : null}
        <button className="btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
    {children}
  </article>
);

const AttentionRow = ({ item, active, onOpen }) => (
  <div className={`attention-row ${active ? "active" : ""}`}>
    <div className="attention-copy">
      <div className="attention-head">
        <span
          className={`pill ${
            item.severity === "high" || item.severity === "critical" ? "bad" : ""
          }`}
        >
          {attentionLevelLabel(item.severity)}
        </span>
        <strong>{item.title}</strong>
      </div>
      <p className="sub attention-summary">{item.summary}</p>
    </div>
    <button className="btn" type="button" onClick={() => onOpen(item.drillId)}>
      {item.suggestedAction || "View details"}
    </button>
  </div>
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
  const [navMessage, setNavMessage] = useState(null);
  const [briefKind, setBriefKind] = useState("team");
  const [copyMessage, setCopyMessage] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

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

  const openJiraPath = async (path) => {
    if (!path) {
      return false;
    }
    await router.open(path);
    return true;
  };

  const openIssue = async (issueKey) => {
    if (!issueKey) {
      return;
    }
    setNavMessage(null);
    try {
      await openJiraPath(`/browse/${issueKey}`);
    } catch {
      setNavMessage(`Could not open ${issueKey} in Jira.`);
    }
  };

  const openRovo = async (intent, customPrompt = null) => {
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
        prompt: customPrompt || buildUserPrompt(snapshot, intent),
      });
    } catch {
      setAiMessage(
        "Could not open the Delivery Intelligence agent. Check that Rovo is enabled and this app is installed.",
      );
    }
  };

  const selectedBrief = snapshot?.briefs?.[BRIEF_KEYS[briefKind]] || null;

  const copyBrief = async (asMarkdown = false) => {
    setCopyMessage(null);
    if (!selectedBrief) {
      return;
    }
    const text = asMarkdown ? selectedBrief.markdown : selectedBrief.plain;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyMessage(asMarkdown ? "Markdown copied." : "Plain text copied.");
        return;
      }
    } catch {
      // fall through
    }
    setCopyMessage("Could not copy automatically. Select the brief text manually.");
  };

  const openBriefInRovo = () => {
    if (!selectedBrief) {
      return;
    }
    const prompt = `Review and refine this ${selectedBrief.title} using Delivery Intelligence facts. Keep coaching language careful and do not invent metrics.\n\n${selectedBrief.plain}`;
    openRovo(ROVO_INTENTS.brief, prompt);
  };

  const issueIndex = useMemo(() => {
    const map = new Map();
    if (!snapshot) {
      return map;
    }
    const pools = [
      snapshot.originalCommittedIssues,
      snapshot.addedIssues,
      snapshot.blockedIssues,
      snapshot.carryoverIssues,
      snapshot.staleIssues,
      snapshot.doneIssues,
      snapshot.openIssues,
    ];
    for (const pool of pools) {
      for (const issue of pool || []) {
        if (issue?.key && !map.has(issue.key)) {
          map.set(issue.key, issue);
        }
      }
    }
    return map;
  }, [snapshot]);

  const lists = useMemo(() => {
    if (!snapshot) {
      return {};
    }
    return {
      original: cardsFromIssuesOrKeys(
        snapshot.originalCommittedIssues,
        snapshot.originalCommittedIssueKeys,
        "Original commitment",
      ),
      added: cardsFromIssuesOrKeys(
        snapshot.addedIssues,
        snapshot.addedIssueKeys,
        "Added after sprint start",
      ),
      blocked: cardsFromIssuesOrKeys(
        snapshot.blockedIssues,
        snapshot.blockedIssues?.map((row) => row.key),
        "Blocked",
      ),
      carryover: cardsFromIssuesOrKeys(
        snapshot.carryoverIssues,
        snapshot.carryoverIssueKeys,
        "Carried from the previous completed sprint",
      ),
      stale: cardsFromIssuesOrKeys(
        snapshot.staleIssues,
        snapshot.staleIssues?.map((row) => row.key),
        "Stale",
      ),
      done: cardsFromIssuesOrKeys(snapshot.doneIssues, [], "Done"),
      open: cardsFromIssuesOrKeys(snapshot.openIssues, [], "Open"),
      current: cardsFromIssuesOrKeys(
        [...(snapshot.doneIssues || []), ...(snapshot.openIssues || [])],
        snapshot.currentIssueKeys,
        "Current sprint issue",
      ),
    };
  }, [snapshot]);

  const readinessGroups = useMemo(
    () => groupReadinessFindings(snapshot?.readinessFindings || []),
    [snapshot],
  );
  const paceGroups = useMemo(
    () => groupPaceSignals(snapshot?.deliveryPace?.signals || []),
    [snapshot],
  );
  const coachItems = useMemo(() => buildCoachAttentionItems(snapshot), [snapshot]);
  const overviewCoachItems = useMemo(() => topCoachAttention(snapshot, 3), [snapshot]);
  const readinessCounts = useMemo(
    () => overviewReadinessCounts(snapshot?.readiness),
    [snapshot],
  );
  const learningInsight = useMemo(() => pickLearningInsight(snapshot), [snapshot]);
  const coachingById = useMemo(() => {
    const map = new Map();
    for (const item of snapshot?.coachingInterventions || []) {
      map.set(`coach:${item.id}`, item);
    }
    return map;
  }, [snapshot]);
  const sprintEnded = useMemo(
    () => isSprintEndPassed(snapshot?.sprint),
    [snapshot],
  );
  const findingsTotal = allFindingsCount(snapshot);

  const groupedLookup = useMemo(() => {
    const cardsForKeys = (keys, reason) =>
      cardsFromIssuesOrKeys(
        (keys || []).map((key) => issueIndex.get(key)).filter(Boolean),
        keys,
        reason,
      );
    const map = new Map();
    for (const group of readinessGroups) {
      map.set(group.id, {
        title: group.title,
        issues: cardsForKeys(group.issueKeys, group.title),
        empty: "No issues were grouped for this finding.",
      });
    }
    for (const group of paceGroups) {
      const issues =
        group.issueKeys.length > 0
          ? cardsForKeys(group.issueKeys, group.title)
          : (group.signals || [])
              .map((signal) => signal.issueKey)
              .filter(Boolean)
              .map((key) => issueIndex.get(key) || { key, summary: "", reason: group.title });
      map.set(group.id, {
        title: group.title,
        issues,
        empty: group.explanation || "No issues were grouped for this signal.",
        note: group.explanation,
      });
    }
    return map;
  }, [readinessGroups, paceGroups, issueIndex]);

  const pathForDrilldown = (id) => {
    if (id === "completion") {
      return (
        jiraPathForJql(
          jqlForSprint(snapshot?.context?.projectKey, snapshot?.sprint?.id),
        ) || jiraPathForKeys([...(lists.done || []), ...(lists.open || [])].map((row) => row.key))
      );
    }
    if (id === "findings") {
      const keys = readinessGroups.flatMap((group) => group.issueKeys);
      return jiraPathForKeys(keys);
    }
    if (coachingById.has(id)) {
      return jiraPathForKeys(coachingById.get(id).issueKeys || []);
    }
    if (groupedLookup.has(id)) {
      return jiraPathForKeys((groupedLookup.get(id).issues || []).map((row) => row.key));
    }
    const issues = lists[id] || [];
    return jiraPathForKeys(issues.map((row) => row.key));
  };

  const showDrilldown = (id) => {
    setNavMessage(null);
    setDrilldown((current) => (current === id ? null : id));
  };

  const switchTab = (tabId, nextDrilldown = null) => {
    setActiveTab(tabId);
    setNavMessage(null);
    setDrilldown(nextDrilldown);
  };

  const openInJira = async (id) => {
    const path = pathForDrilldown(id);
    if (!path) {
      setNavMessage("There are no issues to show in Jira for this list.");
      return;
    }
    setNavMessage(null);
    try {
      await openJiraPath(path);
    } catch {
      setNavMessage("Could not open Jira. Click an issue key below instead.");
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

  const renderDrilldown = (id) => {
    if (drilldown !== id) {
      return null;
    }
    if (id === "completion") {
      return (
        <DrilldownPanel
          title="Sprint issues"
          onClose={() => setDrilldown(null)}
          canOpenJira={Boolean(pathForDrilldown("completion"))}
          onOpenJira={() => openInJira("completion")}
        >
          <div className="split-lists">
            <div>
              <div className="kicker">Done ({lists.done.length})</div>
              <IssueList
                issues={lists.done}
                empty="No Done issues in this sprint."
                onOpen={openIssue}
              />
            </div>
            <div>
              <div className="kicker">Open ({lists.open.length})</div>
              <IssueList
                issues={lists.open}
                empty="No open issues in this sprint."
                onOpen={openIssue}
              />
            </div>
          </div>
        </DrilldownPanel>
      );
    }

    if (id === "findings") {
      return (
        <DrilldownPanel
          title={`All findings (${findingsTotal})`}
          onClose={() => setDrilldown(null)}
          canOpenJira={Boolean(pathForDrilldown("findings"))}
          onOpenJira={() => openInJira("findings")}
        >
          <div className="grouped-list">
            {coachItems.map((item) => (
              <AttentionRow
                key={item.id}
                item={item}
                active={false}
                onOpen={(nextId) => showDrilldown(nextId)}
              />
            ))}
          </div>
        </DrilldownPanel>
      );
    }

    if (coachingById.has(id)) {
      const item = coachingById.get(id);
      const issues = cardsFromIssuesOrKeys(
        (item.issueKeys || []).map((key) => issueIndex.get(key)).filter(Boolean),
        item.issueKeys,
        item.title,
      );
      return (
        <DrilldownPanel
          title={item.title}
          onClose={() => setDrilldown(null)}
          canOpenJira={Boolean(jiraPathForKeys(item.issueKeys || []))}
          onOpenJira={() => openInJira(id)}
        >
          <p className="note">
            <strong>Evidence:</strong> {item.evidence}
          </p>
          <p className="sub">
            <strong>Interpretation:</strong> {item.interpretation}
          </p>
          <p className="sub">
            <strong>Suggested intervention:</strong> {item.suggestedIntervention}
          </p>
          {item.limitation ? <p className="note">{item.limitation}</p> : null}
          <IssueList
            issues={issues}
            empty="This recommendation is not tied to a specific issue list."
            onOpen={openIssue}
          />
        </DrilldownPanel>
      );
    }

    if (groupedLookup.has(id)) {
      const config = groupedLookup.get(id);
      return (
        <DrilldownPanel
          title={config.title}
          onClose={() => setDrilldown(null)}
          canOpenJira={Boolean(pathForDrilldown(id))}
          onOpenJira={() => openInJira(id)}
        >
          {config.note ? <p className="note">{config.note}</p> : null}
          <IssueList
            issues={config.issues}
            empty={config.empty}
            onOpen={openIssue}
          />
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
      <DrilldownPanel
        title={config.title}
        onClose={() => setDrilldown(null)}
        canOpenJira={Boolean(pathForDrilldown(id))}
        onOpenJira={() => openInJira(id)}
      >
        <IssueList issues={config.issues} empty={config.empty} onOpen={openIssue} />
      </DrilldownPanel>
    );
  };

  const renderBriefBuilder = (compact = false) => (
    <article className={`card brief-card ${compact ? "compact" : ""}`}>
      <div className="card-head">
        <h3>Brief Builder</h3>
      </div>
      <p className="sub">
        {compact
          ? "Create a concise team update based on the latest sprint data, key risks, and top recommendations."
          : "Briefs are deterministic. Rovo is user-triggered only and never runs on load or refresh."}
      </p>
      <div className="btn-row">
        <button
          className={`btn ${briefKind === "team" ? "primary" : ""}`}
          type="button"
          onClick={() => setBriefKind("team")}
        >
          Team update
        </button>
        <button
          className={`btn ${briefKind === "leadership" ? "primary" : ""}`}
          type="button"
          onClick={() => setBriefKind("leadership")}
        >
          Leadership brief
        </button>
        <button
          className={`btn ${briefKind === "retro" ? "primary" : ""}`}
          type="button"
          onClick={() => setBriefKind("retro")}
        >
          Retrospective
        </button>
      </div>
      {!compact && selectedBrief ? (
        <pre className="brief-preview">{selectedBrief.plain}</pre>
      ) : null}
      {!compact && !selectedBrief ? (
        <p className="sub">Briefs appear once an active sprint snapshot is available.</p>
      ) : null}
      <div className="btn-row">
        <button
          className="btn"
          type="button"
          disabled={!selectedBrief}
          onClick={() => copyBrief(false)}
        >
          Copy brief
        </button>
        {!compact ? (
          <button
            className="btn"
            type="button"
            disabled={!selectedBrief}
            onClick={() => copyBrief(true)}
          >
            Copy markdown
          </button>
        ) : null}
        <button
          className="btn primary"
          type="button"
          disabled={!selectedBrief || !snapshot?.sprint}
          onClick={openBriefInRovo}
        >
          Open in Rovo
        </button>
      </div>
      {copyMessage ? <p className="note">{copyMessage}</p> : null}
      {!compact ? (
        <>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              className="btn"
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
        </>
      ) : null}
    </article>
  );

  const healthPercent = Math.max(
    0,
    Math.min(100, Number(snapshot.healthScore) || 0),
  );

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
        <div className="header-aside">
          {snapshot?.generatedAt ? (
            <div className="meta">
              Last updated {new Date(snapshot.generatedAt).toLocaleString()}
            </div>
          ) : null}
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
          <section className="health-banner" aria-label="Sprint health summary">
            <article className="card health-score-card">
              <div className="score-row">
                <div className="score">
                  {formatMetric(snapshot.healthScore)} / {snapshot.healthMax || 100}
                </div>
                <span className={`pill ${statusClass(snapshot.healthStatus)}`}>
                  {snapshot.healthStatus || "—"}
                </span>
              </div>
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
                <p className="note" key={item}>
                  {item}
                </p>
              ))}
            </article>
            <section className="kpi-grid" aria-label="Sprint KPIs">
              <button
                className={`kpi ${drilldown === "completion" ? "active" : ""}`}
                type="button"
                onClick={() => showDrilldown("completion")}
              >
                <div className="n">{formatMetric(snapshot.completionPercent, "%")}</div>
                <div className="l">Completion</div>
              </button>
              <button
                className={`kpi ${drilldown === "added" ? "active" : ""}`}
                type="button"
                onClick={() => showDrilldown("added")}
              >
                <div className="n">{formatSigned(snapshot.scopeChangePercent, "%")}</div>
                <div className="l">Scope growth</div>
              </button>
              <button
                className={`kpi ${drilldown === "carryover" ? "active" : ""}`}
                type="button"
                onClick={() => showDrilldown("carryover")}
              >
                <div className="n">{formatMetric(snapshot.carryoverCount)}</div>
                <div className="l">Carryover</div>
              </button>
              <button
                className={`kpi ${drilldown === "blocked" ? "active" : ""}`}
                type="button"
                onClick={() => showDrilldown("blocked")}
              >
                <div className="n">{formatMetric(snapshot.blockedCount)}</div>
                <div className="l">Blocked</div>
              </button>
              <button
                className={`kpi ${drilldown === "stale" ? "active" : ""}`}
                type="button"
                onClick={() => showDrilldown("stale")}
              >
                <div className="n">{formatMetric(snapshot.staleCount)}</div>
                <div className="l">Stale</div>
              </button>
            </section>
          </section>

          <nav className="tabs" aria-label="Delivery Intelligence sections">
            {DASHBOARD_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? "active" : ""}`}
                type="button"
                onClick={() => switchTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "overview" ? (
            <section className="overview-grid">
              <article className="card">
                <div className="card-head">
                  <h3>Coach&apos;s Attention</h3>
                </div>
                <p className="sub card-intro">Top items that need your attention</p>
                {overviewCoachItems.length === 0 ? (
                  <p className="sub">No ranked attention items were detected from the current sprint data.</p>
                ) : (
                  <div className="grouped-list">
                    {overviewCoachItems.map((item) => (
                      <AttentionRow
                        key={item.id}
                        item={item}
                        active={drilldown === item.drillId}
                        onOpen={showDrilldown}
                      />
                    ))}
                  </div>
                )}
                <button
                  className="text-link"
                  type="button"
                  onClick={() => showDrilldown("findings")}
                >
                  View all {findingsTotal} finding{findingsTotal === 1 ? "" : "s"}
                </button>
              </article>

              <article className="card">
                <div className="card-head">
                  <h3>Sprint Readiness</h3>
                  <span className={`pill ${readinessTone(snapshot.readiness?.assessment)}`}>
                    {snapshot.readiness?.assessment || "Partial data"}
                  </span>
                </div>
                <p className="sub">
                  {snapshot.readiness?.sprintGoalPolicy?.affectsReadiness === false
                    ? "Sprint goal does not affect readiness"
                    : "Readiness uses issue fields and deterministic heuristics."}
                </p>
                <div className="progress-row">
                  <div className="progress-track" aria-hidden="true">
                    <div className="progress-fill" style={{ width: `${healthPercent}%` }} />
                  </div>
                  <span className="progress-label">
                    {formatMetric(snapshot.healthScore)} / {snapshot.healthMax || 100}
                  </span>
                </div>
                <div className="count-grid">
                  {readinessCounts.map((row) => (
                    <button
                      key={row.key}
                      className={`count-chip ${drilldown === row.drillId ? "active" : ""}`}
                      type="button"
                      onClick={() => showDrilldown(row.drillId)}
                    >
                      <strong>{row.count}</strong>
                      <span>{row.label}</span>
                    </button>
                  ))}
                </div>
                <p className="note">Improve issue quality to improve delivery predictability.</p>
                <button className="btn" type="button" onClick={() => switchTab("readiness")}>
                  Review readiness
                </button>
              </article>

              <article className="card compact-scope">
                <div className="card-head">
                  <h3>Scope Movement</h3>
                </div>
                <p className="sub card-intro">Change in scope since sprint start</p>
                <div className="scope-equation">
                  <button
                    className={`scope-stat ${drilldown === "original" ? "active" : ""}`}
                    type="button"
                    onClick={() => showDrilldown("original")}
                  >
                    <div className="n">{formatMetric(snapshot.originalCommittedCount)}</div>
                    <div className="l">Original commitment</div>
                  </button>
                  <span className="scope-op" aria-hidden="true">+</span>
                  <button
                    className={`scope-stat ${drilldown === "added" ? "active" : ""}`}
                    type="button"
                    onClick={() => showDrilldown("added")}
                  >
                    <div className="n">{formatMetric(snapshot.addedIssueCount)}</div>
                    <div className="l">Added after start</div>
                  </button>
                  <span className="scope-op" aria-hidden="true">=</span>
                  <button
                    className={`scope-stat ${drilldown === "completion" ? "active" : ""}`}
                    type="button"
                    onClick={() => showDrilldown("completion")}
                  >
                    <div className="n">{formatMetric(snapshot.currentIssueCount)}</div>
                    <div className="l">Current scope</div>
                  </button>
                  <button
                    className={`scope-stat growth ${drilldown === "added" ? "active" : ""}`}
                    type="button"
                    onClick={() => showDrilldown("added")}
                  >
                    <div className="n">{formatSigned(snapshot.scopeChangePercent, "%")}</div>
                    <div className="l">Scope growth</div>
                  </button>
                </div>
              </article>

              <article className="card">
                <div className="card-head">
                  <h3>Delivery Pace</h3>
                  <span className={`pill ${sprintEnded ? "bad" : ""}`}>
                    {paceHeadline(snapshot.sprintPace, snapshot.sprint)}
                  </span>
                </div>
                <div className="pace-summary">
                  <div>
                    <div className="n">{formatMetric(snapshot.sprintPace?.completedPercent, "%")}</div>
                    <div className="l">Completed</div>
                  </div>
                  <div>
                    <div className="n">
                      {formatMetric(snapshot.deliveryPace?.workStateCounts?.notStarted)}
                    </div>
                    <div className="l">Not started</div>
                  </div>
                  <div>
                    <div className="n">
                      {formatMetric(snapshot.deliveryPace?.workStateCounts?.inProgress)}
                    </div>
                    <div className="l">In progress</div>
                  </div>
                </div>
                <p className="sub">{paceSummaryCopy(snapshot.sprintPace, snapshot.sprint)}</p>
                <button className="btn" type="button" onClick={() => showDrilldown("completion")}>
                  View sprint issues
                </button>
              </article>

              <article className="card">
                <div className="card-head">
                  <h3>Learning Across Sprints</h3>
                </div>
                <p className="sub">{learningInsight.summary}</p>
                <button className="btn" type="button" onClick={() => switchTab("learning")}>
                  View learning
                </button>
              </article>

              {renderBriefBuilder(true)}
            </section>
          ) : null}

          {activeTab === "readiness" ? (
            <section>
              <article className="card">
                <div className="card-head">
                  <h3>Sprint Readiness</h3>
                  <span className={`pill ${readinessTone(snapshot.readiness?.assessment)}`}>
                    {snapshot.readiness?.assessment || "Partial data"}
                  </span>
                </div>
                <p className="sub">
                  {snapshot.readiness?.sprintGoalPolicy?.affectsReadiness === false
                    ? "Sprint goal does not affect readiness"
                    : "Readiness uses issue fields and deterministic heuristics."}
                </p>
                <div className="count-grid">
                  {readinessCounts.map((row) => (
                    <button
                      key={row.key}
                      className={`count-chip ${drilldown === row.drillId ? "active" : ""}`}
                      type="button"
                      onClick={() => showDrilldown(row.drillId)}
                    >
                      <strong>{row.count}</strong>
                      <span>{row.label}</span>
                    </button>
                  ))}
                </div>
              </article>
              {readinessGroups.length === 0 ? (
                <article className="card">
                  <p className="sub">No readiness findings were grouped for this sprint.</p>
                </article>
              ) : (
                <div className="grouped-list stacked">
                  {readinessGroups.map((group) => (
                    <AttentionRow
                      key={group.id}
                      item={{
                        ...group,
                        summary: `${group.count} issue${group.count === 1 ? "" : "s"} · ${
                          group.explanation || "Open the drill-down to review affected issues."
                        }`,
                        drillId: group.id,
                      }}
                      active={drilldown === group.id}
                      onOpen={showDrilldown}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "pace" ? (
            <section>
              <article className="card">
                <div className="card-head">
                  <h3>Delivery Pace</h3>
                  <span className={`pill ${sprintEnded ? "bad" : ""}`}>
                    {paceHeadline(snapshot.sprintPace, snapshot.sprint)}
                  </span>
                </div>
                <div className="pace-grid">
                  <div>
                    <div className="kicker">Elapsed</div>
                    <div className="n">{formatMetric(snapshot.sprintPace?.elapsedPercent, "%")}</div>
                  </div>
                  <div>
                    <div className="kicker">Completed</div>
                    <div className="n">{formatMetric(snapshot.sprintPace?.completedPercent, "%")}</div>
                  </div>
                  <div>
                    <div className="kicker">Not started</div>
                    <div className="n">
                      {formatMetric(snapshot.deliveryPace?.workStateCounts?.notStarted)}
                    </div>
                  </div>
                  <div>
                    <div className="kicker">In progress</div>
                    <div className="n">
                      {formatMetric(snapshot.deliveryPace?.workStateCounts?.inProgress)}
                    </div>
                  </div>
                </div>
                <p className="sub">{paceSummaryCopy(snapshot.sprintPace, snapshot.sprint)}</p>
                <p className="note">
                  {sprintEnded
                    ? "Pacing is shown as a closed-sprint result, not an active forecast."
                    : snapshot.sprintPace?.note ||
                      "Transparent pacing assessment — not an advanced forecast."}
                </p>
                <button className="btn" type="button" onClick={() => showDrilldown("completion")}>
                  View sprint issues
                </button>
              </article>
              {paceGroups.length === 0 ? (
                <article className="card">
                  <p className="sub">No delivery-pace signals were grouped for this sprint.</p>
                </article>
              ) : (
                <div className="grouped-list stacked">
                  {paceGroups.map((group) => (
                    <AttentionRow
                      key={group.id}
                      item={{
                        ...group,
                        summary:
                          group.issueKeys.length > 0
                            ? `${group.issueKeys.length} issue${
                                group.issueKeys.length === 1 ? "" : "s"
                              } · ${group.explanation}`
                            : group.explanation,
                        drillId: group.id,
                      }}
                      active={drilldown === group.id}
                      onOpen={showDrilldown}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "scope" ? (
            <section>
              <article className="card scope-card">
                <div className="card-head">
                  <h3>Scope Movement</h3>
                </div>
                <p className="sub scope-intro">
                  Original commitment versus work added after the sprint started.
                  Growth is added after start divided by original commitment, not
                  current total.
                </p>
                <div className="scope-equation">
                  <button
                    className={`scope-stat ${drilldown === "original" ? "active" : ""}`}
                    type="button"
                    onClick={() => showDrilldown("original")}
                  >
                    <div className="n">{formatMetric(snapshot.originalCommittedCount)}</div>
                    <div className="l">Original commitment</div>
                  </button>
                  <span className="scope-op" aria-hidden="true">+</span>
                  <button
                    className={`scope-stat ${drilldown === "added" ? "active" : ""}`}
                    type="button"
                    onClick={() => showDrilldown("added")}
                  >
                    <div className="n">{formatMetric(snapshot.addedIssueCount)}</div>
                    <div className="l">Added after start</div>
                  </button>
                  <span className="scope-op" aria-hidden="true">=</span>
                  <button
                    className={`scope-stat ${drilldown === "completion" ? "active" : ""}`}
                    type="button"
                    onClick={() => showDrilldown("completion")}
                  >
                    <div className="n">{formatMetric(snapshot.currentIssueCount)}</div>
                    <div className="l">Current scope</div>
                  </button>
                  <button
                    className={`scope-stat growth ${drilldown === "added" ? "active" : ""}`}
                    type="button"
                    onClick={() => showDrilldown("added")}
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
                  <button className="btn" type="button" onClick={() => showDrilldown("original")}>
                    View original commitment
                  </button>
                  <button className="btn primary" type="button" onClick={() => showDrilldown("added")}>
                    View added issues
                  </button>
                </div>
              </article>

              <h3 className="section-title">Compound risks</h3>
              {(snapshot.compoundRisks?.items || []).length === 0 ? (
                <article className="card">
                  <p className="sub">No compound per-issue risks were consolidated.</p>
                </article>
              ) : (
                <div className="grouped-list stacked">
                  {(snapshot.compoundRisks?.items || []).map((item) => (
                    <AttentionRow
                      key={item.issueKey}
                      item={{
                        severity: item.attentionLevel,
                        title: item.issueKey,
                        summary: item.summary,
                        suggestedAction: `Open ${item.issueKey}`,
                        drillId: item.issueKey,
                      }}
                      active={false}
                      onOpen={() => openIssue(item.issueKey)}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "learning" ? (
            <section>
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
                                      ? " points"
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

              <h3 className="section-title">Historical patterns</h3>
              {(snapshot.historicalPatterns?.patterns || []).length === 0 ? (
                <article className="card">
                  <p className="sub">
                    {snapshot.historicalPatterns?.capability?.reason ||
                      "No multi-sprint patterns were detected yet."}
                  </p>
                </article>
              ) : (
                <div className="grouped-list stacked">
                  {snapshot.historicalPatterns.patterns.map((pattern) => (
                    <article className="attention-row" key={pattern.id}>
                      <div className="attention-copy">
                        <div className="attention-head">
                          <span className="pill">{attentionLevelLabel(pattern.attentionLevel)}</span>
                          <strong>{pattern.title}</strong>
                        </div>
                        <p className="note">Evidence: {pattern.evidence}</p>
                        <p className="sub">{pattern.interpretation}</p>
                        <p className="note">Focus: {pattern.suggestedFocus}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {(snapshot.retrospectiveQuestions || []).length > 0 ? (
                <article className="card">
                  <div className="kicker">Retrospective questions</div>
                  <ul className="question-list">
                    {snapshot.retrospectiveQuestions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </article>
              ) : null}
            </section>
          ) : null}

          {activeTab === "briefs" ? renderBriefBuilder(false) : null}

          {renderDrilldown(drilldown)}
          {navMessage ? <p className="note">{navMessage}</p> : null}
        </>
      )}
    </div>
  );
}
