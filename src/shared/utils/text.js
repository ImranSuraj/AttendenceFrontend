// Some real backend fields (legacy DB columns, or raw status/type codes with no confirmed
// description) can come back concatenated with no spaces (e.g. "CasualLeave") or as a raw code.
// This inserts spaces at word boundaries so the UI reads as "Casual Leave" instead of the raw
// concatenated form. A no-op on strings that already have proper spacing.
function humanize(value) {
  if (typeof value !== "string" || !value) return value;
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

// Title Case for display — applied to categorical/code-like values (status, leave type,
// designation, department, location, grade), never to free-text remarks/descriptions/reasons or
// names/emails, which are handled separately (kept as-is, or lowercased for email).
// Multi-letter ALL-CAPS tokens are preserved as-is (e.g. "HR", "PF", "INFT") since they're likely
// intentional abbreviations/codes, not a casing accident to fix.
export function titleCase(value) {
  if (typeof value !== "string" || !value) return value;
  return humanize(value)
    .split(/(\s|-)/)
    .map(part => {
      if (part === " " || part === "-" || !part) return part;
      if (part === part.toUpperCase() && part.length > 1) return part;
      return part[0].toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}
