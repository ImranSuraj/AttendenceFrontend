// Locations/rooms/bookings used to be invented mock data here (CONFERENCE_LOCATIONS,
// CONFERENCE_ROOMS_BY_LOCATION, BOOKINGS) — all deleted. Real data now comes from the backend
// (plant_mast for locations, confroom_master for rooms, confroom_transactions for bookings) via
// conference.service.js / hooks/useConferenceQuery.js.
//
// TIME_SLOTS/SLOT_START_MIN/SLOT_END_MIN/minutesToLabel/buildTimeSlots are kept here as real,
// fixed frontend business constants (the whole day, 00:00 - 24:00, 30-minute increments, same convention as Doctor
// Appointment's own slot template) rather than fetched from the backend: unlike Doctor
// Appointment's Friday-only clinic window (which needs the backend to hand back which Fridays are
// "next 4 upcoming"), the conference room slot grid is a fixed daily template that applies
// uniformly to every location/room/day with no per-location variation — there is nothing dynamic
// for the server to compute here, so keeping it a static shared constant avoids a pointless round
// trip. If a future requirement makes opening hours vary by location, this should move into the
// booking-context response the same way Doctor Appointment's clinicDates did.
export const MEAL_OPTIONS = ["Not Required", "Required"];

export const SLOT_START_MIN = 0;
export const SLOT_END_MIN = 24 * 60;
export const SLOT_INCREMENT_MIN = 30;

export function minutesToLabel(totalMinutes) {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Display only: the 12-hour form on its own, e.g. "3:00 PM".
export function minutesTo12hLabel(totalMinutes) {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}

// Display only: "15:00 | 3:00 PM" -- the 24-hour time and its 12-hour form together. The value that is
// stored and sent to the API is always minutes-since-midnight (24-hour), never this label.
export function minutesToDualLabel(totalMinutes) {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const suffix = hh < 12 ? "AM" : "PM";
  return `${minutesToLabel(totalMinutes)} | ${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

export function buildTimeSlots() {
  const slots = [];
  for (let t = SLOT_START_MIN; t + SLOT_INCREMENT_MIN <= SLOT_END_MIN; t += SLOT_INCREMENT_MIN) {
    slots.push({ start: t, end: t + SLOT_INCREMENT_MIN, label: minutesToLabel(t) });
  }
  return slots;
}

export const TIME_SLOTS = buildTimeSlots();
