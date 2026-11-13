import { resolvedBaseUrl, getAuthHeaders } from "@/shared/api/apiClient";

// DocumentDownloadController (api/documents, GET): the raw streamed response, read by the service.
export const requestDocument = (query) =>
  fetch(`${resolvedBaseUrl}/documents?${query}`, { headers: getAuthHeaders() });