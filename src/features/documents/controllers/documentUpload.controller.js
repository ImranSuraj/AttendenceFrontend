import { resolvedBaseUrl, getAuthHeaders } from "@/shared/api/apiClient";

// DocumentUploadController (api/documents, POST): the raw streamed response, read by the service.
// No Content-Type header: the browser sets the multipart boundary itself.
export const uploadBatch = (formData) =>
  fetch(`${resolvedBaseUrl}/documents`, { method: "POST", headers: getAuthHeaders(), body: formData });