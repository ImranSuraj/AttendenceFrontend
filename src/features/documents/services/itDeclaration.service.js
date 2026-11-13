import { triggerBlobDownload } from "@/shared/utils/blobDownload";
import * as controller from "../controllers/itDeclaration.controller";
import { fromApiDeclaration, toApiPayload } from "./itDeclarationRows";

export async function getMyDeclaration() {
  const row = (await controller.getMine()) ?? null;
  const declaration = fromApiDeclaration(row);
  return {
    exists: !!row,
    // No existing declaration yet -> always editable (nothing to lock).
    canEdit: declaration ? declaration.canEdit : true,
    documentName: declaration?.documentName || "",
    declaration,
  };
}

// One endpoint for every dropdown of the form. operation: PERCENTAGE_BASIC (needs regime Old/New) |
// FUND_MANAGERS | INVESTMENT_OPTIONS | LTA_PERCENTAGE. Each item is { label, value }.
export async function getITDeclarationLookup(operation, regime) {
  return (await controller.getLookups(operation, regime)) ?? [];
}

export function submitDeclaration(form) {
  return controller.submit(toApiPayload(form));
}

// Reads a raw file response (PDF or CSV) and hands it to the browser as a download.
async function saveFile(response, fileName) {
  if (!response.ok) {
    let message = `Download failed (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch { /* non-JSON error body: keep the generic message */ }
    throw new Error(message);
  }
  triggerBlobDownload(await response.blob(), fileName);
}

export async function downloadDeclarationPdf() {
  return saveFile(await controller.requestMyPdf(), `ITDeclaration_${Date.now()}.pdf`);
}

// ---- HRAdmin only ----

// The server has one list of every declaration and a PDF per employee.
export async function getAllDeclarations() {
  return ((await controller.getAll()) ?? []).map(fromApiDeclaration);
}

export async function downloadDeclarationPdfFor(employeeCode) {
  return saveFile(await controller.requestPdfFor(employeeCode), `ITDeclaration_${employeeCode}_${Date.now()}.pdf`);
}

// Grant-only: always unlocks editing (there is no revoke).
export function setEditPermission(employeeCode) {
  return controller.setEditPermission(employeeCode);
}

// The server builds the CSV with every column of every declaration.
export async function exportAllDeclarations() {
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const fileName = `ITDeclarations_${stamp}.csv`;
  await saveFile(await controller.requestExport(), fileName);
  return { fileName };
}