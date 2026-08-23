import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attentionSeverity,
  selectAttentionPreview,
} from "../src/report/attention-preview.js";

describe("selectAttentionPreview", () => {
  it("ranks overdue critical items ahead of unassigned items", () => {
    const preview = selectAttentionPreview(
      [
        {
          key: "SW-3",
          summary: "Needs owner",
          reasons: ["Unassigned"],
          dueDate: null,
        },
        {
          key: "SW-1",
          summary: "Late and critical",
          reasons: ["Overdue", "Critical/Highest priority"],
          dueDate: "2026-08-01",
        },
        {
          key: "SW-2",
          summary: "Overdue only",
          reasons: ["Overdue"],
          dueDate: "2026-08-02",
        },
      ],
      3,
    );

    assert.deepEqual(
      preview.map((row) => row.key),
      ["SW-1", "SW-2", "SW-3"],
    );
  });

  it("limits the preview and does not invent issues", () => {
    const preview = selectAttentionPreview(
      [
        { key: "MC-1", reasons: ["Overdue"], dueDate: "2026-01-01" },
        { key: "MC-2", reasons: ["Unassigned"], dueDate: null },
      ],
      1,
    );

    assert.equal(preview.length, 1);
    assert.equal(preview[0].key, "MC-1");
  });

  it("returns an empty list when there is nothing requiring attention", () => {
    assert.deepEqual(selectAttentionPreview([]), []);
    assert.equal(attentionSeverity([]), 5);
  });
});
