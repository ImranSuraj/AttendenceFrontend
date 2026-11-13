import { triggerBlobDownload } from "@/shared/utils/blobDownload";
import * as controller from "../controllers/hrTickets.controller";
import { toTicket } from "./hrTicketRows";
import { EXPORT_COLUMNS, toCsvValue, toExportRow } from "./hrTicketExport";

export async function getMasterData() {
  return (await controller.getMasterData()) ?? {};
}

const scopeParams = ({ allEmployees, assignedToMe, status, categoryId } = {}) => ({
  allEmployees: !!allEmployees,
  assignedToMe: !!assignedToMe,
  status: status || undefined,
  categoryId: categoryId ?? undefined,
});

// Two scopes: `allEmployees` (HR admin sees every ticket) or the caller's own tickets (resolved by the server).
export async function getTickets(filters = {}) {
  return ((await controller.getTickets(scopeParams(filters))) ?? []).map(toTicket);
}

export function createTicket(payload) {
  return controller.createTicket(payload);
}

export async function updateTicketStatus({ ticketNo, newStatus, adminRemarks }) {
  await controller.updateStatus(ticketNo, { newStatus, adminRemarks: adminRemarks || null });
  return { ticketNo, newStatus, adminRemarks };
}

// Reads the { success, message, data } body of a file upload; fails with the server's message.
async function readUploadBody(response, failure) {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || `${failure} (HTTP ${response.status}).`);
  }
  return body.data;
}

// One jpg (<= 512 KB, also checked by the server) for an Access Request / ID Card ticket.
// Returns { fileName }, to pass into createTicket as idCardImagePath.
export async function uploadIdCardImage(file) {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return readUploadBody(await controller.uploadIdCardImage(formData), "Image upload failed");
}

// The general "Attach File" field of every ticket category. Returns the stored file names (string[]).
export async function uploadTicketAttachments(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file, file.name));
  const data = await readUploadBody(await controller.uploadAttachments(formData), "Attachment upload failed");
  return data.fileNames;
}

// The server returns the single file itself, or a ZIP when the ticket has several.
export async function downloadTicketAttachments(fileNames) {
  const query = new URLSearchParams();
  fileNames.forEach((name) => query.append("fileNames", name));
  const response = await controller.requestAttachments(query);
  if (!response.ok) {
    let message = `Failed to load attachment (HTTP ${response.status}).`;
    try { const body = await response.json(); message = body?.message || message; } catch { /* non-JSON error body */ }
    throw new Error(message);
  }
  return response.blob();
}

// HR admin CSV: one row per (ticket, status change).
export async function exportTickets(filters = {}) {
  const rows = ((await controller.getExport(scopeParams(filters))) ?? []).map(toExportRow);
  if (!rows.length) throw new Error("No tickets found to export.");
  const csv = [
    EXPORT_COLUMNS.map(([, label]) => toCsvValue(label)).join(","),
    ...rows.map((r) => EXPORT_COLUMNS.map(([key]) => toCsvValue(r[key])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const fileName = `HR Support-Tickets_${new Date().toISOString().slice(0, 10)}.csv`;
  triggerBlobDownload(blob, fileName);
  return { fileName, rowCount: rows.length };
}