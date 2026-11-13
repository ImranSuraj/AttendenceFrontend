import { resolvedBaseUrl, getAuthHeaders } from "@/shared/api/apiClient";

// CalendarUploadController (api/holidays): the multipart upload. It returns the raw fetch Response; the service reads it.
// Real backend upload — routed through raw fetch(), not the shared `api` axios instance, for the
// same reason documentUpload.service.js does: api.js's instance sets a default
// "Content-Type: application/json" header, and axios's own transformRequest JSON-stringifies a
// FormData body instead of sending a real multipart request whenever that header is present (a
// real bug in this app's axios setup, not a style choice — confirmed in node_modules/axios/lib/
// defaults/index.js's isFormData branch). No Content-Type header here — the browser sets the
// multipart boundary itself.

export const upload = (formData) => fetch(`${resolvedBaseUrl}/holidays`, { method: "POST", headers: getAuthHeaders(), body: formData });
