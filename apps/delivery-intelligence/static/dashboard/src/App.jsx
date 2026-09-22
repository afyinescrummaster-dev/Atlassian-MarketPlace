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
  paceHeadline,
  topCoachAttention,
} from "./dashboard-ia.js";
import { ProductNav } from "./components/DashboardKit.jsx";
import OverviewView from "./views/OverviewView.jsx";
import ReadinessView from "./views/ReadinessView.jsx";
import PaceView from "./views/PaceView.jsx";
import ScopeView from "./views/ScopeView.jsx";
import LearningView from "./views/LearningView.jsx";
import BriefsView from "./views/BriefsView.jsx";
import "./App.css";
import "./fluent.css";

const AGENT_KEY = "delivery-intelligence-agent";
const AGENT_NAME = "Delivery Intelligence";
const UI_BUILD = "2.13.0";

const BRIEF_KEYS = {
  team: "teamUpdate",
  leadership: "leadershipBrief",
  retro: "retrospectiveSummary",
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
  <article className="surface elevated drilldown drawer-enter">
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

  return (
    <div className="page canvas" data-ui-build={UI_BUILD}>
      <header className="product-header acrylic">
        <div className="product-header-top">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">DI</div>
            <div>
              <h1>
                Delivery Intelligence <span className="lozenge">Dev</span>
              </h1>
              <p className="brand-sub">
                Turn sprint data into clarity, action and better outcomes.
              </p>
            </div>
          </div>
          <div className="command-bar" role="toolbar" aria-label="Sprint commands">
            {snapshot?.sprint ? (
              <>
                <span className="command-item">Sprint: {snapshot.sprint.name}</span>
                {sprintEnded ? (
                  <span className="pill bad">Sprint end date passed</span>
                ) : (
                  <span className="pill">{paceHeadline(snapshot.sprintPace, snapshot.sprint)}</span>
                )}
              </>
            ) : (
              <span className="command-item">{contextLine || "No active sprint"}</span>
            )}
            {snapshot?.generatedAt ? (
              <span className="command-item">
                Last updated {new Date(snapshot.generatedAt).toLocaleString()}
              </span>
            ) : null}
            <button className="btn" type="button" disabled={refreshing} onClick={refresh}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            {snapshot?.sprint ? (
              <button className="btn primary" type="button" onClick={() => switchTab("briefs")}>
                Create brief
              </button>
            ) : null}
            <details className="overflow">
              <summary className="btn icon-btn" aria-label="More actions">⋯</summary>
              <div className="overflow-menu" role="menu">
                <button type="button" role="menuitem" disabled={!snapshot?.sprint} onClick={() => openRovo(ROVO_INTENTS.explain)}>
                  Explain sprint
                </button>
                <button type="button" role="menuitem" disabled={!snapshot?.sprint} onClick={() => openRovo(ROVO_INTENTS.recommend)}>
                  Recommend actions
                </button>
                <button type="button" role="menuitem" disabled={!selectedBrief} onClick={() => copyBrief(true)}>
                  Copy Markdown
                </button>
              </div>
            </details>
          </div>
        </div>
        {snapshot?.sprint ? (
          <ProductNav tabs={DASHBOARD_TABS} activeId={activeTab} onChange={switchTab} />
        ) : null}
      </header>

      {!snapshot?.sprint ? (
        <article className="card page-main">
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
          {activeTab === "overview" ? (
            <OverviewView
              snapshot={snapshot}
              drilldown={drilldown}
              showDrilldown={showDrilldown}
              switchTab={switchTab}
              overviewCoachItems={overviewCoachItems}
              findingsTotal={findingsTotal}
              briefKind={briefKind}
              setBriefKind={setBriefKind}
              selectedBrief={selectedBrief}
              copyBrief={copyBrief}
              copyMessage={copyMessage}
              openBriefInRovo={openBriefInRovo}
              onOpenRovo={() => openRovo(ROVO_INTENTS.recommend)}
            />
          ) : null}

          {activeTab === "readiness" ? (
            <ReadinessView
              snapshot={snapshot}
              issueIndex={issueIndex}
              onOpenIssue={openIssue}
              onAskRovo={(prompt) => openRovo(ROVO_INTENTS.recommend, prompt)}
            />
          ) : null}

          {activeTab === "pace" ? (
            <PaceView
              snapshot={snapshot}
              issueIndex={issueIndex}
              onOpenIssue={openIssue}
              onAskRovo={(prompt) => openRovo(ROVO_INTENTS.recommend, prompt)}
              onOpenKeys={(keys) => openInJira(keys?.length === 1 ? keys[0] : "completion")}
            />
          ) : null}

          {activeTab === "scope" ? (
            <ScopeView
              snapshot={snapshot}
              issueIndex={issueIndex}
              onOpenIssue={openIssue}
              onAskRovo={(prompt) => openRovo(ROVO_INTENTS.recommend, prompt)}
              onOpenKeys={(keys) => {
                if (keys?.length === 1) {
                  openIssue(keys[0]);
                  return;
                }
                showDrilldown("added");
              }}
            />
          ) : null}

          {activeTab === "learning" ? (
            <LearningView
              snapshot={snapshot}
              onAskRovo={(prompt) => openRovo(ROVO_INTENTS.explain, prompt)}
              onCreateBrief={() => {
                setBriefKind("retro");
                switchTab("briefs");
              }}
            />
          ) : null}

          {activeTab === "briefs" ? (
            <BriefsView
              snapshot={snapshot}
              briefs={snapshot.briefs}
              briefKind={briefKind}
              setBriefKind={setBriefKind}
              copyMessage={copyMessage}
              onCopy={copyBrief}
              onOpenRovo={openBriefInRovo}
            />
          ) : null}

          {renderDrilldown(drilldown)}
          {navMessage ? <p className="note page-note">{navMessage}</p> : null}
          {rovoEnabled === false ? (
            <p className="note page-note">
              Atlassian Rovo is not enabled on this site. Deterministic metrics
              remain available; AI explanations require Rovo on a paid Jira plan.
            </p>
          ) : null}
          {aiMessage ? <p className="note page-note">{aiMessage}</p> : null}
        </>
      )}
    </div>
  );
}
