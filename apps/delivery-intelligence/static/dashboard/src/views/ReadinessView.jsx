import { useMemo, useState } from "react";
import {
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
  StatusPill,
} from "../components/DashboardKit.jsx";

const columns = [
  { id: "key", label: "Issue" },
  { id: "summary", label: "Summary" },
  { id: "evidence", label: "Evidence" },
  {
    id: "conversation",
    label: "Suggested conversation",
    render: (row) => <span className="clip">{row.conversation}</span>,
  },
];

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

  return (
    <section className="detail-page">
      <SectionHeader
        title="Sprint readiness"
        subtitle="How well the work was prepared for delivery."
      />
      <div className="split-hero">
        <article className="card hero-card">
          <div className="hero-row">
            <RingMeter
              value={snapshot.healthScore}
              max={snapshot.healthMax || 100}
              tone={snapshot.readiness?.assessment === "Needs attention" ? "warn" : ""}
            />
            <div>
              <StatusPill tone={snapshot.readiness?.assessment === "Needs attention" ? "bad" : ""}>
                {snapshot.readiness?.assessment || "Partial data"}
              </StatusPill>
              <p className="sub">{readinessHeadline(snapshot)}</p>
            </div>
          </div>
        </article>
        <article className="card">
          <div className="kicker">Readiness quality by dimension</div>
          <DimensionMeters items={readinessDimensions(snapshot)} />
        </article>
      </div>

      <div className="triptych">
        <article className="card">
          <div className="kicker">Areas to improve</div>
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
                <span>{group.title}</span>
                <strong>{group.count}</strong>
              </button>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h3>
              {activeGroup?.title || "Findings"} · {activeGroup?.count || 0} issues
            </h3>
          </div>
          <div className="table-tools">
            <input
              className="search"
              type="search"
              placeholder="Search issues…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="search"
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
            footer={
              <p className="note">
                {rows.length} of {activeGroup?.count || 0} issues
              </p>
            }
          />
        </article>

        <EvidenceDrawer
          title={selected ? `${selected.key} ${selected.summary}`.trim() : null}
          meta={
            selected ? (
              <>
                <SeverityPill severity={selected.severity} />
                {selected.statusName ? ` · ${selected.statusName}` : ""}
              </>
            ) : null
          }
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
      <p className="note">
        The sprint goal does not affect readiness. Readiness insights are based on issue
        data and heuristics, not absolute judgments.
      </p>
    </section>
  );
}
