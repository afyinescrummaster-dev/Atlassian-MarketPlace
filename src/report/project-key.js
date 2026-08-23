export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,29}$/;

export const isValidProjectKey = (value) =>
  typeof value === "string" && PROJECT_KEY_PATTERN.test(value);

const readKey = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const key = value.trim().toUpperCase();
  return key.length > 0 ? key : null;
};

export const getProjectKeyFromContext = (context) =>
  readKey(context?.extension?.project?.key) ||
  readKey(context?.extension?.projectKey) ||
  readKey(context?.project?.key) ||
  readKey(context?.projectKey) ||
  null;

export const buildProjectJql = (projectKey) =>
  `project = "${projectKey}" ORDER BY updated DESC`;
