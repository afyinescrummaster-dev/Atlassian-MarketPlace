import {
  outlookNarrative,
  paceFlow,
  pickLearningInsight,
  readinessDimensions,
  readinessHeadline,
  recommendedNow,
  reliableSprintSeries,
} from "../dashboard-ia.js";
import {
  FindingRow,
  FlowTrack,
  RingMeter,
  SeriesSpark,
  StatusPill,
  Surface,
} from "../components/DashboardKit.jsx";

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
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
};

export default function OverviewView({
  snapshot,
  drilldown,
  showDrilldown,
  switchTab,
  overviewCoachItems,
  findingsTotal,
  briefKind,
  setBriefKind,
  selectedBrief,
  copyBrief,
  copyMessage,
  openBriefInRovo,
  onOpenRovo,
}) {
  const flow = paceFlow(snapshot);
  const recommendations = recommendedNow(snapshot);
  const insight = pickLearningInsight(snapshot);
  const series = reliableSprintSeries(snapshot, 3);
  const dimensions = readinessDimensions(snapshot);

  return (
    <section className="overview-fluent" aria-label="Sprint overview">
      <div className="outlook-grid">
        <Surface tone="elevated tint" className="outlook" aria-label="Delivery outlook">
          <div className="section-kicker">Delivery outlook</div>
          <p className="section-sub">A data-driven view of the sprint: ended, what changed, and what to do next.</p>
          <div className="outlook-body">
            <RingMeter
              value={snapshot.healthScore}
              max={snapshot.healthMax || 100}
              tone={snapshot.healthStatus === "Needs Attention" ? "warn" : ""}
              label={snapshot.healthStatus || "—"}
            />
            <div>
              <p className="lead">{outlookNarrative(snapshot)}</p>
              <div className="metric-row">
                <button
                  className={`metric-chip ${drilldown === "added" ? "active" : ""}`}
                  type="button"
                  onClick={() => showDrilldown("added")}
                >
                  <strong>{formatSigned(snapshot.scopeChangePercent, "%")}</strong>
                  <span>Scope growth</span>
                </button>
                <button
                  className={`metric-chip ${drilldown === "stale" ? "active" : ""}`}
                  type="button"
                  onClick={() => showDrilldown("stale")}
                >
                  <strong>{formatMetric(snapshot.staleCount)}</strong>
                  <span>Stale</span>
                </button>
                <button
                  className={`metric-chip ${drilldown === "blocked" ? "active" : ""}`}
                  type="button"
                  onClick={() => showDrilldown("blocked")}
                >
                  <strong>{formatMetric(snapshot.blockedCount)}</strong>
                  <span>Blocker{snapshot.blockedCount === 1 ? "" : "s"}</span>
                </button>
              </div>
            </div>
          </div>
        </Surface>

        <Surface tone="warm" className="recommend" aria-label="Recommended now">
          <div className="section-kicker">Recommended now</div>
          <p className="section-sub">High-impact actions to get delivery back on track.</p>
          {recommendations.length === 0 ? (
            <p className="sub">No ranked recommendations were generated from the current sprint data.</p>
          ) : (
            <ol className="recommend-list">
              {recommendations.map((item, index) => (
                <li key={item.id}>
                  <button type="button" onClick={() => showDrilldown(item.drillId)}>
                    <span className="finding-index">{index + 1}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <span className="sub">{item.summary}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="btn-row">
            <button className="btn" type="button" onClick={() => showDrilldown("findings")}>
              Review findings
            </button>
            <button className="btn ghost" type="button" onClick={onOpenRovo}>
              Open in Rovo
            </button>
          </div>
        </Surface>
      </div>

      <div className="sprint-flow" aria-label="Sprint flow">
        <div className="flow-copy">
          <div className="section-kicker">Sprint flow</div>
          <p className="section-sub">How work moved through the sprint, from commitment to completion.</p>
        </div>
        <div className="flow-meta">
          <button type="button" onClick={() => showDrilldown("original")}>
            <strong>{formatMetric(snapshot.originalCommittedCount)}</strong>
            <span>Original commitment</span>
          </button>
          <span aria-hidden="true">+</span>
          <button type="button" onClick={() => showDrilldown("added")}>
            <strong>{formatMetric(snapshot.addedIssueCount)}</strong>
            <span>Added after start</span>
          </button>
          <span aria-hidden="true">=</span>
          <button type="button" onClick={() => showDrilldown("completion")}>
            <strong>{formatMetric(snapshot.currentIssueCount)}</strong>
            <span>Current scope</span>
          </button>
          <button className="growth" type="button" onClick={() => showDrilldown("added")}>
            <strong>{formatSigned(snapshot.scopeChangePercent, "%")}</strong>
            <span>Scope growth</span>
          </button>
          <div className="elapsed">
            <span>{flow.elapsedPercent ?? "—"}% of sprint time elapsed</span>
            <span>{flow.remainingPercent ?? "—"}% remaining</span>
            <div className="progress-track">
              <div className="progress-fill calm" style={{ width: `${flow.elapsedPercent || 0}%` }} />
            </div>
          </div>
        </div>
        <FlowTrack notStarted={flow.notStarted} inProgress={flow.inProgress} done={flow.done} />
      </div>

      <div className="split-hero">
        <Surface tone="plain" className="focus-queue">
          <div className="card-head">
            <div>
              <div className="section-kicker">Focus queue</div>
              <p className="section-sub">The biggest opportunities to improve delivery right now.</p>
            </div>
            <button className="text-link inline" type="button" onClick={() => showDrilldown("findings")}>
              View all {findingsTotal} finding{findingsTotal === 1 ? "" : "s"}
            </button>
          </div>
          {overviewCoachItems.length === 0 ? (
            <p className="sub">No ranked attention items were detected from the current sprint data.</p>
          ) : (
            overviewCoachItems.map((item, index) => (
              <FindingRow
                key={item.id}
                index={index + 1}
                item={item}
                active={drilldown === item.drillId}
                onOpen={showDrilldown}
              />
            ))
          )}
        </Surface>

        <Surface tone="plain" className="sprint-quality">
          <div className="card-head">
            <div>
              <div className="section-kicker">Sprint quality</div>
              <p className="section-sub">How well the work was prepared for delivery.</p>
            </div>
            <div className="quality-score">
              <strong>
                {formatMetric(snapshot.healthScore)} / {snapshot.healthMax || 100}
              </strong>
              <StatusPill tone={snapshot.readiness?.assessment === "Needs attention" ? "bad" : ""}>
                {snapshot.readiness?.assessment || "Partial data"}
              </StatusPill>
            </div>
          </div>
          <div className="dimension-grid compact">
            {dimensions.map((item) => (
              <div key={item.id} className="dimension">
                <span>{item.label}</span>
                <div className="progress-track">
                  <div className="progress-fill calm" style={{ width: `${item.score || 0}%` }} />
                </div>
                <strong>{item.score == null ? "—" : item.score}</strong>
              </div>
            ))}
          </div>
          <p className="sub">{readinessHeadline(snapshot)}</p>
          <button className="btn" type="button" onClick={() => switchTab("readiness")}>
            Open readiness review
          </button>
        </Surface>
      </div>

      <div className="split-hero">
        <Surface tone="insight" className="learning-signal">
          <div className="section-kicker">Learning signal</div>
          <p className="section-sub">Scope increased after start in recent sprints.</p>
          {series.points.length > 1 ? <SeriesSpark points={series.points} /> : null}
          <p className="lead subtle">{insight.summary || insight.title}</p>
          <button className="btn ghost" type="button" onClick={() => switchTab("learning")}>
            View learning
          </button>
        </Surface>

        <Surface tone="plain" className="brief-studio">
          <div className="card-head">
            <div>
              <div className="section-kicker">Brief studio</div>
              <p className="section-sub">Create a ready-to-send summary for your audience.</p>
            </div>
            <div className="btn-row">
              {["team", "leadership", "retro"].map((id) => (
                <button
                  key={id}
                  className={`btn ${briefKind === id ? "primary" : "ghost"}`}
                  type="button"
                  onClick={() => setBriefKind(id)}
                >
                  {id === "team" ? "Team" : id === "leadership" ? "Leadership" : "Retrospective"}
                </button>
              ))}
            </div>
          </div>
          <p className="sub clip">
            {selectedBrief?.plain?.split("\n").filter(Boolean).slice(1, 3).join(" ") ||
              "Briefs appear once an active sprint snapshot is available."}
          </p>
          <div className="btn-row">
            <button className="btn" type="button" disabled={!selectedBrief} onClick={() => copyBrief(false)}>
              Copy brief
            </button>
            <button className="btn primary" type="button" disabled={!selectedBrief} onClick={openBriefInRovo}>
              Create with Rovo
            </button>
          </div>
          {copyMessage ? <p className="note">{copyMessage}</p> : null}
        </Surface>
      </div>
    </section>
  );
}
