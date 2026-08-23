import { useEffect, useMemo, useState } from "react";
import { invoke } from "@forge/bridge";
import { emptyBusinessFields } from "@report/field-catalog.js";
import "./MappingView.css";

const FieldSelect = ({ concept, fields, value, suggestions, onChange }) => {
  const [query, setQuery] = useState("");
  const compatible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return fields.filter((field) => {
      if (!needle) {
        return true;
      }

      return (
        field.name.toLowerCase().includes(needle) ||
        field.id.toLowerCase().includes(needle)
      );
    });
  }, [fields, query]);

  return (
    <section className="map-card">
      <header>
        <h3>{concept.label}</h3>
        <p>{concept.description}</p>
      </header>
      <label className="map-search">
        Search compatible fields
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by name or ID"
        />
      </label>
      <select
        value={value?.id || ""}
        onChange={(event) => {
          const id = event.target.value;
          if (!id) {
            onChange(null);
            return;
          }

          const field = fields.find((item) => item.id === id);
          onChange(
            field
              ? {
                  id: field.id,
                  name: field.name,
                  kind: field.kind,
                }
              : null,
          );
        }}
      >
        <option value="">Not configured</option>
        {compatible.map((field) => (
          <option key={field.id} value={field.id}>
            {field.name} ({field.id}) · {field.kind} · {field.schemaType}
            {field.searchable ? " · searchable" : ""}
          </option>
        ))}
      </select>
      <p className="map-selected">
        {value?.id
          ? `Selected: ${value.name} · ${value.id}`
          : "Selected: Not configured"}
      </p>
      {suggestions?.length ? (
        <p className="map-suggest">
          Likely matches (confirm before saving):{" "}
          {suggestions.map((item) => `${item.name} (${item.id})`).join("; ")}
        </p>
      ) : (
        <p className="map-suggest">No likely name matches on this site.</p>
      )}
    </section>
  );
};

