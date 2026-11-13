// Thrown errors are plain Error objects with a real `.message` — this function is only ever
// called through useHolidaysMutations()'s useMutation, so TanStack Query's global MutationCache
// (queryClient.js) already funnels the failure through the central error handler; no local
// try/catch/toast needed here or at the call site.
import * as controller from "../controllers/calendarUpload.controller";

export async function bulkUploadHolidays(file) {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const response = await controller.upload(formData);

  if (!response.ok) {
    let message = `Bulk upload failed (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch { /* non-JSON error body — keep the generic message */ }
    throw new Error(message);
  }

  const body = await response.json().catch(() => null);
  return body?.data ?? body;
}
