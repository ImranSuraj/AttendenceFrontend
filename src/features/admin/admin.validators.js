import { MAX_DAYS } from "./admin.constants";

const dayCount = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1;

// The message to show under the date range, or "" when it is fine to download. (The server checks the same rules again.)
export function validateLogsRange(fromDate, toDate) {
  return !fromDate || !toDate ? "Choose both dates."
    : toDate < fromDate ? "The end date is before the start date."
    : dayCount(fromDate, toDate) > MAX_DAYS ? `Choose at most ${MAX_DAYS} days at a time.` : "";
}