const MappingView = ({ projectKey, onClose }) => {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [draft, setDraft] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [saveState, setSaveState] = useState("");

  useEffect(() => {
    let cancelled = false;

    invoke("getFieldCatalog")
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result?.ok) {
          setError(result?.error || "unavailable");
          setStatus("error");
          return;
        }

        setCatalog(result);
        setDraft(result.mapping);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setError("unavailable");
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const compatibleFields = (concept) => {
    const all = catalog?.fields ?? [];
    if (!concept.types?.length || concept.types.includes("any")) {
      return all;
    }

    return all.filter(
      (field) =>
        concept.types.includes(field.schemaType) ||
        field.schemaType === "any" ||
        field.schemaType === "array",
    );
  };

  const updateField = (conceptId, selected) => {
    setDraft((current) => ({
      ...current,
      fields: { ...emptyBusinessFields(), ...current.fields, [conceptId]: selected },
    }));
  };

  const updateValues = (patch) => {
    setDraft((current) => ({
      ...current,
      values: { ...current.values, ...patch },
    }));
  };

  const save = async (scope) => {
    setSaveState("saving");
    try {
      const result = await invoke("saveFieldMapping", {
        scope,
        mapping: draft,
      });
      if (!result?.ok) {
        setSaveState("error");
        return;
      }

      setDraft(result.mapping);
      setSaveState(`Saved ${scope === "site" ? "site default" : `project ${projectKey}`}.`);
    } catch {
      setSaveState("error");
    }
  };

  const testMapping = async () => {
    setSaveState("testing");
    try {
      const result = await invoke("testFieldMapping", { mapping: draft });
      if (!result?.ok) {
        setSaveState("error");
        return;
      }

      setDiagnostics(result.diagnostics);
      setSaveState("Test mapping complete.");
    } catch {
      setSaveState("error");
    }
  };

  if (status === "loading") {
    return (
      <div className="map-page">
        <p>Discovering Jira fields…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="map-page">
        <p>Field catalog could not be loaded.</p>
        <button type="button" onClick={onClose}>
          Back to report
        </button>
      </div>
    );
  }

  return (
    <div className="map-page">
      <header className="map-hero">
        <div>
          <p className="map-kicker">Field discovery and mapping</p>
          <h2>Map Jira fields for {projectKey}</h2>
          <p>
            Standard fields are mapped automatically from{" "}
            <code>/rest/api/3/field</code>. Custom business concepts stay unmapped
            until you confirm a field. Current source: {catalog.source}.
          </p>
        </div>
        <button type="button" className="map-secondary" onClick={onClose}>
          Back to report
        </button>
      </header>

      <section className="map-panel">
        <h3>Automatically mapped standard fields</h3>
        <ul className="map-standard">
          {catalog.standardMappings.map((item) => (
            <li key={item.id}>
              <strong>{item.label}</strong>
              <span>
                {item.fieldName} · {item.fieldId}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="map-grid">
        {catalog.concepts.map((concept) => (
          <FieldSelect
            key={concept.id}
            concept={concept}
            fields={compatibleFields(concept)}
            value={draft?.fields?.[concept.id]}
            suggestions={catalog.suggestions?.[concept.id]}
            onChange={(selected) => updateField(concept.id, selected)}
          />
        ))}
      </section>

      <section className="map-panel">
        <h3>Value configuration</h3>
        <fieldset>
          <legend>Critical priority values</legend>
          <div className="map-chips">
            {(catalog.priorities.length ? catalog.priorities : draft.values.criticalPriorities).map(
              (name) => {
                const checked = draft.values.criticalPriorities.includes(name);
                return (
                  <label key={name}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? draft.values.criticalPriorities.filter((item) => item !== name)
                          : [...draft.values.criticalPriorities, name];
                        updateValues({ criticalPriorities: next });
                      }}
                    />
                    {name}
                  </label>
                );
              },
            )}
          </div>
        </fieldset>
        <label>
          RAG values that mean At Risk or Red
          <input
            value={draft.values.ragAtRiskValues.join(", ")}
            onChange={(event) =>
              updateValues({
                ragAtRiskValues: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label>
          Blocked-indicator values that mean blocked
          <input
            value={draft.values.blockedValues.join(", ")}
            onChange={(event) =>
              updateValues({
                blockedValues: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <fieldset>
          <legend>Overdue date source</legend>
          <label>
            <input
              type="radio"
              checked={draft.values.overdueDateSource === "dueDate"}
              onChange={() => updateValues({ overdueDateSource: "dueDate" })}
            />
            Jira due date (standard)
          </label>
          <label>
            <input
              type="radio"
              checked={draft.values.overdueDateSource === "targetEndDate"}
              onChange={() => updateValues({ overdueDateSource: "targetEndDate" })}
            />
            Mapped target end date
          </label>
        </fieldset>
        <fieldset>
          <legend>Completion calculation</legend>
          <label>
            <input
              type="radio"
              checked={draft.values.completionMetric === "issueCount"}
              onChange={() => updateValues({ completionMetric: "issueCount" })}
            />
            Issue count (Done / Total)
          </label>
          <label>
            <input
              type="radio"
              checked={draft.values.completionMetric === "storyPoints"}
              onChange={() => updateValues({ completionMetric: "storyPoints" })}
            />
            Story points / estimate
          </label>
        </fieldset>
      </section>

      <div className="map-actions">
        <button type="button" onClick={() => save("project")}>
          Save for this project
        </button>
        <button type="button" className="map-secondary" onClick={() => save("site")}>
          Save as site default
        </button>
        <button type="button" className="map-secondary" onClick={testMapping}>
          Test mapping
        </button>
        <span>{error ? `Error: ${error}` : saveState}</span>
      </div>

      {diagnostics ? (
        <section className="map-panel">
          <h3>Mapping test</h3>
          <p>Issues retrieved: {diagnostics.issueCount}</p>
          <p>
            Mapped concepts: {diagnostics.mapped.length}. Unmapped:{" "}
            {diagnostics.unmapped.length}.
          </p>
          <p>
            Totals before render — Total {diagnostics.totals?.total}, To Do{" "}
            {diagnostics.totals?.toDo}, In Progress {diagnostics.totals?.inProgress},
            Done {diagnostics.totals?.completed}, Overdue {diagnostics.totals?.overdue}{" "}
            ({diagnostics.totals?.availability?.overdue}), Critical{" "}
            {diagnostics.totals?.criticalOpen}, Unassigned {diagnostics.totals?.unassigned}
            , Blocked {diagnostics.totals?.blocked} (
            {diagnostics.totals?.availability?.blocked}), Completion{" "}
            {diagnostics.totals?.completionPercent ?? "n/a"}% (
            {diagnostics.totals?.availability?.completion}).
          </p>
          {diagnostics.unmapped.length ? (
            <p>
              Unmapped: {diagnostics.unmapped.map((item) => item.label).join(", ")}
            </p>
          ) : null}
          {diagnostics.noData.length ? (
            <p>
              Mapped but no data in retrieved issues:{" "}
              {diagnostics.noData
                .map((item) => `${item.label} (${item.fieldId})`)
                .join(", ")}
            </p>
          ) : (
            <p>Every mapped field returned at least one value, or none are mapped.</p>
          )}
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Summary</th>
                <th>Status category</th>
                <th>Priority</th>
                <th>Overdue date</th>
                <th>Blocked</th>
              </tr>
            </thead>
            <tbody>
              {diagnostics.preview.map((row) => (
                <tr key={row.key}>
                  <td>{row.key}</td>
                  <td>{row.summary}</td>
                  <td>{row.statusCategory}</td>
                  <td>{row.priority}</td>
                  <td>{row.overdueDate || "—"}</td>
                  <td>{row.blocked == null ? "Not configured" : String(row.blocked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
};

export default MappingView;
