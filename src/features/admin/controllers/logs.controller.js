import { resolvedBaseUrl, getAuthHeaders } from "@/shared/api/apiClient";

// LogsController (api/admin/logs): the daily log files as one zip. It returns the raw fetch Response; the service reads it.
// A plain fetch (the file is a binary download, like the documents): the same sign-in header as every other call.
export const download = (query) => fetch(`${resolvedBaseUrl}/admin/logs?${query}`, { headers: getAuthHeaders(), cache: "no-store" });
