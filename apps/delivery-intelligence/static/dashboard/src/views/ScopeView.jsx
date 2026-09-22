import { useMemo, useState } from "react";
import {
  addedIssueRows,
  attentionLevelLabel,
  buildScopeTimeline,
  filterIssueRows,
} from "../dashboard-ia.js";
import {
  EvidenceDrawer,
  IssueTable,
  ScopeLine,
  SectionHeader,
  SeverityPill,
} from "../components/DashboardKit.jsx";

const columns = [
  { id: "key", label: "Issue" },
  { id: "summary", label: "Summary" },
  {
    id: "joinedAt",
    label: "Added date",
    render: (row) =>
      row.joinedAt ? new Date(row.joinedAt).toLocaleDateString() : "—",
  },
  {
    id: "estimate",
    label: "Estimate",
    render: (row) => (row.estimate == null ? "—" : row.estimate),
  },
  { id: "statusName", label: "Status", render: (row) => row.statusName || "—" },
  {
    id: "severity",
    label: "Risk",
    render: (row) => <SeverityPill severity={row.severity} />,
  },
];

export default function ScopeView({
  snapshot,
  issueIndex,
  onOpenIssue,
  onAskRovo,
  onOpenKeys,
}) {
  const timeline = buildScopeTimeline(snapshot);
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () => filterIssueRows(addedIssueRows(snapshot, issueIndex), { query }),
    [snapshot, issueIndex, query],
  );
  const compounds = snapshot?.compoundRisks?.items || [];
  const [selectedKey, setSelectedKey] = useState(rows[0]?.key || compounds[0]?.issueKey || null);
  const selectedRow = rows.find((row) => row.key === selectedKey);
  const selectedCompound = compounds.find((row) => row.issueKey === selectedKey);
  const selectedIssue = issueIndex.get(selectedKey);

  return (
    <section className="detail-page">
      <SectionHeader
        title="Scope & risk"
        subtitle="Understand what changed from commitment and which issues threaten delivery."
      />
      <div className="split-hero">
        <div className="panel">
          <div className="panel-title">Scope at a glance</div>
          <div className="scope-equation">
            <div className="scope-stat">
              <div className="n">{snapshot.originalCommittedCount ?? "—"}</div>
              <div className="l">Original commitment</div>
            </div>
            <span className="scope-op">+</span>
            <div className="scope-stat">
              <div className="n">{snapshot.addedIssueCount ?? "—"}</div>
              <div className="l">Added after start</div>
            </div>
            <span className="scope-op">=</span>
            <div className="scope-stat">
              <div className="n">{snapshot.currentIssueCount ?? "—"}</div>
              <div className="l">Current scope</div>
            </div>
            <div className="scope-stat growth">
              <div className="n">
                {snapshot.scopeChangePercent == null ? "—" : `+${snapshot.scopeChangePercent}%`}
              </div>
              <div className="l">Scope growth</div>
            </div>
          </div>
          <p className="note">{timeline.removalsNote}</p>
        </div>
        <div className="panel">
          <div className="panel-title">Risk summary</div>
          <div className="count-grid four">
            <div className="count-chip">
              <strong>{snapshot.blockedCount ?? 0}</strong>
              <span>Blocked</span>
            </div>
            <div className="count-chip">
              <strong>{snapshot.staleCount ?? 0}</strong>
              <span>Stale</span>
            </div>
            <div className="count-chip">
              <strong>{snapshot.carryoverCount ?? 0}</strong>
              <span>Carryover</span>
            </div>
            <div className="count-chip">
              <strong>{snapshot.readiness?.counts?.dependencyContext ?? 0}</strong>
              <span>Dependencies</span>
            </div>
          </div>
        </div>
      </div>

      <div className="split-hero">
        <div className="panel">
          <div className="panel-title">Scope movement over time</div>
          <ScopeLine points={timeline.points} />
        </div>
        <div className="panel">
          <div className="panel-title">Compound risks</div>
          {compounds.length === 0 ? (
            <p className="sub">No compound per-issue risks were consolidated.</p>
          ) : (
            <ol className="risk-list">
              {compounds.slice(0, 5).map((item) => (
                <li key={item.issueKey}>
                  <button
                    className={`risk-item ${selectedKey === item.issueKey ? "active" : ""}`}
                    type="button"
                    onClick={() => setSelectedKey(item.issueKey)}
                  >
                    <div>
                      <strong>{item.issueKey}</strong>
                      <SeverityPill severity={item.attentionLevel} />
                      <p className="sub">{item.summary}</p>
                    </div>
                    <span className="text-link inline">View issue</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="card-head">
          <h3>Added after start · {rows.length} issues</h3>
          <input
            className="search"
            type="search"
            placeholder="Search issues…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <IssueTable
          columns={columns}
          rows={rows}
          selectedKey={selectedKey}
          onSelect={(row) => setSelectedKey(row.key)}
          empty="No issues were added after sprint start."
        />
      </div>

      <EvidenceDrawer
        variant="bar"
        title={
          selectedIssue
            ? `${selectedIssue.key} ${selectedIssue.summary || ""}`.trim()
            : selectedRow?.key || selectedCompound?.issueKey
        }
        meta={
          selectedCompound
            ? attentionLevelLabel(selectedCompound.attentionLevel)
            : selectedRow
              ? attentionLevelLabel(selectedRow.severity)
              : null
        }
        canOpenJira={Boolean(selectedKey)}
        canAskRovo={Boolean(selectedKey)}
        onOpenJira={() => (selectedKey ? onOpenIssue(selectedKey) : onOpenKeys([]))}
        onAskRovo={() =>
          onAskRovo(
            `Use Delivery Intelligence facts only. Review scope and risk for ${selectedKey}. Do not invent removals or metrics.`,
          )
        }
      >
        {selectedCompound ? (
          <>
            <div className="kicker">Evidence</div>
            <ul className="plain-list">
              {(selectedCompound.evidence || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="kicker">Related risk</div>
            <p className="sub">{(selectedCompound.riskCodes || []).join(", ") || "Consolidated signals"}</p>
            <div className="kicker">Suggested intervention</div>
            <p className="sub">{selectedCompound.summary}</p>
          </>
        ) : selectedRow ? (
          <p className="sub">
            Added after sprint start
            {selectedRow.joinedAt ? ` on ${new Date(selectedRow.joinedAt).toLocaleDateString()}` : ""}.
          </p>
        ) : (
          <p className="sub">Select an added or compound-risk issue to see evidence.</p>
        )}
      </EvidenceDrawer>
    </section>
  );
}
