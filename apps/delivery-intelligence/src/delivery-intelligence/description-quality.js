import {
  AC_DETECTION,
  DESCRIPTION_PLACEHOLDERS,
  WEAK_DESCRIPTION_WORD_THRESHOLD,
} from "./thresholds.js";

const WORD_RE = /[A-Za-z0-9][A-Za-z0-9'_-]*/g;

/**
 * Safely flatten Atlassian Document Format (or plain string) to readable text.
 * Ignores empty paragraphs, whitespace-only nodes, and formatting-only markup.
 */
export const extractPlainTextFromDescription = (description) => {
  if (description == null) {
    return "";
  }
  if (typeof description === "string") {
    return description.replace(/\s+/g, " ").trim();
  }
  if (typeof description !== "object") {
    return "";
  }

  const parts = [];

  const walk = (node) => {
    if (node == null) {
      return;
    }
    if (typeof node === "string") {
      const trimmed = node.trim();
      if (trimmed) {
        parts.push(trimmed);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") {
      return;
    }
    if (typeof node.text === "string" && node.text.trim()) {
      parts.push(node.text.trim());
    }
    if (node.type === "hardBreak" || node.type === "rule") {
      parts.push(" ");
      return;
    }
    if (Array.isArray(node.content)) {
      walk(node.content);
    }
  };

  walk(description);
  return parts.join(" ").replace(/\s+/g, " ").trim();
};

export const countMeaningfulWords = (text) => {
  if (!text) {
    return 0;
  }
  const matches = String(text).match(WORD_RE);
  return matches ? matches.length : 0;
};

const normalizeForCompare = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isPlaceholderOnly = (text) => {
  const normalized = normalizeForCompare(text);
  if (!normalized) {
    return false;
  }
  return DESCRIPTION_PLACEHOLDERS.some(
    (phrase) =>
      normalized === phrase ||
      normalized === `${phrase}.` ||
      normalized === `${phrase}!`,
  );
};

const substantiallyRepeatsSummary = (text, summary) => {
  const descriptionNorm = normalizeForCompare(text);
  const summaryNorm = normalizeForCompare(summary);
  if (!descriptionNorm || !summaryNorm) {
    return false;
  }
  if (descriptionNorm === summaryNorm) {
    return true;
  }
  if (
    descriptionNorm.length <= summaryNorm.length + 8 &&
    (descriptionNorm.includes(summaryNorm) || summaryNorm.includes(descriptionNorm))
  ) {
    return true;
  }
  return false;
};

/**
 * Evaluate description presence and quality. Never claims a short description
 * is automatically poor — findings use careful language upstream.
 */
export const evaluateDescriptionQuality = ({
  description,
  summary = "",
  wordThreshold = WEAK_DESCRIPTION_WORD_THRESHOLD,
} = {}) => {
  const plainText = extractPlainTextFromDescription(description);
  const wordCount = countMeaningfulWords(plainText);

  if (!plainText) {
    return {
      state: "missing",
      plainText: "",
      wordCount: 0,
      reasons: ["empty"],
      capability: { status: "available", reason: null },
    };
  }

  const reasons = [];
  if (wordCount < wordThreshold) {
    reasons.push("short");
  }
  if (isPlaceholderOnly(plainText)) {
    reasons.push("placeholder");
  }
  if (substantiallyRepeatsSummary(plainText, summary)) {
    reasons.push("repeats_summary");
  }

  if (reasons.length === 0) {
    return {
      state: "sufficient",
      plainText,
      wordCount,
      reasons: [],
      capability: { status: "available", reason: null },
    };
  }

  return {
    state: "weak",
    plainText,
    wordCount,
    reasons,
    capability: { status: "available", reason: null },
  };
};

const AC_HEADING_RE =
  /^\s*(acceptance\s*criteria|acceptance\s*criterion|ac|definition\s*of\s*done|dod)\b/i;
const GIVEN_WHEN_THEN_RE =
  /\b(given)\b[\s\S]{0,200}\b(when)\b[\s\S]{0,200}\b(then)\b/i;
const CHECKLIST_LINE_RE = /^\s*(?:[-*•]|\[[ xX]\]|\d+[.)])\s+\S+/m;

const headingLooksLikeAc = (text) => AC_HEADING_RE.test(String(text || "").trim());

const extractHeadingsFromAdf = (description) => {
  const headings = [];
  if (!description || typeof description !== "object") {
    return headings;
  }
  const walk = (node) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.type === "heading") {
      const text = extractPlainTextFromDescription(node);
      if (text) {
        headings.push(text);
      }
    }
    if (Array.isArray(node.content)) {
      walk(node.content);
    }
  };
  walk(description);
  return headings;
};

