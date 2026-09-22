import { useMemo, useState } from "react";
import {
  coachInterpretations,
  groupPaceSignals,
  isSprintEndPassed,
  paceFlow,
  paceHeadline,
  paceSummaryCopy,
  paceWaitingStatuses,
} from "../dashboard-ia.js";
import {
  EvidenceDrawer,
  FlowTrack,
  IssueTable,
  SectionHeader,
  SeverityPill,
  StatusPill,
} from "../components/DashboardKit.jsx";

export default function PaceView({ snapshot, issueIndex, onOpenIssue, onAskRovo, onOpenKeys }) {
  const flow = paceFlow(snapshot);
  const groups = useMemo(
    () => groupPaceSignals(snapshot?.deliveryPace?.signals || []),
    [snapshot],
  );
  const waiting = paceWaitingStatuses(snapshot?.deliveryPace?.signals || []);
  const coaching = coachInterpretations(snapshot);
  const closed = isSprintEndPassed(snapshot?.sprint);
  const [selectedId, setSelectedId] = useState(groups[0]?.id || null);
  const selected = groups.find((row) => row.id === selectedId) || groups[0] || null;
  const selectedIssue = selected?.issueKeys?.[0]
    ? issueIndex.get(selected.issueKeys[0])
    : null;
  const maxWait = Math.max(1, flow.notStarted, flow.inProgress, flow.done, ...waiting.map((row) => row.count));
  const columns = [
    { id: "title", label: "Signal" },
    {
      id: "severity",
      label: "Severity",
      render: (row) => <SeverityPill severity={row.severity} />,
    },
    { id: "explanation", label: "Evidence" },
    {
      id: "count",
      label: "Affected",
      render: (row) => row.issueKeys?.length || row.count || "—",
    },
    {
      id: "action",
      label: "Action",
      render: () => <span className="text-link inline">View issues</span>,
    },
  ];

  return (
    <section className="detail-page">
      <SectionHeader
        title="Delivery pace"
        subtitle="How work is moving from commitment to completion."
        action={
          <StatusPill tone={closed ? "bad" : ""}>
            {closed ? "Sprint end date passed" : paceHeadline(snapshot.sprintPace, snapshot.sprint)}
          </StatusPill>
        }
      />
      <div className="panel pace-hero">
        <div className="pace-main">
          <div className="pace-elapsed">
            <span>{flow.elapsedPercent ?? "—"}% sprint time elapsed</span>
            <span>{flow.remainingPercent ?? "—"}% remaining</span>
            <span>{flow.basis}</span>
          </div>
          <div className="progress-track tall">
            <div className="progress-fill calm" style={{ width: `${flow.elapsedPercent || 0}%` }} />
          </div>
          <FlowTrack
            notStarted={flow.notStarted}
            inProgress={flow.inProgress}
            done={flow.done}
          />
        </div>
        <div className={`callout ${closed ? "danger" : ""}`}>
          <strong>{closed ? "Sprint end date passed" : paceHeadline(snapshot.sprintPace, snapshot.sprint)}</strong>
          <p className="sub">{paceSummaryCopy(snapshot.sprintPace, snapshot.sprint)}</p>
        </div>
      </div>

      <div className="workspace pace-workspace">
        <section className="panel grow">
          <div className="panel-title">Execution signals</div>
          <p className="sub">Key indicators of how work moved through the sprint.</p>
          <IssueTable
            columns={columns}
            rows={groups.map((group) => ({ ...group, key: group.id }))}
            selectedKey={selected?.id}
            onSelect={(row) => setSelectedId(row.id)}
            empty="No delivery-pace signals were grouped for this sprint."
          />
        </section>
        <aside className="stack">
          <div className="panel">
            <div className="panel-title">Flow breakdown</div>
            {[
              ["To Do / not started", flow.notStarted],
              ["In progress", flow.inProgress],
              ["Done", flow.done],
            ].map(([label, count]) => (
              <div className="meter-row" key={label}>
                <span>{label}</span>
                <div className="progress-track">
                  <div className="progress-fill calm" style={{ width: `${(count / maxWait) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-title">Where work is waiting</div>
            {waiting.length === 0 ? (
              <p className="sub">No workflow accumulation signal was detected.</p>
            ) : (
              waiting.map((row) => (
                <div className="meter-row" key={row.statusName}>
                  <span>{row.statusName}</span>
                  <div className="progress-track">
                    <div className="progress-fill calm" style={{ width: `${(row.count / maxWait) * 100}%` }} />
                  </div>
                  <strong>{row.count}</strong>
                </div>
              ))
            )}
          </div>
          <div className="panel">
            <div className="panel-title">Coach&apos;s interpretation</div>
            <ol className="numbered">
              {coaching.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}.</strong> {item.summary}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      <EvidenceDrawer
        variant="bar"
        title={
          selectedIssue
            ? `${selectedIssue.key} ${selectedIssue.summary || ""}`.trim()
            : selected?.title
        }
        meta={selected ? `${selected.issueKeys?.length || 0} affected issues` : null}
        canOpenJira={Boolean(selectedIssue?.key || selected?.issueKeys?.length)}
        canAskRovo={Boolean(selected)}
        onOpenJira={() =>
          selectedIssue?.key
            ? onOpenIssue(selectedIssue.key)
            : onOpenKeys(selected?.issueKeys || [])
        }
        onAskRovo={() =>
          onAskRovo(
            `Use Delivery Intelligence facts only. Discuss this delivery-pace signal: ${selected?.title}. ${selected?.explanation || ""}`,
          )
        }
      >
        {selected ? <p className="sub">{selected.explanation}</p> : null}
      </EvidenceDrawer>
    </section>
  );
}
