import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ROVO_INTENTS,
  buildUserPrompt,
  isNaturalLanguagePrompt,
} from "../src/delivery-intelligence/rovo-intents.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("visible Rovo intents stay natural language and omit raw JSON", () => {
  assert.equal(ROVO_INTENTS.explain, "Explain this sprint's delivery risks.");
  assert.equal(
    ROVO_INTENTS.recommend,
    "Recommend the highest-priority actions for this sprint.",
  );
  assert.equal(
    ROVO_INTENTS.brief,
    "Generate a concise leadership brief for this sprint.",
  );

  for (const intent of Object.values(ROVO_INTENTS)) {
    assert.equal(isNaturalLanguagePrompt(intent), true);
    assert.doesNotMatch(intent, /FACTS|[{}]|\[|\]/);
  }

  const prompt = buildUserPrompt(
    {
      context: { projectKey: "PLAT" },
      healthScore: 65,
      topAnomalies: [{ title: "Blocked work" }],
    },
    ROVO_INTENTS.explain,
  );
  assert.equal(
    prompt,
    "Explain this sprint's delivery risks. Focus on the current sprint in project PLAT.",
  );
  assert.doesNotMatch(prompt, /FACTS|healthScore|topAnomalies|\{/);
});

test("dashboard and agent prompt keep visible handoff natural-language only", () => {
  const appSource = readFileSync(join(root, "static/dashboard/src/App.jsx"), "utf8");
  const agentPrompt = readFileSync(
    join(root, "resources/agent-prompts/delivery-agent.txt"),
    "utf8",
  );

  assert.match(appSource, /ROVO_INTENTS\.explain/);
  assert.match(appSource, /ROVO_INTENTS\.recommend/);
  assert.match(appSource, /ROVO_INTENTS\.brief/);
  assert.match(appSource, /buildUserPrompt\(snapshot, intent\)/);
  assert.doesNotMatch(appSource, /JSON\.stringify\(snapshot\)/);
  assert.doesNotMatch(appSource, /FACTS/);
  assert.match(agentPrompt, /Call get-sprint-health-snapshot/);
  assert.match(agentPrompt, /Never show JSON, FACTS blocks/);
  assert.match(agentPrompt, /Do not independently recalculate objective metrics/);
});
