import * as controller from "../controllers/policyDocument.controller";

// Real local-disk upload (AMSBackendAPI's Features/Policies -- mirrors HR Support's ID-card-image
// upload pattern) for the "Policy Document Upload" field's actual file bytes -- up to
// MAX_FILE_COUNT files per call (see shared/utils/fileValidation.js), so this always takes an
// array, even for a single file (Add later creates one PolicyMaster row per uploaded file). Raw
// fetch (not axios), same reasoning as documentUpload.service.js/servicedesk.service.js's own
// uploads: the request body is FormData, and axios's default JSON Content-Type header breaks
// multipart encoding.
export async function uploadPolicyDocument(files) {
  const formData = new FormData();
  files.forEach(file => formData.append("files", file, file.name));

  const response = await controller.upload(formData);
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || `Document upload failed (HTTP ${response.status}).`);
  }
  return body.data.fileNames; // string[]
}

// Streams a single policy attachment back as a Blob, for a real click-to-download -- fileName is
// one on-disk name from the policy record ("{original-base-name}_{8-digit-random}.ext"), passed
// straight back to the server as-is. No ZIP-bundling -- a policy row with several attachments is
// only ever downloaded one file at a time (see PoliciesPage.jsx's downloadPolicy).
export async function downloadPolicyDocument(fileName) {
  const response = await controller.download(new URLSearchParams({ fileName }));
  if (!response.ok) {
    let message = `Failed to load document (HTTP ${response.status}).`;
    try { const body = await response.json(); message = body?.message || message; } catch { /* non-JSON error body */ }
    throw new Error(message);
  }
  return response.blob();
}
