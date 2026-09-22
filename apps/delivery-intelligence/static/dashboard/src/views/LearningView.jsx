import {
  capabilityState,
  pickLearningInsight,
  reliableSprintSeries,
  suggestedExperiments,
} from "../dashboard-ia.js";
import {
  CapabilityState,
  MetricCompare,
  SectionHeader,
  StatusPill,
} from "../components/DashboardKit.jsx";

const suffixFor = (key) => {
  if (key === "healthScore") {
    return "";
  }
  if (String(key).includes("Percent")) {
    return "%";
  }
  return "";
};

export default function LearningView({ snapshot, onAskRovo, onCreateBrief }) {
  const insight = pickLearningInsight(snapshot);
  const series = reliableSprintSeries(snapshot, 3);
  const experiments = suggestedExperiments(snapshot);
  const patterns = snapshot?.historicalPatterns?.patterns || [];
  const comparison = snapshot?.comparison?.rows || [];
  const questions = snapshot?.retrospectiveQuestions || [];
  const compareCap = capabilityState(snapshot?.comparison?.capability);
  const historyCap = capabilityState(snapshot?.historicalPatterns?.capability);

  return (
    <section className="detail-page">
      <SectionHeader
        title="Learning across sprints"
        subtitle="Turn repeated delivery patterns into better team experiments."
        action={
          <div className="btn-row">
            <button className="btn" type="button" onClick={onCreateBrief}>
              Create retrospective brief
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                onAskRovo(
                  "Use Delivery Intelligence facts only. Help the team turn the current learning patterns into one small experiment. Do not invent history.",
                )
              }
            >
              Ask Rovo
            </button>
          </div>
        }
      />

      <div className="triptych">
        <article className="card">
          <div className="kicker">Key insight</div>
          <h3>{insight.title}</h3>
          <p className="sub">{insight.summary}</p>
          <CapabilityState state={historyCap} />
        </article>
        <article className="card">
          <div className="kicker">Reliable sprint series</div>
          {series.points.length < 2 ? (
            <p className="sub">
              Only the current sprint is available. Previous-sprint comparison is not invented.
            </p>
          ) : (
            <div className="spark-row">
              {series.points.map((point) => (
                <div key={point.sprintId || point.sprintName} className="spark-point">
                  <strong>
                    {point.scopeChangePercent == null ? "—" : `${point.scopeChangePercent}%`}
                  </strong>
                  <span>{point.isCurrent ? "Current" : point.sprintName}</span>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="card">
          <div className="kicker">What this means</div>
          <p className="sub">
            Use completed sprints with reliable data only. Do not treat a short series as a
            causal claim or a forecast.
          </p>
        </article>
      </div>

      <div className="split-hero">
        <article className="card">
          <div className="kicker">Patterns detected</div>
          {patterns.length === 0 ? (
            <p className="sub">{historyCap.reason}</p>
          ) : (
            <div className="grouped-list">
              {patterns.map((pattern) => (
                <div className="attention-row" key={pattern.id}>
                  <div className="attention-copy">
                    <div className="attention-head">
                      <StatusPill>{pattern.attentionLevel}</StatusPill>
                      <strong>{pattern.title}</strong>
                    </div>
                    <p className="sub">{pattern.evidence}</p>
                    <p className="note">{pattern.interpretation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="card">
          <div className="kicker">Sprint comparison</div>
          <CapabilityState state={compareCap} />
          <MetricCompare
            rows={comparison}
            formatValue={(row, which = "current") => {
              const value = which === "previous" ? row.previous : row.current;
              if (value == null) {
                return "—";
              }
              return `${value}${suffixFor(row.key)}`;
            }}
            formatDelta={(row) =>
              row.delta == null
                ? "—"
                : `${row.delta > 0 ? "+" : ""}${row.delta}${
                    row.key === "healthScore" || String(row.key).includes("Percent")
                      ? " points"
                      : ""
                  }`
            }
          />
        </article>
      </div>

      <div className="triptych">
        <article className="card">
          <div className="kicker">Retrospective questions</div>
          {questions.length === 0 ? (
            <p className="sub">No retrospective questions were generated.</p>
          ) : (
            <ol className="numbered">
              {questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          )}
        </article>
        <article className="card">
          <div className="kicker">Suggested experiment</div>
          {experiments.length === 0 ? (
            <p className="sub">No historical pattern is complete enough to suggest an experiment.</p>
          ) : (
            experiments.map((item) => (
              <div key={item.id}>
                <strong>{item.title}</strong>
                <p className="sub">{item.hypothesis}</p>
                <p className="note">{item.evidence}</p>
              </div>
            ))
          )}
        </article>
        <article className="card">
          <div className="kicker">Learning history</div>
          <p className="sub">
            Past experiment outcomes are not stored yet, so this panel stays empty rather than
            inventing results.
          </p>
        </article>
      </div>
    </section>
  );
}
