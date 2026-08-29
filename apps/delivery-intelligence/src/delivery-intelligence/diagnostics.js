export const STAGES = {
  RESOLVE_PROJECT: "resolve-project-context",
  FETCH_BOARDS: "fetch-boards",
  FETCH_ACTIVE_SPRINT: "fetch-active-sprint",
  FETCH_SPRINT_ISSUES: "fetch-sprint-issues",
  FETCH_CHANGELOG: "fetch-changelog",
  BUILD_SNAPSHOT: "build-health-snapshot",
};

const safeFields = (fields = {}) => ({
  event: fields.event || null,
  stage: fields.stage || null,
  error: fields.error || null,
  httpStatus: fields.httpStatus ?? null,
  projectKey: fields.projectKey || null,
  boardId: fields.boardId ?? null,
  boardName: fields.boardName || null,
  boardType: fields.boardType || null,
  boardCount: fields.boardCount ?? null,
  sprintId: fields.sprintId ?? null,
  issueCount: fields.issueCount ?? null,
  source: fields.source || null,
  startDate: fields.startDate || null,
  activatedDate: fields.activatedDate || null,
  commitmentAt: fields.commitmentAt || null,
  originalCommittedCount: fields.originalCommittedCount ?? null,
  addedIssueCount: fields.addedIssueCount ?? null,
  carryoverCount: fields.carryoverCount ?? null,
});

export const logDiag = (event, fields = {}) => {
  globalThis.console.log(
    `[delivery-intelligence] ${JSON.stringify(safeFields({ event, ...fields }))}`,
  );
};

/** Full JSON for investigation. Do not use for PII-heavy payloads. */
export const logEvidence = (event, payload = {}) => {
  globalThis.console.log(
    `[delivery-intelligence] ${JSON.stringify({ event, ...payload })}`,
  );
};

export const failure = ({
  error,
  stage,
  httpStatus = null,
  projectKey = null,
  boardId = null,
  message = null,
}) => {
  logDiag("failure", { error, stage, httpStatus, projectKey, boardId });
  return {
    ok: false,
    error,
    stage,
    httpStatus,
    projectKey,
    boardId,
    message,
  };
};

export const asFailure = (result, fallbackStage, projectKey = null, boardId = null) => {
  if (result?.ok === false) {
    return {
      ok: false,
      error: result.error || "unavailable",
      stage: result.stage || fallbackStage,
      httpStatus: result.httpStatus ?? null,
      projectKey: result.projectKey || projectKey,
      boardId: result.boardId ?? boardId,
      message: result.message || null,
    };
  }
  return result;
};
