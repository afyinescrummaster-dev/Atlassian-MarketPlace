import {
  ADMIN_HEALTH_SETTINGS_KEY,
  INACTIVE_DAYS,
  INACTIVITY_THRESHOLD_OPTIONS,
} from "./constants.js";

export const normalizeInactiveDays = (value) => {
  const numeric = Number(value);
  if (INACTIVITY_THRESHOLD_OPTIONS.includes(numeric)) {
    return numeric;
  }
  return INACTIVE_DAYS;
};

export const sanitizeSettings = (raw) => ({
  inactiveDays: normalizeInactiveDays(raw?.inactiveDays),
});

export { ADMIN_HEALTH_SETTINGS_KEY };
