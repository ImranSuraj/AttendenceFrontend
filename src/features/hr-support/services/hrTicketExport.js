import { toDisplayFileName } from "@/shared/utils/fileDisplayName";
import { toTicket } from "./hrTicketRows";

export function toCsvValue(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const EXPORT_COLUMNS = [
  ["ticketNo", "Ticket #"], ["createdDate", "Created Date"],
  ["employeeId", "Employee ID"], ["employeeName", "Employee Name"],
  ["category", "Category"], ["subCategory", "Sub Category"], ["description", "Description"],
  ["attachmentName", "Attachment"], ["priority", "Priority"],
  // Category-specific fields, one column each (not merged into one text blob) -- "Count" and
  // "Floor" are ambiguous labels shared across categories (Lunch/Repair both have a Count; Repair/
  // Stationery both have a Floor), so each is only ever populated for ITS OWN category's rows.
  ["lunchFromDate", "Lunch From Date"], ["lunchToDate", "Lunch To Date"],
  ["lunchRequest", "Lunch Request"], ["lunchCount", "Lunch Count"],
  ["repairItem", "Repair Item"], ["repairCount", "Repair Count"], ["repairFloor", "Repair Floor"],
  ["stationaryCategory", "Stationary Category"], ["stationaryItem", "Stationary Item"],
  ["stationaryItemDescription", "Stationary Item Description"], ["stationaryQuantity", "Stationary Quantity"],
  ["stationaryUnit", "Stationary Unit"], ["stationaryDepartment", "Stationary Department"],
  ["stationaryFloor", "Stationary Floor"], ["bloodGroup", "Blood Group"],
  ["logStatus", "Current Status"], ["logUpdatedBy", "Updated By"],
  ["logUpdatedDate", "Updated Date"], ["logAdminRemarks", "Remarks"],
];

export function categoryDetailValue(ticket, label) {
  return ticket.categoryDetails.find(d => d.label === label)?.value || "";
}

// dd/mm/yyyy HH:mm -- raw ISO timestamps (e.g. "2026-09-29T17:20:55.573") are not something HR
// wants to read in a spreadsheet.
export function formatExportDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// One export row per (ticket, status change): the ticket fields next to that status change's own fields.
export function toExportRow(row) {
  const ticket = toTicket(row.ticket);
  const log = row.log || {};
  const isLunch = ticket.category === "Visitor Lunch";
  const isRepair = ticket.category === "Repair and Maintenance";
  const isStationary = ticket.category === "Stationery";
  const isIdCard = ticket.category === "Access Request/ID Card";
  return {
    ...ticket,
    // Display-only names in the export -- never the raw on-disk "_<8-digit-random>" values.
    attachmentName: ticket.attachmentName.split(",").filter(Boolean).map(toDisplayFileName).join(", "),
    createdDate: formatExportDateTime(ticket.createdDate),
    lunchFromDate: isLunch ? categoryDetailValue(ticket, "From Date") : "",
    lunchToDate: isLunch ? categoryDetailValue(ticket, "To Date") : "",
    lunchRequest: isLunch ? categoryDetailValue(ticket, "Lunch Request") : "",
    lunchCount: isLunch ? categoryDetailValue(ticket, "Count") : "",
    repairItem: isRepair ? categoryDetailValue(ticket, "Repair Item") : "",
    repairCount: isRepair ? categoryDetailValue(ticket, "Count") : "",
    repairFloor: isRepair ? categoryDetailValue(ticket, "Floor") : "",
    stationaryCategory: isStationary ? categoryDetailValue(ticket, "Stationary Category") : "",
    stationaryItem: isStationary ? categoryDetailValue(ticket, "Stationary Item") : "",
    stationaryItemDescription: isStationary ? categoryDetailValue(ticket, "Item Description") : "",
    stationaryQuantity: isStationary ? categoryDetailValue(ticket, "Quantity") : "",
    stationaryUnit: isStationary ? categoryDetailValue(ticket, "Unit") : "",
    stationaryDepartment: isStationary ? categoryDetailValue(ticket, "Department") : "",
    stationaryFloor: isStationary ? categoryDetailValue(ticket, "Floor") : "",
    bloodGroup: isIdCard ? categoryDetailValue(ticket, "Blood Group") : "",
    logStatus: log.status || "",
    // "ID - Name" in one column, e.g. "3661 - Imran Yousuf".
    logUpdatedBy: log.updatedBy ? `${log.updatedBy} - ${log.updatedByName || ""}`.trim() : "",
    logUpdatedDate: formatExportDateTime(log.updatedDate),
    logAdminRemarks: log.adminRemarks || "",
  };
}
