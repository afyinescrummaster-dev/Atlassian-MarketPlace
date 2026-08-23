const asDate = (value) => {
  if (typeof value !== "string" || value.length < 10) {
    return null;
  }

  return value.slice(0, 10);
};

const adfToPlain = (node) => {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (typeof node.text === "string" && node.text.trim()) {
    return node.text.trim();
  }

  if (Array.isArray(node.content)) {
    const text = node.content.map(adfToPlain).filter(Boolean).join(" ");
    return text || null;
  }

  return null;
};

export const extractScalar = (raw) => {
  if (raw == null) {
    return null;
  }

  if (typeof raw === "string") {
    const text = raw.trim();
    return text.length > 0 ? text : null;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === "boolean") {
    return raw;
  }

  if (Array.isArray(raw)) {
    const parts = raw.map(extractScalar).filter((value) => value != null && value !== "");
    return parts.length > 0 ? parts.join(", ") : null;
  }

  if (typeof raw !== "object") {
    return null;
  }

  if (typeof raw.displayName === "string") {
    return raw.displayName;
  }

  if (typeof raw.name === "string") {
    return raw.name;
  }

  if (typeof raw.value === "string" || typeof raw.value === "number") {
    return raw.value;
  }

  if (typeof raw.key === "string") {
    return raw.key;
  }

  if (raw.type === "doc") {
    return adfToPlain(raw);
  }

  return null;
};

export const extractDate = (raw) => {
  if (typeof raw === "string") {
    return asDate(raw);
  }

  const scalar = extractScalar(raw);
  return typeof scalar === "string" ? asDate(scalar) : null;
};

export const extractNumber = (raw) => {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  const scalar = extractScalar(raw);
  if (typeof scalar === "number") {
    return scalar;
  }

  if (typeof scalar === "string" && scalar.trim()) {
    const parsed = Number(scalar);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const matchesConfiguredValue = (raw, configuredValues) => {
  const scalar = extractScalar(raw);
  if (scalar == null) {
    return false;
  }

  if (raw === true || scalar === true) {
    return true;
  }

  const text = String(scalar).trim().toLowerCase();
  const configured = (configuredValues ?? [])
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);

  if (configured.length === 0) {
    return ["yes", "true", "blocked", "y"].includes(text);
  }

  return configured.includes(text);
};

export const readIssueField = (issue, fieldId) => {
  if (!fieldId) {
    return undefined;
  }

  if (fieldId === "key") {
    return issue?.key;
  }

  return issue?.fields?.[fieldId];
};

export const mappedFieldId = (mapping, conceptId) =>
  mapping?.fields?.[conceptId]?.id || null;
