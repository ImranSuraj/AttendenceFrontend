import * as controller from "../controllers/logs.controller";

// Asks the server for the log zip of a date range. Returns { blob, fileName }, or { error } with the server's own message when it refuses.
export async function downloadLogs({ fromDate, toDate, kind }) {
  const query = new URLSearchParams({ fromDate, toDate, type: kind });
  const response = await controller.download(query);
  if (!response.ok) {
    let message = `Download failed (HTTP ${response.status}).`;
    try { message = (await response.json())?.message || message; } catch { /* not a JSON answer: keep the generic message */ }
    return { error: message };
  }
  return { blob: await response.blob(), fileName: `employee-connect-logs_${fromDate.replaceAll("-", "")}_${toDate.replaceAll("-", "")}.zip` };
}