const textHasAcPatterns = (plainText) => {
  if (!plainText) {
    return false;
  }
  if (GIVEN_WHEN_THEN_RE.test(plainText)) {
    return true;
  }
  const lines = plainText.split(/\n+/);
  for (let i = 0; i < lines.length; i += 1) {
    if (headingLooksLikeAc(lines[i])) {
      const following = lines.slice(i + 1, i + 8).join("\n");
      if (CHECKLIST_LINE_RE.test(following) || countMeaningfulWords(following) >= 3) {
        return true;
      }
      return true;
    }
  }
  if (/\bacceptance\s+criteria\b/i.test(plainText) && CHECKLIST_LINE_RE.test(plainText)) {
    return true;
  }
  return false;
};

const customFieldLooksLikeAc = (name) => {
  const normalized = String(name || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
  return (
    normalized.includes("acceptance criteria") ||
    normalized === "acceptance criterion" ||
    normalized === "ac" ||
    normalized.endsWith(" ac")
  );
};

const customFieldHasContent = (value) => {
  if (value == null) {
    return false;
  }
  if (typeof value === "string") {
    return extractPlainTextFromDescription(value).length > 0;
  }
  if (typeof value === "object") {
    return extractPlainTextFromDescription(value).length > 0;
  }
  return Boolean(String(value).trim());
};

/**
 * Detect acceptance criteria from available evidence without claiming certainty
 * that criteria are missing when storage location is unknown.
 *
 * @param {object} options
 * @param {*} options.description - ADF or string
 * @param {object} [options.customFields] - map of fieldId → { name, value }
 * @param {string|null} [options.configuredFieldId] - optional future config hook
 */
export const detectAcceptanceCriteria = ({
  description = null,
  customFields = null,
  configuredFieldId = null,
  descriptionAvailable = true,
} = {}) => {
  if (!descriptionAvailable && !customFields && !configuredFieldId) {
    return {
      state: AC_DETECTION.UNAVAILABLE,
      evidence: null,
      confidence: "low",
      limitation:
        "Acceptance criteria storage could not be inspected for this issue.",
    };
  }

  if (configuredFieldId && customFields?.[configuredFieldId]) {
    const field = customFields[configuredFieldId];
    if (customFieldHasContent(field?.value ?? field)) {
      return {
        state: AC_DETECTION.DETECTED,
        evidence: "configured_custom_field",
        confidence: "high",
        limitation: null,
      };
    }
  }

  if (customFields && typeof customFields === "object") {
    for (const [fieldId, field] of Object.entries(customFields)) {
      const name = field?.name || fieldId;
      if (!customFieldLooksLikeAc(name)) {
        continue;
      }
      if (customFieldHasContent(field?.value ?? field)) {
        return {
          state: AC_DETECTION.DETECTED,
          evidence: "named_custom_field",
          confidence: "high",
          limitation: null,
          fieldId,
          fieldName: name,
        };
      }
    }
  }

  const headings = extractHeadingsFromAdf(description);
  if (headings.some(headingLooksLikeAc)) {
    return {
      state: AC_DETECTION.DETECTED,
      evidence: "description_heading",
      confidence: "medium",
      limitation: null,
    };
  }

  const plainText = extractPlainTextFromDescription(description);
  if (textHasAcPatterns(plainText)) {
    return {
      state: AC_DETECTION.DETECTED,
      evidence: GIVEN_WHEN_THEN_RE.test(plainText)
        ? "given_when_then"
        : "description_pattern",
      confidence: "medium",
      limitation: null,
    };
  }

  return {
    state: AC_DETECTION.NOT_DETECTED,
    evidence: null,
    confidence: "medium",
    limitation:
      "No acceptance criteria were detected in the description or recognized custom fields. Criteria may still exist elsewhere.",
  };
};
