import { resolvedBaseUrl, getAuthHeaders } from "@/shared/api/apiClient";

// Multipart upload for the Admin upload screens. fetch() is used, not the shared axios instance: its
// default JSON Content-Type would turn a FormData body into JSON. Returns the raw response.
export const postForm = (path, form) =>
  fetch(`${resolvedBaseUrl}${path}`, { method: "POST", headers: getAuthHeaders(), body: form });