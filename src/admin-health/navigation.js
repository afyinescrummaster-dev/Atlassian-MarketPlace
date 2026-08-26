/**
 * Centralized Jira Cloud navigation helpers for Jira Admin Health.
 *
 * Only emit links that are documented / widely reliable on Jira Cloud.
 *
 * Supported:
 * - Open project → `{siteUrl}/jira/projects/{key}`
 * - Open project settings → Forge NavigationTarget `projectSettingsDetails`
 *   (string URL fallback also provided for docs/tests)
 * - Open custom fields admin → `{siteUrl}/jira/settings/issues/custom-fields`
 * - Review field → classic ConfigureCustomField JSP with numeric id
 *
 * Not supported / do not fake:
 * - Unstable next-gen-only field configuration URLs
 * - Workflow / scheme / screen admin deep links (out of MVP scope)
 */

const trimSite = (siteUrl) => {
  if (typeof siteUrl !== "string" || !siteUrl.trim()) {
    return null;
  }
  return siteUrl.replace(/\/$/, "");
};

/** Extract numeric custom field id from `customfield_10004` → `10004`. */
export const numericCustomFieldId = (fieldId) => {
  if (typeof fieldId !== "string") {
    return null;
  }
  const match = /^customfield_(\d+)$/i.exec(fieldId.trim());
  return match ? match[1] : null;
};

export const projectBrowseUrl = (siteUrl, projectKey) => {
  const base = trimSite(siteUrl);
  if (!base || !projectKey) {
    return null;
  }
  return `${base}/jira/projects/${encodeURIComponent(projectKey)}`;
};

/**
 * Forge router NavigationLocation for project settings.
 * Use with `router.open(location)` from @forge/bridge.
 */
export const projectSettingsLocation = (projectKey) => {
  if (!projectKey) {
    return null;
  }
  return {
    target: "projectSettingsDetails",
    projectKey: String(projectKey),
  };
};

/** Best-effort string fallback (software-shaped path; may vary by project type). */
export const projectSettingsUrl = (siteUrl, projectKey) => {
  const base = trimSite(siteUrl);
  if (!base || !projectKey) {
    return null;
  }
  return `${base}/jira/software/projects/${encodeURIComponent(projectKey)}/settings`;
};

export const customFieldsAdminUrl = (siteUrl) => {
  const base = trimSite(siteUrl);
  if (!base) {
    return null;
  }
  return `${base}/jira/settings/issues/custom-fields`;
};

export const customFieldConfigureUrl = (siteUrl, fieldId) => {
  const base = trimSite(siteUrl);
  const numericId = numericCustomFieldId(fieldId);
  if (!base || !numericId) {
    return null;
  }
  return `${base}/secure/admin/ConfigureCustomField!default.jspa?customFieldId=${numericId}`;
};

export const SUPPORTED_DEEP_LINKS = [
  {
    id: "project",
    label: "Open project",
    pattern: "/jira/projects/{key}",
    reliable: true,
  },
  {
    id: "project-settings",
    label: "Open project settings",
    pattern: "NavigationTarget.projectSettingsDetails",
    reliable: true,
  },
  {
    id: "custom-fields-admin",
    label: "Open custom fields",
    pattern: "/jira/settings/issues/custom-fields",
    reliable: true,
  },
  {
    id: "custom-field-configure",
    label: "Review field",
    pattern:
      "/secure/admin/ConfigureCustomField!default.jspa?customFieldId={n}",
    reliable: true,
    notes: "Requires classic customfield_NNNNN id.",
  },
];
