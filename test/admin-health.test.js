import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeFields } from "../src/admin-health/fields.js";
import { analyzeProject, summarizeProjects } from "../src/admin-health/projects.js";
import { calculateHealthScore } from "../src/admin-health/score.js";
import { buildRecommendations } from "../src/admin-health/recommendations.js";
import { buildAdminHealthReport } from "../src/admin-health/analyze.js";
import { classifyProjectRecommendation } from "../src/admin-health/classify.js";
import { normalizeFieldName } from "../src/admin-health/normalize.js";
import {
  CLASSIFICATION,
  SEVERITY,
} from "../src/admin-health/constants.js";

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
    assert.equal(result.duplicateGroups[0].typeMismatch, false);
    assert.equal(result.findingRecords.length, 1);
    assert.equal(result.findingRecords[0].severity, SEVERITY.REVIEW);
  });

  it("flags type mismatch within duplicate-name groups", () => {
    const result = analyzeFields([
      {
        id: "customfield_10198",
        name: "Impact",
        custom: true,
        schema: {
          type: "option",
          custom: "com.atlassian.jira.plugin.system.customfieldtypes:select",
        },
      },
      {
        id: "customfield_10004",
        name: "Impact",
        custom: true,
        schema: { type: "string" },
      },
      {
        id: "customfield_10336",
        name: "Impact",
        custom: true,
        schema: {
          type: "option",
          custom: "com.atlassian.jira.plugin.system.customfieldtypes:select",
        },
      },
    ]);

    assert.equal(result.duplicateGroupCount, 1);
    assert.equal(result.duplicateGroups[0].typeMismatch, true);
    assert.equal(result.typeMismatchGroupCount, 1);
    assert.ok(result.duplicateGroups[0].types.includes("select"));
    assert.ok(result.duplicateGroups[0].types.includes("string"));
    assert.match(result.duplicateGroups[0].recommendation, /different field types/i);
    assert.ok(result.findingRecords[0].filterKeys.includes("type-mismatch"));
  });

  it("counts custom fields by type", () => {
    const result = analyzeFields([
      {
        id: "customfield_1",
        name: "Team",
        custom: true,
        schema: {
          type: "option",
          custom: "com.atlassian.jira.plugin.system.customfieldtypes:select",
        },
      },
      { id: "customfield_2", name: "Points", custom: true, schema: { type: "number" } },
    ]);

    assert.equal(result.typeBreakdown[0].count >= 1, true);
    assert.ok(
      result.typeBreakdown.some((row) => row.type === "select" || row.type === "number"),
    );
  });
});

