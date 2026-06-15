export function cleanText(value, maxLength, fallback = "") {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>`]/g, "")
    .trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLength);
}

export function cleanSecret(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 4096);
}

export function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function splitList(value, maxItems = 12) {
  return cleanText(value, 500, "")
    .split(",")
    .map((item) => cleanText(item, 80, ""))
    .filter(Boolean)
    .slice(0, maxItems);
}
