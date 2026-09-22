import { useMemo, useState } from "react";
import {
  READINESS_NAV_LABELS,
  filterIssueRows,
  groupReadinessFindings,
  readinessDimensions,
  readinessHeadline,
  readinessIssueRows,
} from "../dashboard-ia.js";
import {
  DimensionMeters,
  EvidenceDrawer,
  IssueTable,
  RingMeter,
  SectionHeader,
  SeverityPill,
} from "../components/DashboardKit.jsx";

export default function ReadinessView({
  snapshot,
  issueIndex,
  onOpenIssue,
  onAskRovo,
}) {
  const groups = useMemo(
    () => groupReadinessFindings(snapshot?.readinessFindings || []),
    [snapshot],
  );
  const [category, setCategory] = useState(groups[0]?.groupId || null);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [selectedKey, setSelectedKey] = useState(null);

  const activeGroup = groups.find((row) => row.groupId === category) || groups[0];
  const rows = useMemo(() => {
    const source = activeGroup?.findings || [];
    return filterIssueRows(readinessIssueRows(source, issueIndex), { query, severity });
  }, [activeGroup, issueIndex, query, severity]);
  const selected = rows.find((row) => row.key === selectedKey) || rows[0] || null;
  const columns = [
    { id: "key", label: "Issue" },
    { id: "summary", label: "Summary" },
    { id: "evidence", label: "Evidence" },
    {
      id: "conversation",
      label: "Suggested conversation",
      render: (row) => <span className="clip">{row.conversation}</span>,
    },
    {
      id: "action",
      label: "Action",
      render: (row) => (
        <button
          className="text-link inline"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedKey(row.key);
          }}
        >
          View
        </button>
      ),
    },
  ];

  return (
    <section className="detail-page">
      <SectionHeader
        title="Sprint readiness"
        subtitle="How well the work was prepared for delivery."
      />
      <div className="panel readiness-hero">
        <div className="readiness-score">
          <RingMeter
            value={snapshot.healthScore}
            max={snapshot.healthMax || 100}
            tone={snapshot.readiness?.assessment === "Needs attention" ? "warn" : ""}
            label={snapshot.readiness?.assessment || "Partial data"}
          />
          <p className="lead">{readinessHeadline(snapshot)}</p>
        </div>
        <div>
          <div className="panel-title">Readiness quality by dimension</div>
          <DimensionMeters items={readinessDimensions(snapshot)} />
        </div>
      </div>

      <div className="workspace">
        <aside className="panel slim">
          <div className="panel-title">Areas to improve</div>
          <p className="sub">Select a category to find and fix issues.</p>
          <div className="category-list">
            {groups.map((group) => (
              <button
                key={group.id}
                className={`category-item ${activeGroup?.groupId === group.groupId ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setCategory(group.groupId);
                  setSelectedKey(null);
                }}
              >
                <span>{READINESS_NAV_LABELS[group.groupId] || group.title}</span>
                <strong>{group.count}</strong>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel grow">
          <div className="panel-title">
            {activeGroup?.title || "Findings"} · {activeGroup?.count || 0} issues
          </div>
          <p className="sub">Issues in this sprint that match the selected readiness category.</p>
          <div className="table-tools">
            <input
              className="search"
              type="search"
              placeholder="Search issues…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="search compact"
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
              aria-label="Filter by severity"
            >
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="review">Review</option>
              <option value="informational">Info</option>
            </select>
          </div>
          <IssueTable
            columns={columns}
            rows={rows}
            selectedKey={selected?.key}
            onSelect={(row) => setSelectedKey(row.key)}
            empty="No issues match this readiness category."
            pageSize={10}
          />
        </section>

        <EvidenceDrawer
          title={selected ? `${selected.key}` : null}
          meta={selected ? selected.summary : null}
          canOpenJira={Boolean(selected?.key)}
          canAskRovo={Boolean(selected?.key)}
          onOpenJira={() => onOpenIssue(selected?.key)}
          onAskRovo={() =>
            onAskRovo(
              `Use Delivery Intelligence facts only. Help the team discuss ${selected?.key}: ${selected?.conversation}`,
            )
          }
        >
          {selected ? (
            <>
              <div className="meta-row">
                <SeverityPill severity={selected.severity} />
                <span className="sub">{selected.statusName || "Open"}</span>
              </div>
              <div className="kicker">Evidence</div>
              <p className="sub">{selected.evidence || selected.explanation}</p>
              <div className="kicker">Why it matters</div>
              <p className="sub">{selected.why}</p>
              <div className="kicker">Suggested conversation</div>
              <p className="sub">{selected.conversation}</p>
              <p className="note">
                <strong>Confidence:</strong> {selected.confidence}
              </p>
            </>
          ) : null}
        </EvidenceDrawer>
      </div>
      <p className="footnote">
        The sprint goal does not affect readiness. Readiness insights are based on issue
        data, acceptance criteria, estimates, and ownership using heuristics — not absolute judgments.
      </p>
    </section>
  );
}
