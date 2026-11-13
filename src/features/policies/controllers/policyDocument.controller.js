import { resolvedBaseUrl, getAuthHeaders } from "@/shared/api/apiClient";

// PolicyDocumentController (api/policies/documents): the file upload and download. They return the raw fetch Response; the service reads it.
// Raw fetch (not axios): the upload body is FormData, and axios's default JSON Content-Type header breaks multipart encoding.
export const upload = (formData) => fetch(`${resolvedBaseUrl}/policies/documents`, { method: "POST", headers: getAuthHeaders(), body: formData });
export const download = (query) => fetch(`${resolvedBaseUrl}/policies/documents?${query}`, { headers: getAuthHeaders() });
