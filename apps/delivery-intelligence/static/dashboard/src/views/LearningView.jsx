import {
  attentionLevelLabel,
  capabilityState,
  pickLearningInsight,
  reliableSprintSeries,
  suggestedExperiments,
} from "../dashboard-ia.js";
import {
  CapabilityState,
  MetricCompare,
  SectionHeader,
  SeriesSpark,
  StatusPill,
} from "../components/DashboardKit.jsx";

const patternDirection = (pattern) => {
  if (
    pattern.id === "recurring_scope_growth" ||
    pattern.id === "recurring_blockers" ||
    pattern.id === "recurring_carryover"
  ) {
    return "Recurring";
  }
  if (pattern.id === "completion_below_recent_average" || pattern.id === "declining_health_trend") {
    return "Decreasing";
  }
  return "Observed";
};


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
            <span className="meta">Last {Math.max(series.points.length, 1)} reliable sprint{series.points.length === 1 ? "" : "s"}</span>
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

      <div className="learning-hero">
        <div className="panel">
          <div className="panel-title">Key insight</div>
          <h3>{insight.title}</h3>
          <p className="sub">{insight.summary}</p>
          <CapabilityState state={historyCap} />
        </div>
        <div className="panel">
          <div className="panel-title">Reliable sprint series</div>
          {series.points.length < 2 ? (
            <p className="sub">
              Only the current sprint is available. Previous-sprint comparison is not invented.
            </p>
          ) : (
            <SeriesSpark points={series.points} />
          )}
        </div>
        <div className="panel">
          <div className="panel-title">What this means for your team</div>
          <p className="sub">
            Use completed sprints with reliable data only. Do not treat a short series as a
            causal claim or a forecast.
          </p>
        </div>
      </div>

      <div className="split-hero">
        <div className="panel">
          <div className="panel-title">Patterns detected</div>
          {patterns.length === 0 ? (
            <p className="sub">{historyCap.reason}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Evidence</th>
                  <th>Direction</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {patterns.map((pattern) => (
                  <tr key={pattern.id}>
                    <td>
                      <strong>{pattern.title}</strong>
                    </td>
                    <td>{pattern.evidence}</td>
                    <td>{patternDirection(pattern)}</td>
                    <td>
                      <StatusPill>{attentionLevelLabel(pattern.attentionLevel)}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="panel">
          <div className="panel-title">Sprint comparison</div>
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
        </div>
      </div>

      <div className="learning-hero">
        <div className="panel">
          <div className="panel-title">Retrospective questions</div>
          {questions.length === 0 ? (
            <p className="sub">No retrospective questions were generated.</p>
          ) : (
            <ol className="numbered">
              {questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          )}
        </div>
        <div className="panel">
          <div className="panel-title">Suggested experiment</div>
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
        </div>
        <div className="panel">
          <div className="panel-title">Learning history</div>
          <p className="sub">
            Past experiment outcomes are not stored yet, so this panel stays empty rather than
            inventing results.
          </p>
        </div>
      </div>
    </section>
  );
}
