/**
 * Pure helpers for Delivery Intelligence → Rovo handoff UX.
 * Keep every entry point either opening Rovo or returning a clear user-facing note.
 */

export const ROVO_UNAVAILABLE_NOTE =
  "Atlassian Rovo is not enabled on this site. Deterministic sprint intelligence below still works.";

export const ROVO_OPEN_FAILED_NOTE =
  "Could not open the Delivery Intelligence agent. Check that Rovo is enabled and this app is installed.";

export const ROVO_NO_SPRINT_NOTE =
  "Sprint data is not ready yet. Refresh the page, then try Rovo again.";

export const ROVO_CHECKING_NOTE =
  "Checking whether Rovo is available on this site…";

/**
 * Decide whether a Rovo open attempt should proceed and what message to show.
 * @param {{ snapshot: object|null, rovoEnabled: boolean|null, hasPrompt?: boolean }} input
 * @returns {{ proceed: boolean, message: string|null }}
 */
export const resolveRovoHandoff = ({
  snapshot = null,
  rovoEnabled = null,
  hasPrompt = true,
} = {}) => {
  if (!snapshot?.sprint) {
    return { proceed: false, message: ROVO_NO_SPRINT_NOTE };
  }
  if (!hasPrompt) {
    return {
      proceed: false,
      message: "Nothing is ready to send to Rovo yet. Generate or select content first.",
    };
  }
  if (rovoEnabled === false) {
    return { proceed: false, message: ROVO_UNAVAILABLE_NOTE };
  }
  if (rovoEnabled === null) {
    // Availability still resolving — attempt open; bridge may succeed or throw.
    return { proceed: true, message: null };
  }
  return { proceed: true, message: null };
};
