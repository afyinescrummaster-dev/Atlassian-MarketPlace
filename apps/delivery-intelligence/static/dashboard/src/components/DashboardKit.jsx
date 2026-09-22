import { attentionLevelLabel } from "../dashboard-ia.js";

export const StatusPill = ({ tone = "", children }) => (
  <span className={`pill ${tone}`}>{children}</span>
);

export const SeverityPill = ({ severity }) => {
  const label = attentionLevelLabel(severity);
  const tone = label === "High" ? "bad" : label === "Info" ? "" : "";
  return <StatusPill tone={tone}>{label}</StatusPill>;
};

export const ProductNav = ({ tabs, activeId, onChange }) => (
  <nav className="tabs" aria-label="Delivery Intelligence sections">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        className={`tab ${activeId === tab.id ? "active" : ""}`}
        type="button"
        onClick={() => onChange(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </nav>
);

export const SectionHeader = ({ kicker, title, subtitle, action, children }) => (
  <div className="section-head">
    <div>
      {kicker ? <div className="kicker">{kicker}</div> : null}
      {title ? <h2 className="section-title">{title}</h2> : null}
      {subtitle ? <p className="sub">{subtitle}</p> : null}
    </div>
    <div className="section-head-actions">
      {action}
      {children}
    </div>
  </div>
);

export const CapabilityState = ({ state }) => {
  if (!state) {
    return null;
  }
  return (
    <p className={`capability ${state.tone}`}>
      <strong>{state.label}.</strong> {state.reason}
    </p>
  );
};

export const GroupedFindingRow = ({ item, active, onOpen, actionLabel }) => (
  <div className={`attention-row ${active ? "active" : ""}`}>
    <div className="attention-copy">
      <div className="attention-head">
        <SeverityPill severity={item.severity || item.attentionLevel} />
        <strong>{item.title}</strong>
      </div>
      {item.summary ? <p className="sub attention-summary">{item.summary}</p> : null}
    </div>
    <button className="btn" type="button" onClick={() => onOpen(item)}>
      {actionLabel || item.suggestedAction || "View details"}
    </button>
  </div>
);

export const IssueTable = ({
  columns,
  rows,
  empty,
  selectedKey,
  onSelect,
  footer,
}) => {
  if (!rows?.length) {
    return <p className="sub">{empty || "No issues match this view."}</p>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.id}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={selectedKey === row.key ? "selected" : ""}
              tabIndex={0}
              onClick={() => onSelect?.(row)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.(row);
                }
              }}
            >
              {columns.map((column) => (
                <td key={column.id}>{column.render ? column.render(row) : row[column.id]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
};

export const EvidenceDrawer = ({
  title,
  meta,
  children,
  onClose,
  onOpenJira,
  onAskRovo,
  canOpenJira,
  canAskRovo,
}) => {
  if (!title) {
    return (
      <aside className="drawer empty-drawer">
        <p className="sub">Select an issue to see evidence, confidence, and suggested conversation.</p>
      </aside>
    );
  }
  return (
    <aside className="drawer" aria-label="Issue evidence">
      <div className="drawer-head">
        <div>
          <strong>{title}</strong>
          {meta ? <div className="sub">{meta}</div> : null}
        </div>
        {onClose ? (
          <button className="btn" type="button" onClick={onClose} aria-label="Close details">
            Close
          </button>
        ) : null}
      </div>
      {children}
      <div className="btn-row drawer-actions">
        <button className="btn" type="button" disabled={!canOpenJira} onClick={onOpenJira}>
          Open in Jira
        </button>
        <button className="btn primary" type="button" disabled={!canAskRovo} onClick={onAskRovo}>
          Ask Rovo
        </button>
      </div>
    </aside>
  );
};

export const MetricCompare = ({ rows, formatValue, formatDelta }) => {
  if (!rows?.length) {
    return <p className="sub">Comparison data is unavailable for this sprint.</p>;
  }
  return (
    <div className="compare-list">
      {rows.map((row) => (
        <div className="compare-row" key={row.key}>
          <div className="compare-label">{row.label}</div>
          <div className="compare-values">
            {formatValue(row)} vs {formatValue(row, "previous")}
          </div>
          <div className="compare-delta">
            <StatusPill
              tone={
                row.direction === "improved" ? "good" : row.direction === "deteriorated" ? "bad" : ""
              }
            >
              {row.direction === "improved"
                ? "Improved"
                : row.direction === "deteriorated"
                  ? "Worse"
                  : row.direction === "unchanged"
                    ? "Unchanged"
                    : "Unavailable"}
            </StatusPill>
            <span className="sub">{formatDelta(row)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export const ActionButtons = ({
  onOpenJira,
  onAskRovo,
  jiraLabel = "Open in Jira",
  rovoLabel = "Ask Rovo",
  canOpenJira,
  canAskRovo,
}) => (
  <div className="btn-row">
    <button className="btn" type="button" disabled={!canOpenJira} onClick={onOpenJira}>
      {jiraLabel}
    </button>
    <button className="btn primary" type="button" disabled={!canAskRovo} onClick={onAskRovo}>
      {rovoLabel}
    </button>
  </div>
);

export const RingMeter = ({ value, max = 100, label, tone = "" }) => {
  const safe = value == null ? 0 : Math.max(0, Math.min(max, Number(value) || 0));
  const percent = Math.round((safe / max) * 100);
  return (
    <div className={`ring-meter ${tone}`}>
      <div
        className="ring"
        style={{ background: `conic-gradient(var(--ring) ${percent * 3.6}deg, #ebecf0 0deg)` }}
        aria-hidden="true"
      >
        <div className="ring-inner">
          <strong>
            {value == null ? "—" : value}
            <span>/{max}</span>
          </strong>
        </div>
      </div>
      {label ? <div className="ring-label">{label}</div> : null}
    </div>
  );
};

export const DimensionMeters = ({ items }) => (
  <div className="dimension-grid">
    {items.map((item) => (
      <div key={item.id} className="dimension">
        <div className="dimension-top">
          <span>{item.label}</span>
          <strong>{item.score == null ? "—" : `${item.score}/100`}</strong>
        </div>
        <div className="progress-track">
          <div className="progress-fill calm" style={{ width: `${item.score || 0}%` }} />
        </div>
      </div>
    ))}
  </div>
);

export const FlowTrack = ({ notStarted, inProgress, done }) => {
  const total = Math.max(1, notStarted + inProgress + done);
  return (
    <div className="flow-track" aria-label="Work flow">
      <div className="flow-seg new" style={{ flexGrow: notStarted || 0.2 }}>
        <strong>{notStarted}</strong>
        <span>Not started</span>
      </div>
      <div className="flow-seg wip" style={{ flexGrow: inProgress || 0.2 }}>
        <strong>{inProgress}</strong>
        <span>In progress</span>
      </div>
      <div className="flow-seg done" style={{ flexGrow: done || 0.2 }}>
        <strong>{done}</strong>
        <span>Done</span>
      </div>
      <span className="visually-hidden">
        {notStarted} not started, {inProgress} in progress, {done} done of {total} issues
      </span>
    </div>
  );
};

export const EmptyState = ({ title, body }) => (
  <article className="card">
    <strong>{title}</strong>
    <p className="sub">{body}</p>
  </article>
);
