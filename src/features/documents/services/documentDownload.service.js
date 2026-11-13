// Real SFTP-streamed document download (Payslip/Letters/Mediclaim/Form16), replacing the
// Documents tab's previous simulated download. Uses raw fetch() + the native ReadableStream API
// rather than axios — this is the browser-native "good library for streaming" for exactly this
// job (incremental byte progress as the response body arrives), which axios doesn't expose
// cleanly for a Blob response. Mirrors the legacy StreamDownload.ashx page's own client-side
// approach (also plain fetch + getReader()).
import * as controller from "../controllers/documentDownload.controller";
import { handleError } from "@/shared/errors/errorHandler";
import { triggerBlobDownload } from "@/shared/utils/blobDownload";

// onProgress receives { receivedBytes, totalBytes | null, percent | null }.
export async function downloadEmployeeDocument({ docType, month, form16Type, form16Year }, onProgress) {
  const query = new URLSearchParams({ docType });
  if (month) query.set("month", month);
  if (form16Type) query.set("form16Type", form16Type);
  if (form16Year) query.set("form16Year", form16Year);
  const response = await controller.requestDocument(query);

  if (!response.ok || !response.body) {
    let message = `Download failed (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch { /* non-JSON error body — keep the generic message */ }
    const error = new Error(message);
    handleError(error, "documents");
    throw error;
  }

  const totalBytes = Number(response.headers.get("Content-Length")) || null;
  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedBytes += value.byteLength;
    onProgress?.({
      receivedBytes,
      totalBytes,
      percent: totalBytes ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100)) : null,
    });
  }

  const blob = new Blob(chunks, { type: "application/pdf" });
  // "do not expose the file name" — a randomized name, never the real internal fileName pattern
  // (empno + month/year codes) the backend deliberately also keeps generic in Content-Disposition.
  triggerBlobDownload(blob, `document_${crypto.randomUUID()}.pdf`);
}
