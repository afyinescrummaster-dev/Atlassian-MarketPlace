import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUSINESS_CONCEPTS,
  defaultValueConfig,
  suggestFields,
  summarizeField,
} from "../src/report/field-catalog.js";
import { extractDate, extractScalar, matchesConfiguredValue } from "../src/report/extract.js";
import { overallHealth } from "../src/report/health.js";
import {
  buildSearchFields,
  normalizeSearchIssue,
  sanitizeMapping,
} from "../src/report/mapping.js";
import { calculateMetrics, isOverdue } from "../src/report/metrics.js";

describe("field discovery helpers", () => {
  it("summarizes Jira field metadata without assuming customfield IDs", () => {
    const field = summarizeField({
      id: "customfield_12345",
      name: "Team",
      custom: true,
      searchable: true,
      clauseNames: ["Team"],
      schema: { type: "option", custom: "select" },
    });

    assert.equal(field.id, "customfield_12345");
    assert.equal(field.kind, "custom");
    assert.equal(field.searchable, true);
  });

  it("suggests likely matches by name but does not auto-select them", () => {
    const fields = [
      { id: "customfield_1", name: "Story Points", custom: true, schema: { type: "number" } },
      { id: "summary", name: "Summary", custom: false, schema: { type: "string" } },
    ].map(summarizeField);
    const concept = BUSINESS_CONCEPTS.find((item) => item.id === "storyPoints");
    const suggestions = suggestFields(fields, concept);

    assert.equal(suggestions[0].id, "customfield_1");
    assert.equal(suggestions.length, 1);
  });
});

describe("mapping and extraction", () => {
  it("keeps unmapped business fields null instead of inventing IDs", () => {
    const mapping = sanitizeMapping(null, { projectKey: "SALES" });
    assert.equal(mapping.fields.targetEndDate, null);
    assert.equal(mapping.fields.team, null);
    assert.equal(mapping.values.overdueDateSource, "dueDate");
  });

  it("adds mapped custom fields to the Jira search field list", () => {
    const mapping = sanitizeMapping({
      fields: {
        storyPoints: { id: "customfield_10016", name: "Story Points" },
      },
    });
    const fields = buildSearchFields(mapping);
    assert.ok(fields.includes("summary"));
    assert.ok(fields.includes("customfield_10016"));
  });

  it("extracts dates and option values from Jira payloads", () => {
    assert.equal(extractDate("2026-08-01T12:00:00.000Z"), "2026-08-01");
    assert.equal(extractScalar({ value: "Red" }), "Red");
    assert.equal(matchesConfiguredValue({ value: "Blocked" }, ["Blocked"]), true);
  });

  it("normalizes a search issue using standard fields plus mapping", () => {
    const mapping = sanitizeMapping({
      fields: {
        targetEndDate: { id: "customfield_10001", name: "Target end" },
        blocked: { id: "customfield_10002", name: "Blocked" },
      },
      values: {
        overdueDateSource: "targetEndDate",
        blockedValues: ["Yes"],
      },
    });
    const issue = normalizeSearchIssue(
      {
        key: "SALES-1",
        fields: {
          summary: "Pipeline review",
          status: { name: "Development", statusCategory: { key: "indeterminate" } },
          issuetype: { name: "Story" },
          priority: { name: "High" },
          assignee: null,
          duedate: "2020-01-01",
          customfield_10001: "2026-08-21",
          customfield_10002: { value: "Yes" },
        },
      },
      mapping,
    );

    assert.equal(issue.key, "SALES-1");
    assert.equal(issue.statusCategory, "indeterminate");
    assert.equal(issue.dueDate, "2020-01-01");
    assert.equal(issue.targetEndDate, "2026-08-21");
    assert.equal(issue.overdueDate, "2026-08-21");
    assert.equal(issue.blocked, true);
    assert.equal(isOverdue(issue, "2026-08-20", { overdueConfigured: true }), false);
  });
});

describe("configured metrics", () => {
  it("does not treat a missing mapped date as overdue", () => {
    const metrics = calculateMetrics(
      [
        {
          key: "SALES-2",
          statusCategory: "new",
          assignee: "Akeem",
          priority: "Low",
          overdueDate: null,
          dueDate: null,
        },
      ],
      { today: "2026-08-20", overdueConfigured: true },
    );

    assert.equal(metrics.overdue, 0);
    assert.equal(metrics.availability.overdue, "no-data");
  });

  it("returns not-configured instead of a fake overdue total", () => {
    const metrics = calculateMetrics(
      [{ key: "SALES-3", statusCategory: "new", overdueDate: null }],
      { today: "2026-08-20", overdueConfigured: false },
    );

    assert.equal(metrics.availability.overdue, "not-configured");
    assert.equal(metrics.overdue, 0);
  });

  it("includes blocked in attention without duplicating the issue", () => {
    const metrics = calculateMetrics(
      [
        {
          key: "SALES-4",
          summary: "Stuck",
          statusCategory: "indeterminate",
          assignee: null,
          priority: "Highest",
          overdueDate: "2026-01-01",
          blocked: true,
        },
      ],
      {
        today: "2026-08-20",
        blockedConfigured: true,
        criticalPriorityNames: ["Critical", "Highest"],
      },
    );

    assert.equal(metrics.attention.length, 1);
    assert.deepEqual(metrics.attention[0].reasons, [
      "Overdue",
      "Unassigned",
      "Critical/Highest priority",
      "Blocked",
    ]);
  });

  it("marks At Risk from critical issues or a 20% overdue threshold", () => {
    const critical = overallHealth({
      total: 10,
      overdue: 1,
      criticalOpen: 1,
      blocked: 0,
      availability: { overdue: "ok", blocked: "not-configured" },
      criticalPriorityRule: "Open issues whose Jira priority name is Critical or Highest",
    });
    assert.equal(critical.label, "AT RISK");
    assert.match(critical.reasons[0], /critical/i);

    const overdueShare = overallHealth({
      total: 10,
      overdue: 3,
      criticalOpen: 0,
      blocked: 0,
      availability: { overdue: "ok", blocked: "not-configured" },
      criticalPriorityRule: "rule",
    });
    assert.equal(overdueShare.label, "AT RISK");
    assert.match(overdueShare.reasons.join(" "), /20%/);

    const onTrack = overallHealth({
      total: 10,
      overdue: 1,
      criticalOpen: 0,
      blocked: 0,
      availability: { overdue: "ok", blocked: "not-configured" },
      criticalPriorityRule: "rule",
    });
    assert.equal(onTrack.label, "ON TRACK");
  });
});

describe("default value config", () => {
  it("uses Critical and Highest when those priority names exist", () => {
    const values = defaultValueConfig(["Low", "Medium", "High", "Highest", "Critical"]);
    assert.deepEqual(values.criticalPriorities, ["Critical", "Highest"]);
  });
});
