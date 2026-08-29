export const ROVO_INTENTS = {
  explain: "Explain this sprint's delivery risks.",
  recommend: "Recommend the highest-priority actions for this sprint.",
  brief: "Generate a concise leadership brief for this sprint.",
};

const UNSAFE_PROMPT = /[{}]|\[|\]|FACTS|action schema|payload/i;

export const isNaturalLanguagePrompt = (value) =>
  typeof value === "string" && value.trim().length > 0 && !UNSAFE_PROMPT.test(value);

export const buildUserPrompt = (snapshot, intent) => {
  const projectKey = snapshot?.context?.projectKey;
  if (!projectKey) {
    return intent;
  }

  return `${intent} Focus on the current sprint in project ${projectKey}.`;
};
