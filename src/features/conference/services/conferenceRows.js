// Shapes the conference-room answers for the screens (the one place to adjust field names).
export function toLocation(r) {
  return { code: r.locationCode ?? "", name: r.locationName ?? "" };
}

export function toRoom(r) {
  return {
    code: r.roomCode ?? "",
    name: r.roomName ?? "",
    // capacity/active are optional: undefined capacity is shown as a dash, never coerced to 0.
    capacity: r.capacity != null ? Number(r.capacity) : undefined,
    active: r.active != null ? !!r.active : true,
  };
}

// The backend sends participantDetails [{empNo, empName, email}]; an absent list means no participants.
function toParticipants(raw) {
  return (raw?.participantDetails || []).map((p) => ({
    id: String(p.empNo ?? p.EmpNo ?? p.id ?? ""),
    name: p.empName ?? p.EmpName ?? p.name ?? "",
    email: p.email ?? p.Email ?? "",
  }));
}

export function toBooking(r) {
  const participants = toParticipants(r);
  return {
    id: String(r.bookingId ?? ""),
    locationCode: r.locationCode ?? "",
    locationName: r.locationName ?? "",
    roomCode: r.roomCode ?? "",
    roomName: r.roomName ?? "",
    date: String(r.bookDate ?? "").slice(0, 10),
    start: Number(r.startMinutes),
    end: Number(r.endMinutes),
    employeeId: r.bookedEmpId ?? "",
    employeeName: r.bookedBy ?? "",
    contact: r.bookedContact ?? "",
    email: r.bookedEmail ?? "",
    purpose: r.purpose ?? "",
    participants,
    // Headcount falls back to the numeric count for bookings made before participants were listed.
    attendees: participants.length || Number(r.participants ?? 0),
    breakfast: r.breakfast || "Not Required",
    tea: r.tea || "Not Required",
    lunch: r.lunch || "Not Required",
    status: (r.bookingStatus ?? r.status) === "CANCELLED" ? "Cancelled" : "Scheduled",
  };
}