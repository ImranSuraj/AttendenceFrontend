// Real SFTP batch document upload (HR-only), replacing Employees's previous simulated
// "Bulk Upload Documents". The batch upload
// uses raw fetch() so the response body can be read as an incremental stream of NDJSON progress
// lines (same event shape the legacy SftpBatchUpload.ashx streamed) — axios doesn't expose
// per-chunk reads of a streaming response body the way fetch's ReadableStream does.
import * as controller from "../controllers/documentUpload.controller";

export async function uploadDocumentsBatch({ program, selectedYear, files }, onEvent) {
  const formData = new FormData();
  formData.append("program", program);
  formData.append("selectedYear", selectedYear || "");
  files.forEach(f => formData.append("files", f, f.name));

  const response = await controller.uploadBatch(formData);

  if (!response.ok || !response.body) {
    throw new Error(`Upload failed (HTTP ${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try { onEvent(JSON.parse(trimmed)); } catch { /* malformed line — skip */ }
    }
  }

  if (buffer.trim()) {
    try { onEvent(JSON.parse(buffer.trim())); } catch { /* malformed line — skip */ }
  }
}
