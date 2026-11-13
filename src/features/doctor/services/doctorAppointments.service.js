import { triggerBlobDownload } from "@/shared/utils/blobDownload";
import * as controller from "../controllers/doctorAppointments.controller";
import { EMPTY_BOOKING_CONTEXT, minutesToLabel, toAppointmentRow, toSlot } from "./doctorRows";

export async function getBookingContext() {
  const d = await controller.getBookingContext();
  if (!d) return EMPTY_BOOKING_CONTEXT;
  return {
    employeeNo: d.employeeNo ?? d.empNo ?? "",
    employeeName: d.employeeName ?? d.empName ?? "",
    age: d.age ?? "",
    gender: d.gender ?? "",
    department: d.department ?? "",
    clinicDates: d.clinicDates || [],
    slots: (d.slots || []).map(toSlot),
  };
}

// The backend returns the full slot template with an isAvailable flag; only open slots are kept.
export async function getAvailableSlots(date) {
  return ((await controller.getSlots(date)) ?? []).map(toSlot).filter((s) => s.isAvailable);
}

export async function getMyAppointments() {
  return ((await controller.getMyAppointments()) ?? []).map(toAppointmentRow);
}

export async function bookAppointment({ date, start }) {
  return toAppointmentRow(await controller.bookAppointment({ bookingDate: date, startMinutes: start }));
}

export async function cancelAppointment(id) {
  return (await controller.cancelAppointment(id)) ?? { id, status: "Cancelled" };
}

// HRAdmin only (also enforced by the server): flips a booked appointment to "Attended".
export async function markAttended(id) {
  return (await controller.markAttended(id)) ?? { id, status: "Attended" };
}

export async function getAppointmentReport({ fromDate, toDate, attendedStatus }) {
  return ((await controller.getReport({ fromDate, toDate, attendedStatus })) ?? []).map(toAppointmentRow);
}

function toCsvValue(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// The CSV is built here from the report rows (no separate export endpoint).
export async function exportAppointmentReport({ fromDate, toDate, attendedStatus }) {
  const rows = await getAppointmentReport({ fromDate, toDate, attendedStatus });
  if (!rows.length) throw new Error("No appointments found for the selected filters.");
  const columns = ["employeeNumber", "employeeName", "department", "date", "start", "end", "status", "attended"];
  const csv = [
    columns.join(","),
    ...rows.map((r) => columns.map((c) => toCsvValue(c === "start" || c === "end" ? minutesToLabel(r[c]) : r[c])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const fileName = `DoctorAppointments_${fromDate}_to_${toDate}.csv`;
  triggerBlobDownload(blob, fileName);
  return { fileName, rowCount: rows.length };
}