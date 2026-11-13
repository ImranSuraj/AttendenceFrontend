// Shapes the doctor-appointment answers for the screens (the one place to adjust field names).
export function minutesToLabel(totalMinutes) {
  const n = Number(totalMinutes);
  if (!Number.isFinite(n)) return "";
  const hh = Math.floor(n / 60);
  const mm = n % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function toSlot(s) {
  const start = Number(s.start ?? s.startMinutes);
  const end = Number(s.end ?? s.endMinutes);
  return { start, end, label: s.label || minutesToLabel(start), isAvailable: s.isAvailable !== false };
}

// The backend sends bookedStatus ("BOOKED"|"CANCELLED") and doctorStatus ("Not Attended"|"Attended"|
// "CANCELLED BY USER"); the screens show one collapsed status.
function toDisplayStatus(bookedStatus, doctorStatus) {
  if (bookedStatus === "CANCELLED") return "Cancelled";
  if (doctorStatus === "Attended") return "Attended";
  return "Not Attended";
}

export function toAppointmentRow(r) {
  const empNo = r.employeeNo ?? r.employeeId ?? r.empNo ?? "";
  return {
    id: String(r.id ?? r.appointmentId ?? ""),
    employeeId: empNo,
    employeeNumber: r.employeeNumber ?? empNo,
    employeeName: r.employeeName ?? r.empName ?? "",
    department: r.department ?? "",
    age: r.age ?? "",
    gender: r.gender ?? "",
    date: r.date ?? r.bookingDate ?? r.appointmentDate ?? "",
    start: Number(r.start ?? r.startMinutes),
    end: Number(r.end ?? r.endMinutes),
    status: r.status || toDisplayStatus(r.bookedStatus, r.doctorStatus),
    attended: r.attended ?? r.doctorStatus ?? null,
  };
}

export const EMPTY_BOOKING_CONTEXT = {
  employeeNo: "", employeeName: "", age: "", gender: "", department: "",
  clinicDates: [], slots: [],
};