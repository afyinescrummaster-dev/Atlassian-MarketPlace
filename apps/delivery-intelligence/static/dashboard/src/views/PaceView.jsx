import { useMemo, useState } from "react";
import {
  attentionLevelLabel,
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
];

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

  return (
    <section className="detail-page">
      <SectionHeader
        title="Delivery pace"
        subtitle="How work is moving from commitment to completion."
        action={
          <StatusPill tone={closed ? "bad" : ""}>
            {paceHeadline(snapshot.sprintPace, snapshot.sprint)}
          </StatusPill>
        }
      />
      <article className="card">
        <div className="pace-elapsed">
          <span>{flow.elapsedPercent ?? "—"}% sprint time elapsed</span>
          <span>{flow.remainingPercent ?? "—"}% remaining</span>
          <span>{flow.basis}</span>
        </div>
        <div className="progress-row">
          <div className="progress-track tall">
            <div className="progress-fill calm" style={{ width: `${flow.elapsedPercent || 0}%` }} />
          </div>
        </div>
        <FlowTrack
          notStarted={flow.notStarted}
          inProgress={flow.inProgress}
          done={flow.done}
        />
        <div className="callout">
          <strong>{closed ? "Sprint end date passed" : attentionLevelLabel(snapshot.sprintPace?.pacingState)}</strong>
          <p className="sub">{paceSummaryCopy(snapshot.sprintPace, snapshot.sprint)}</p>
        </div>
      </article>

      <div className="split-hero">
        <article className="card">
          <div className="kicker">Execution signals</div>
          <IssueTable
            columns={columns}
            rows={groups.map((group) => ({ ...group, key: group.id }))}
            selectedKey={selected?.id}
            onSelect={(row) => setSelectedId(row.id)}
            empty="No delivery-pace signals were grouped for this sprint."
          />
        </article>
        <div className="stack">
          <article className="card">
            <div className="kicker">Flow breakdown</div>
            <div className="bar-list">
              <div>
                <span>To Do / not started</span>
                <strong>{flow.notStarted}</strong>
              </div>
              <div>
                <span>In progress</span>
                <strong>{flow.inProgress}</strong>
              </div>
              <div>
                <span>Done</span>
                <strong>{flow.done}</strong>
              </div>
            </div>
          </article>
          <article className="card">
            <div className="kicker">Where work is waiting</div>
            {waiting.length === 0 ? (
              <p className="sub">No workflow accumulation signal was detected.</p>
            ) : (
              waiting.map((row) => (
                <div className="wait-row" key={row.statusName}>
                  <span>{row.statusName}</span>
                  <strong>{row.count}</strong>
                </div>
              ))
            )}
          </article>
          <article className="card">
            <div className="kicker">Coach&apos;s interpretation</div>
            <ol className="numbered">
              {coaching.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}.</strong> {item.summary}
                </li>
              ))}
            </ol>
          </article>
        </div>
      </div>

      <EvidenceDrawer
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
