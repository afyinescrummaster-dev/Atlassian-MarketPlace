import { useMemo, useState } from "react";
import {
  BRIEF_INCLUDE_DEFAULTS,
  BRIEF_MODES,
  ROVO_POLICY,
  briefFacts,
  filterBriefPreview,
  jiraReferences,
} from "../dashboard-ia.js";
import { RingMeter, SectionHeader, StatusPill } from "../components/DashboardKit.jsx";

export default function BriefsView({
  snapshot,
  briefs,
  briefKind,
  setBriefKind,
  copyMessage,
  onCopy,
  onOpenRovo,
}) {
  const [tone, setTone] = useState("concise");
  const [detail, setDetail] = useState("executive");
  const [includes, setIncludes] = useState(BRIEF_INCLUDE_DEFAULTS);
  const mode = BRIEF_MODES.find((row) => row.id === briefKind) || BRIEF_MODES[0];
  const selected = briefs?.[mode.key] || null;
  const preview = useMemo(
    () => filterBriefPreview({ brief: selected, includes, detail }),
    [selected, includes, detail],
  );
  const facts = briefFacts(snapshot);
  const refs = jiraReferences(snapshot);
  const generated = snapshot?.generatedAt
    ? new Date(snapshot.generatedAt).toLocaleString()
    : "—";

  const toggle = (key) =>
    setIncludes((current) => ({ ...current, [key]: !current[key] }));

  return (
    <section className="detail-page">
      <SectionHeader
        title="Brief studio"
        subtitle="Turn verified sprint facts into an audience-ready update."
        action={
          <div className="btn-row">
            {BRIEF_MODES.map((row) => (
              <button
                key={row.id}
                className={`btn ${briefKind === row.id ? "primary" : ""}`}
                type="button"
                onClick={() => setBriefKind(row.id)}
              >
                {row.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="triptych briefs-grid">
        <article className="card">
          <div className="kicker">Brief settings</div>
          <label className="field">
            <span>Audience</span>
            <select value={briefKind} onChange={(event) => setBriefKind(event.target.value)}>
              {BRIEF_MODES.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.audience}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Tone</span>
            <select value={tone} onChange={(event) => setTone(event.target.value)}>
              <option value="concise">Concise</option>
              <option value="direct">Direct</option>
            </select>
          </label>
          <label className="field">
            <span>Detail level</span>
            <select value={detail} onChange={(event) => setDetail(event.target.value)}>
              <option value="executive">Executive</option>
              <option value="concise">Concise</option>
            </select>
          </label>
          <div className="kicker">Include in brief</div>
          {Object.keys(BRIEF_INCLUDE_DEFAULTS).map((key) => (
            <label key={key} className="check">
              <input
                type="checkbox"
                checked={includes[key]}
                onChange={() => toggle(key)}
              />
              {key === "jira" ? "Jira links" : key[0].toUpperCase() + key.slice(1)}
            </label>
          ))}
          <p className="note">{ROVO_POLICY.note}</p>
        </article>

        <article className="card brief-preview-card">
          <div className="card-head">
            <h3>{preview.title || selected?.title || "Brief preview"}</h3>
            <StatusPill tone={snapshot.healthStatus === "Needs Attention" ? "bad" : ""}>
              {snapshot.healthStatus || "—"}
            </StatusPill>
          </div>
          <div className="hero-row">
            <RingMeter value={snapshot.healthScore} max={snapshot.healthMax || 100} />
            <p className="sub">
              {tone === "concise"
                ? "Clear, factual, and to the point."
                : "Direct and specific about the decisions needed."}{" "}
              Generated from verified Delivery Intelligence data as of {generated}.
            </p>
          </div>
          {preview.sections.length === 0 ? (
            <p className="sub">Briefs appear once an active sprint snapshot is available.</p>
          ) : (
            preview.sections.map((section) => (
              <div key={section.heading} className="brief-section">
                <div className="kicker">{section.heading}</div>
                {section.body.map((line) => (
                  <p className="sub" key={line}>
                    {line}
                  </p>
                ))}
              </div>
            ))
          )}
          {includes.jira ? (
            <p className="note">
              Jira references: {refs.shown.join(", ") || "none"}
              {refs.extra ? `, +${refs.extra} more` : ""}
            </p>
          ) : null}
        </article>

        <div className="stack">
          <article className="card">
            <div className="kicker">Source & trust</div>
            <p className="sub">
              <strong>Deterministic facts included.</strong> These metrics come from Jira
              and cannot be changed by Rovo.
            </p>
            <ul className="plain-list">
              {facts.map((fact) => (
                <li key={fact.label}>
                  {fact.label}: {fact.value}
                </li>
              ))}
            </ul>
            <p className="note">
              AI recommendations are only added when you choose Open with Rovo. Rovo may
              improve framing and next steps, but it must not change objective metrics.
            </p>
          </article>
          <article className="card">
            <div className="kicker">Actions</div>
            <div className="btn-row">
              <button className="btn" type="button" disabled={!selected} onClick={() => onCopy(false)}>
                Copy brief
              </button>
              <button className="btn" type="button" disabled={!selected} onClick={() => onCopy(true)}>
                Copy Markdown
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={!selected}
                onClick={onOpenRovo}
              >
                Create with Rovo
              </button>
            </div>
            {copyMessage ? <p className="note">{copyMessage}</p> : null}
          </article>
        </div>
      </div>
    </section>
  );
}
