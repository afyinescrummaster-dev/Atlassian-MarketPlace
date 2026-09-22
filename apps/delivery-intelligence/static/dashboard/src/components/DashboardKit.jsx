import { useState } from "react";
import { attentionLevelLabel } from "../dashboard-ia.js";

const ICON_PATHS = {
  overview: "M3 10.5 10 4l7 6.5V17a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1v-6.5z",
  readiness: "M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm0 2.2a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6z",
  pace: "M4 10h4l2-5 3 10 2-5h3",
  scope: "M4 5h12v3H4V5zm0 5h8v3H4v-3zm0 5h12v3H4v-3z",
  learning: "M4 15c2-4 4-6 6-6s4 2 6 6M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  briefs: "M6 3.5h8l2 2V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1zm1 5h6M7 12h6",
};

export const Icon = ({ name }) => (
  <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
    <path
      d={ICON_PATHS[name] || ICON_PATHS.overview}
      fill={name === "pace" || name === "learning" ? "none" : "currentColor"}
      stroke="currentColor"
      strokeWidth={name === "pace" || name === "learning" ? "1.6" : "0"}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Surface = ({ as: Tag = "section", tone = "elevated", className = "", children, ...props }) => (
  <Tag className={`surface ${tone} ${className}`.trim()} {...props}>
    {children}
  </Tag>
);

export const StatusPill = ({ tone = "", children }) => (
  <span className={`pill ${tone}`}>{children}</span>
);

export const SeverityPill = ({ severity }) => {
  const label = attentionLevelLabel(severity);
  const tone = label === "High" ? "bad" : label === "Info" ? "" : "";
  return <StatusPill tone={tone}>{label}</StatusPill>;
};

export const ProductNav = ({ tabs, activeId, onChange }) => (
  <nav className="seg-nav" aria-label="Delivery Intelligence sections">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        className={`seg-item ${activeId === tab.id ? "active" : ""}`}
        type="button"
        onClick={() => onChange(tab.id)}
      >
        <Icon name={tab.icon || tab.id} />
        {tab.label}
      </button>
    ))}
  </nav>
);

