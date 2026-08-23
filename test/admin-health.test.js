import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeFields } from "../src/admin-health/fields.js";
import { analyzeProject, summarizeProjects } from "../src/admin-health/projects.js";
import { calculateHealthScore } from "../src/admin-health/score.js";
import { buildRecommendations } from "../src/admin-health/recommendations.js";
import { buildAdminHealthReport } from "../src/admin-health/analyze.js";
import { normalizeFieldName } from "../src/admin-health/normalize.js";

describe("normalizeFieldName", () => {
  it("trims, collapses whitespace, and lower-cases", () => {
    assert.equal(normalizeFieldName("  Target   Date "), "target date");
    assert.equal(normalizeFieldName("target date"), "target date");
    assert.equal(normalizeFieldName("Target Date"), "target date");
  });
});

describe("custom field duplicate detection", () => {
  it("groups custom fields with identical normalized names", () => {
    const result = analyzeFields([
      { id: "customfield_1", name: "Target Date", custom: true, schema: { type: "date" } },
      { id: "customfield_2", name: "target date", custom: true, schema: { type: "date" } },
      { id: "customfield_3", name: "Target Date ", custom: true, schema: { type: "date" } },
      { id: "summary", name: "Summary", custom: false, schema: { type: "string" } },
      { id: "customfield_4", name: "Story Points", custom: true, schema: { type: "number" } },
    ]);

    assert.equal(result.customCount, 4);
    assert.equal(result.systemCount, 1);
    assert.equal(result.duplicateGroupCount, 1);
    assert.equal(result.duplicateGroups[0].count, 3);
    assert.equal(result.duplicateGroups[0].normalizedName, "target date");
  });

  it("counts custom fields by type", () => {
    const result = analyzeFields([
      {
        id: "customfield_1",
        name: "Team",
        custom: true,
        schema: { type: "option", custom: "com.atlassian.jira.plugin.system.customfieldtypes:select" },
      },
      { id: "customfield_2", name: "Points", custom: true, schema: { type: "number" } },
    ]);

    assert.equal(result.typeBreakdown[0].count >= 1, true);
    assert.ok(result.typeBreakdown.some((row) => row.type === "select" || row.type === "number"));
  });
});

describe("project hygiene", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");

  it("flags empty, inactive, missing lead, and low volume", () => {
    const empty = analyzeProject(
      {
        key: "EMPTY",
        name: "Empty Proj",
        projectTypeKey: "software",
        insight: { totalIssueCount: 0, lastIssueUpdateTime: null },
        lead: null,
      },
      { now },
    );
    assert.equal(empty.empty, true);
    assert.ok(empty.findings.some((f) => f.code === "empty"));
    assert.ok(empty.findings.some((f) => f.code === "missing-lead"));

    const inactive = analyzeProject(
      {
        key: "OLD",
        name: "Marketing Archive",
        projectTypeKey: "business",
        insight: {
          totalIssueCount: 12,
          lastIssueUpdateTime: "2025-01-01T00:00:00.000Z",
        },
        lead: { displayName: "Ada", accountId: "abc" },
      },
      { now },
    );
    assert.equal(inactive.inactive, true);
    assert.ok(inactive.findings.some((f) => f.code === "inactive"));
    assert.match(
      inactive.findings.find((f) => f.code === "inactive").reason,
      /No issue updated in \d+ days/,
    );

    const low = analyzeProject(
      {
        key: "LOW",
        name: "Tiny",
        projectTypeKey: "software",
        insight: {
          totalIssueCount: 2,
          lastIssueUpdateTime: "2026-08-20T00:00:00.000Z",
        },
        lead: { displayName: "Bea", accountId: "def" },
      },
      { now },
    );
    assert.equal(low.lowVolume, true);
  });

  it("summarizes project type counts without inventing data", () => {
    const summary = summarizeProjects(
      [
        {
          key: "S1",
          name: "Soft",
          projectTypeKey: "software",
          insight: {
            totalIssueCount: 10,
            lastIssueUpdateTime: "2026-08-01T00:00:00.000Z",
          },
          lead: { accountId: "1" },
        },
        {
          key: "JSM",
          name: "Service",
          projectTypeKey: "service_desk",
          insight: { totalIssueCount: 0 },
          lead: { accountId: "2" },
        },
      ],
      { now },
    );

    assert.equal(summary.total, 2);
    assert.equal(summary.byType.software, 1);
    assert.equal(summary.byType.service_desk, 1);
    assert.equal(summary.empty, 1);
  });
});

describe("health score and recommendations", () => {
  it("applies transparent capped deductions", () => {
    const health = calculateHealthScore({
      duplicateGroupCount: 2,
      emptyProjectCount: 1,
      inactiveProjectCount: 1,
      missingLeadCount: 0,
      lowVolumeProjectCount: 0,
    });

    // 100 - (2*3) - 5 - 4 = 85
    assert.equal(health.score, 85);
    assert.equal(health.max, 100);
    assert.ok(health.disclaimer.includes("advisory"));
  });

  it("caps large duplicate group deductions", () => {
    const health = calculateHealthScore({ duplicateGroupCount: 20 });
    assert.equal(health.score, 70); // 100 - max 30
  });

  it("builds read-only recommendation cards that match findings", () => {
    const report = buildAdminHealthReport({
      now: new Date("2026-08-23T12:00:00.000Z"),
      fields: [
        { id: "customfield_1", name: "Target Date", custom: true, schema: { type: "date" } },
        { id: "customfield_2", name: "target date", custom: true, schema: { type: "date" } },
      ],
      projects: [
        {
          key: "EMPTY",
          name: "Empty",
          projectTypeKey: "software",
          insight: { totalIssueCount: 0 },
          lead: { accountId: "1" },
        },
        {
          key: "OLD",
          name: "Old",
          projectTypeKey: "business",
          insight: {
            totalIssueCount: 5,
            lastIssueUpdateTime: "2025-01-01T00:00:00.000Z",
          },
          lead: { accountId: "2" },
        },
      ],
    });

    assert.equal(report.overview.duplicateFieldGroups, 1);
    assert.equal(report.overview.emptyProjects, 1);
    assert.equal(report.overview.potentiallyInactiveProjects, 1);
    assert.ok(report.recommendations.some((c) => c.id === "duplicate-fields"));
    assert.ok(report.recommendations.some((c) => c.id === "empty-projects"));
    assert.ok(report.recommendations.some((c) => c.id === "inactive-projects"));
    assert.equal(
      report.recommendations.every((c) => typeof c.actionLabel === "string"),
      true,
    );
  });

  it("keeps recommendation builder free of mutate/delete actions", () => {
    const cards = buildRecommendations({
      fields: { duplicateGroupCount: 1 },
      projects: {
        potentiallyInactive: 1,
        empty: 0,
        missingLead: 0,
        lowVolume: 0,
        inactiveDays: 90,
      },
    });

    for (const card of cards) {
      assert.equal(/delete|remove|fix|modify/i.test(card.title), false);
      assert.equal(/delete|remove|fix|modify/i.test(card.summary), false);
    }
  });
});