describe("project recommendation classifications", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");

  it("marks strong archive candidates for empty/stale live projects", () => {
    const empty = analyzeProject(
      {
        key: "EMPTY",
        name: "Empty Proj",
        projectTypeKey: "software",
        insight: { totalIssueCount: 0, lastIssueUpdateTime: null },
        lead: { accountId: "1", displayName: "Ada" },
      },
      { now },
    );
    assert.equal(empty.classification.code, CLASSIFICATION.STRONG_ARCHIVE);
    assert.equal(empty.classification.severity, SEVERITY.HIGH);

    const staleLow = analyzeProject(
      {
        key: "STALE",
        name: "Stale Low",
        projectTypeKey: "business",
        insight: {
          totalIssueCount: 2,
          lastIssueUpdateTime: "2025-01-01T00:00:00.000Z",
        },
        lead: { accountId: "1", displayName: "Ada" },
      },
      { now },
    );
    assert.equal(staleLow.ageDays >= 365, true);
    assert.equal(staleLow.classification.code, CLASSIFICATION.STRONG_ARCHIVE);
  });

  it("marks review-for-archive for modest volume and 180+ days", () => {
    const project = analyzeProject(
      {
        key: "MID",
        name: "Mid",
        projectTypeKey: "software",
        insight: {
          totalIssueCount: 40,
          lastIssueUpdateTime: "2025-12-01T00:00:00.000Z",
        },
        lead: { accountId: "1", displayName: "Ada" },
      },
      { now },
    );
    assert.equal(project.ageDays >= 180, true);
    assert.equal(project.classification.code, CLASSIFICATION.REVIEW_ARCHIVE);
    assert.equal(project.classification.severity, SEVERITY.REVIEW);
  });

  it("marks investigate-inactivity for large inactive histories", () => {
    const project = analyzeProject(
      {
        key: "ITO",
        name: "IT Operations",
        projectTypeKey: "service_desk",
        insight: {
          totalIssueCount: 9640,
          lastIssueUpdateTime: "2025-12-12T00:00:00.000Z",
        },
        lead: { accountId: "1", displayName: "Ada" },
      },
      { now },
    );
    assert.equal(project.inactive, true);
    assert.equal(project.classification.code, CLASSIFICATION.INVESTIGATE);
    assert.match(project.classification.explanation, /large issue history/i);
  });

  it("marks review ownership when lead is missing", () => {
    const project = analyzeProject(
      {
        key: "OWN",
        name: "Owned?",
        projectTypeKey: "software",
        insight: {
          totalIssueCount: 20,
          lastIssueUpdateTime: "2026-08-01T00:00:00.000Z",
        },
        lead: null,
      },
      { now },
    );
    assert.equal(project.classification.code, CLASSIFICATION.OWNERSHIP);
  });

  it("exposes classifyProjectRecommendation as a pure helper", () => {
    const result = classifyProjectRecommendation({
      archived: false,
      empty: true,
      totalIssueCount: 0,
      ageDays: null,
      inactive: false,
      leadPresent: true,
      lowVolume: false,
    });
    assert.equal(result.code, CLASSIFICATION.STRONG_ARCHIVE);
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
    assert.ok(summary.findingRecords.length >= 1);
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

  it("keeps score deterministic for identical inputs", () => {
    const input = {
      duplicateGroupCount: 3,
      emptyProjectCount: 2,
      inactiveProjectCount: 4,
      missingLeadCount: 1,
      lowVolumeProjectCount: 2,
    };
    assert.equal(
      calculateHealthScore(input).score,
      calculateHealthScore(input).score,
    );
  });

  it("builds actionable recommendation cards with filters", () => {
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

    assert.equal(report.version, "0.3");
    assert.equal(report.overview.duplicateFieldGroups, 1);
    assert.equal(report.overview.emptyProjects, 1);
    assert.equal(report.overview.potentiallyInactiveProjects, 1);
    assert.ok(report.findings.total >= 2);
    assert.ok(report.recommendations.some((c) => c.id === "duplicate-fields"));
    assert.ok(report.recommendations.some((c) => c.id === "empty-projects"));
    assert.ok(report.recommendations.some((c) => c.id === "inactive-projects"));
    assert.equal(
      report.recommendations.every(
        (c) => typeof c.actionLabel === "string" && typeof c.filter === "string",
      ),
      true,
    );
    assert.ok(report.findings.bySeverity.High >= 1);
  });

  it("keeps recommendation builder free of mutate/delete actions", () => {
    const cards = buildRecommendations({
      fields: { duplicateGroupCount: 1, typeMismatchGroupCount: 0 },
      projects: {
        potentiallyInactive: 1,
        empty: 0,
        missingLead: 0,
        lowVolume: 0,
        strongArchiveCandidates: 0,
        reviewForArchive: 0,
        inactiveDays: 90,
      },
      findings: { bySeverity: { High: 0, Review: 2, Informational: 0 } },
    });

    for (const card of cards) {
      assert.equal(/^(delete|remove|modify)\b/i.test(card.title), false);
      assert.equal(/\b(delete|remove|modify) (this|these|all|the)\b/i.test(card.summary), false);
      assert.equal(typeof card.filter, "string");
      assert.equal(typeof card.section, "string");
    }
  });
});

describe("navigation helpers", () => {
  it("builds reliable project and field admin URLs", async () => {
    const {
      projectBrowseUrl,
      customFieldsAdminUrl,
      customFieldConfigureUrl,
      numericCustomFieldId,
      projectSettingsLocation,
    } = await import("../src/admin-health/navigation.js");

    assert.equal(
      projectBrowseUrl("https://example.atlassian.net/", "DES"),
      "https://example.atlassian.net/jira/projects/DES",
    );
    assert.equal(
      customFieldsAdminUrl("https://example.atlassian.net"),
      "https://example.atlassian.net/jira/settings/issues/custom-fields",
    );
    assert.equal(numericCustomFieldId("customfield_10004"), "10004");
    assert.equal(
      customFieldConfigureUrl(
        "https://example.atlassian.net",
        "customfield_10004",
      ),
      "https://example.atlassian.net/secure/admin/ConfigureCustomField!default.jspa?customFieldId=10004",
    );
    assert.equal(customFieldConfigureUrl("https://example.atlassian.net", "bad"), null);
    assert.deepEqual(projectSettingsLocation("DES"), {
      target: "projectSettingsDetails",
      projectKey: "DES",
    });
  });
});

describe("inactivity threshold settings", () => {
  it("normalizes allowed thresholds and defaults invalid values", async () => {
    const { normalizeInactiveDays, sanitizeSettings } = await import(
      "../src/admin-health/settings.js"
    );
    assert.equal(normalizeInactiveDays(180), 180);
    assert.equal(normalizeInactiveDays(365), 365);
    assert.equal(normalizeInactiveDays(12), 90);
    assert.equal(sanitizeSettings({ inactiveDays: 180 }).inactiveDays, 180);
  });

  it("recomputes inactive findings when threshold changes", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const projects = [
      {
        key: "MID",
        name: "Mid",
        projectTypeKey: "software",
        insight: {
          totalIssueCount: 40,
          lastIssueUpdateTime: "2026-03-01T00:00:00.000Z",
        },
        lead: { accountId: "1" },
      },
    ];

    const at90 = buildAdminHealthReport({ now, projects, fields: [], inactiveDays: 90 });
    const at365 = buildAdminHealthReport({ now, projects, fields: [], inactiveDays: 365 });

    assert.equal(at90.overview.potentiallyInactiveProjects, 1);
    assert.equal(at365.overview.potentiallyInactiveProjects, 0);
  });
});