export const FindingRow = ({ index, item, active, onOpen }) => (
  <div className={`finding-row ${active ? "active" : ""}`}>
    <span className="finding-index">{index}</span>
    <div className="finding-copy">
      <div className="finding-head">
        <strong className="clip">{item.title}</strong>
        <SeverityPill severity={item.severity} />
      </div>
      {item.summary ? <p className="sub finding-summary">{item.summary}</p> : null}
    </div>
    <button className="btn ghost" type="button" onClick={() => onOpen(item.drillId || item)}>
      {item.suggestedAction || "View"}
    </button>
  </div>
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
  pageSize = 0,
}) => {
  const rowSignature = `${rows?.length || 0}:${rows?.[0]?.key || ""}`;
  const [paging, setPaging] = useState({ signature: rowSignature, page: 1 });
  const page = paging.signature === rowSignature ? paging.page : 1;
  const setPage = (next) => setPaging({ signature: rowSignature, page: next });
  if (!rows?.length) {
    return <p className="sub">{empty || "No issues match this view."}</p>;
  }
  const totalPages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const shown = pageSize ? rows.slice((page - 1) * pageSize, page * pageSize) : rows;
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
          {shown.map((row) => (
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
      {pageSize ? (
        <div className="pager">
          <span>
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, rows.length)} of {rows.length}
          </span>
          <div className="btn-row">
            <button className="btn" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <button
              className="btn"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
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
  variant = "rail",
}) => {
  if (!title) {
    return (
      <aside className={`drawer empty-drawer ${variant}`}>
        <p className="sub">Select an issue to see evidence, confidence, and suggested conversation.</p>
      </aside>
    );
  }
  return (
    <aside className={`drawer drawer-enter ${variant}`} aria-label="Issue evidence">
      <div className="drawer-head">
        <div>
          <strong>{title}</strong>
          {meta ? <div className="sub">{meta}</div> : null}
        </div>
        {onClose ? (
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close details">
            ×
          </button>
        ) : null}
      </div>
      <div className="drawer-body">{children}</div>
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
    <table className="data-table compare-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Current</th>
          <th>Previous</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{row.label}</td>
            <td>{formatValue(row)}</td>
            <td>{formatValue(row, "previous")}</td>
            <td>
              <StatusPill
                tone={
                  row.direction === "improved"
                    ? "good"
                    : row.direction === "deteriorated"
                      ? "bad"
                      : ""
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
              <span className="sub"> {formatDelta(row)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
        <strong>{item.score == null ? "—" : `${item.score}/100`}</strong>
        <div className="progress-track">
          <div className="progress-fill calm" style={{ width: `${item.score || 0}%` }} />
        </div>
        <span>{item.label}</span>
      </div>
    ))}
  </div>
);

export const FlowTrack = ({ notStarted, inProgress, done }) => {
  const total = Math.max(1, notStarted + inProgress + done);
  return (
    <div className="flow-track" aria-label="Work flow">
      <div className="flow-bar">
        <div className="flow-seg new" style={{ width: `${(notStarted / total) * 100}%` }} />
        <div className="flow-seg wip" style={{ width: `${(inProgress / total) * 100}%` }} />
        <div className="flow-seg done" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <div className="flow-legend">
        <span>
          <strong>{notStarted}</strong> Not started
        </span>
        <span>
          <strong>{inProgress}</strong> In progress
        </span>
        <span>
          <strong>{done}</strong> Done
        </span>
      </div>
    </div>
  );
};

export const ScopeLine = ({ points }) => {
  const series = points || [];
  if (series.length === 0) {
    return <p className="sub">Scope movement is unavailable.</p>;
  }
  const width = 560;
  const height = 140;
  const max = Math.max(1, ...series.map((point) => point.cumulative || 0));
  const xs = series.map(
    (_, index) => 16 + (index / Math.max(series.length - 1, 1)) * (width - 32),
  );
  const ys = series.map((point) => height - 28 - ((point.cumulative || 0) / max) * (height - 48));
  const path = xs
    .map((x, index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${ys[index].toFixed(1)}`)
    .join(" ");
  return (
    <svg className="scope-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Scope movement">
      <line x1="16" y1={height - 24} x2={width - 8} y2={height - 24} stroke="#dfe1e6" />
      <path d={path} fill="none" stroke="#0052cc" strokeWidth="2.5" />
      {xs.map((x, index) => (
        <g key={`${series[index].label}-${index}`}>
          <circle cx={x} cy={ys[index]} r="4" fill="#0052cc" />
          <text x={x} y={ys[index] - 10} textAnchor="middle" className="chart-label">
            {series[index].added ? `+${series[index].added}` : series[index].cumulative}
          </text>
          <text x={x} y={height - 8} textAnchor="middle" className="chart-label muted">
            {series[index].label === "Sprint start" ? "Start" : String(series[index].label).slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
};

export const SeriesSpark = ({ points }) => {
  const series = points || [];
  if (series.length < 2) {
    return null;
  }
  const width = 360;
  const height = 96;
  const values = series.map((point) => Number(point.scopeChangePercent) || 0);
  const max = Math.max(20, ...values);
  const xs = series.map((_, index) => 24 + (index / Math.max(series.length - 1, 1)) * (width - 48));
  const ys = values.map((value) => height - 28 - (value / max) * (height - 44));
  const path = xs
    .map((x, index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${ys[index].toFixed(1)}`)
    .join(" ");
  return (
    <svg className="series-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Reliable sprint series">
      <path d={path} fill="none" stroke="#de350b" strokeWidth="2.5" />
      {xs.map((x, index) => (
        <g key={`${series[index].sprintId || series[index].sprintName}-${index}`}>
          <circle cx={x} cy={ys[index]} r="4" fill="#de350b" />
          <text x={x} y={ys[index] - 10} textAnchor="middle" className="chart-label">
            {series[index].scopeChangePercent == null ? "—" : `+${series[index].scopeChangePercent}%`}
          </text>
          <text x={x} y={height - 8} textAnchor="middle" className="chart-label muted">
            {series[index].isCurrent ? "Current" : series[index].sprintName}
          </text>
        </g>
      ))}
    </svg>
  );
};

export const EmptyState = ({ title, body }) => (
  <article className="card">
    <strong>{title}</strong>
    <p className="sub">{body}</p>
  </article>
);
