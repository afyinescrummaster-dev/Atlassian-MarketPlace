import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ISSUE_LIMIT,
  attentionReasons,
  calculateMetrics,
  isOverdue,
  isUnassigned,
} from "../src/report/metrics.js";

const today = "2026-08-20";

const issue = (overrides = {}) => ({
  key: "CLSD-1",
  summary: "Example",
  status: "To Do",
  statusCategory: "new",
  assignee: "Akeem",
  priority: "Medium",
  dueDate: null,
  ...overrides,
});

describe("calculateMetrics", () => {
  it("returns zeros for an empty issue collection", () => {
    const metrics = calculateMetrics([], { today });

    assert.equal(metrics.total, 0);
    assert.equal(metrics.toDo, 0);
    assert.equal(metrics.inProgress, 0);
    assert.equal(metrics.completed, 0);
    assert.equal(metrics.unassigned, 0);
    assert.equal(metrics.overdue, 0);
    assert.equal(metrics.criticalOpen, 0);
    assert.deepEqual(metrics.attention, []);
    assert.equal(metrics.truncated, false);
    assert.equal(metrics.partial, false);
  });

  it("categorizes To Do, In Progress and Done by status category key", () => {
    const metrics = calculateMetrics(
      [
        issue({ key: "A-1", statusCategory: "new", status: "To Do" }),
        issue({
          key: "A-2",
          statusCategory: "indeterminate",
          status: "In Progress",
        }),
        issue({ key: "A-3", statusCategory: "done", status: "Done" }),
      ],
      { today },
    );

    assert.equal(metrics.toDo, 1);
    assert.equal(metrics.inProgress, 1);
    assert.equal(metrics.completed, 1);
    assert.equal(metrics.total, 3);
  });

  it("counts a missing assignee as unassigned", () => {
    const metrics = calculateMetrics(
      [issue({ assignee: null }), issue({ assignee: "Akeem" })],
      { today },
    );

    assert.equal(metrics.unassigned, 1);
    assert.equal(isUnassigned(issue({ assignee: null })), true);
  });

  it("counts an overdue open issue", () => {
    const overdueIssue = issue({
      key: "CLSD-9",
      dueDate: "2026-08-01",
      statusCategory: "indeterminate",
      status: "In Progress",
    });

    assert.equal(isOverdue(overdueIssue, today), true);
    assert.equal(calculateMetrics([overdueIssue], { today }).overdue, 1);
  });

  it("does not count a completed issue with an old due date as overdue", () => {
    const doneIssue = issue({
      key: "CLSD-10",
      dueDate: "2025-01-01",
      statusCategory: "done",
      status: "Done",
    });

    assert.equal(isOverdue(doneIssue, today), false);
    assert.equal(calculateMetrics([doneIssue], { today }).overdue, 0);
  });

  it("does not treat a missing due date as overdue", () => {
    const openIssue = issue({
      dueDate: null,
      statusCategory: "new",
    });

    assert.equal(isOverdue(openIssue, today), false);
    assert.equal(calculateMetrics([openIssue], { today }).overdue, 0);
  });

  it("collects multiple attention reasons on one issue without duplicating it", () => {
    const hotIssue = issue({
      key: "CLSD-42",
      summary: "Needs owners",
      assignee: null,
      dueDate: "2026-01-01",
      priority: "Highest",
      statusCategory: "new",
      status: "To Do",
    });

    const reasons = attentionReasons(hotIssue, today);
    assert.deepEqual(reasons, [
      "Overdue",
      "Unassigned",
      "Critical/Highest priority",
    ]);

    const metrics = calculateMetrics([hotIssue], { today });
    assert.equal(metrics.attention.length, 1);
    assert.equal(metrics.attention[0].key, "CLSD-42");
    assert.deepEqual(metrics.attention[0].reasons, reasons);
  });

  it("records retrieval-limit and partial-data state", () => {
    const issues = Array.from({ length: ISSUE_LIMIT }, (_, index) =>
      issue({ key: `CLSD-${index + 1}` }),
    );

    const metrics = calculateMetrics(issues, {
      today,
      truncated: true,
      partial: true,
      limit: ISSUE_LIMIT,
    });

    assert.equal(metrics.total, ISSUE_LIMIT);
    assert.equal(metrics.truncated, true);
    assert.equal(metrics.partial, true);
    assert.equal(metrics.limit, ISSUE_LIMIT);
  });
});
