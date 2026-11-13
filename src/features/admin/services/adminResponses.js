// Reading the Admin answers. Every answer is { success, statusCode, message, data }.

// A report answer: data = { rows, message } (message is e.g. "No Records").
export function toReport(data) {
  return { rows: data?.rows ?? [], message: data?.message ?? "" };
}

// A multipart form with the extra fields and the file.
export function buildUploadForm(file, fields = {}) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  form.append("file", file, file.name);
  return form;
}

// Reads an upload answer; a failed upload throws a plain Error with the server's message (shown as a toast by the global MutationCache).
export async function readUpload(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `Upload failed (HTTP ${response.status}).`);
  return body; // { success, statusCode, message, data }
}