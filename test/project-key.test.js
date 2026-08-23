import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProjectJql,
  getProjectKeyFromContext,
  isValidProjectKey,
} from "../src/report/project-key.js";

describe("getProjectKeyFromContext", () => {
  it("reads the project key from Forge project-page extension context", () => {
    const key = getProjectKeyFromContext({
      extension: {
        type: "jira:projectPage",
        project: { id: "10000", key: "sw", type: "software" },
      },
    });

    assert.equal(key, "SW");
  });

  it("reads a JSM project key from the same context shape", () => {
    const key = getProjectKeyFromContext({
      extension: {
        type: "jira:projectPage",
        project: { id: "10001", key: "clsd", type: "service_desk" },
      },
    });

    assert.equal(key, "CLSD");
  });

  it("reads a Jira Business project key from the same context shape", () => {
    const key = getProjectKeyFromContext({
      extension: {
        type: "jira:projectPage",
        project: { id: "10002", key: "mc", type: "business" },
      },
    });

    assert.equal(key, "MC");
  });

  it("does not default to a hardcoded project when context is missing", () => {
    assert.equal(getProjectKeyFromContext(undefined), null);
    assert.equal(getProjectKeyFromContext({}), null);
    assert.equal(getProjectKeyFromContext({ extension: {} }), null);
  });
});

describe("buildProjectJql", () => {
  it("builds JQL from the supplied project key", () => {
    assert.equal(
      buildProjectJql("SW"),
      'project = "SW" ORDER BY updated DESC',
    );
    assert.equal(
      buildProjectJql("SUP"),
      'project = "SUP" ORDER BY updated DESC',
    );
    assert.equal(
      buildProjectJql("CLSD"),
      'project = "CLSD" ORDER BY updated DESC',
    );
    assert.equal(
      buildProjectJql("MC"),
      'project = "MC" ORDER BY updated DESC',
    );
    assert.notEqual(buildProjectJql("CLSD"), buildProjectJql("MC"));
  });
});

describe("isValidProjectKey", () => {
  it("accepts standard Jira project keys and rejects invalid values", () => {
    assert.equal(isValidProjectKey("MC"), true);
    assert.equal(isValidProjectKey("CLSD"), true);
    assert.equal(isValidProjectKey("A"), false);
    assert.equal(isValidProjectKey("sw"), false);
    assert.equal(isValidProjectKey("project = SW"), false);
  });
});
