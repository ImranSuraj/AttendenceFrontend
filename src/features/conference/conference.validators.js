// Overlap/conflict detection used to be duplicated here (checking `existingBookings` client-side)
// but has been removed: this feature is now backend-integrated, and the real update-slot/
// cancel-slot procs are the authority on conflict detection (self-excluding the booking's own row,
// split/trim-aware for partial-range edits) — same pattern this app already follows elsewhere
// (holidays/doctor appointment/IT declaration all let the server own conflict/validation logic,
// not just the client). Keeping a client-side overlap check here could produce a false "already
// booked" ahead of a perfectly valid server-side split/update. Only basic required-field/format
// checks remain client-side.
export function validateBookingForm(form) {
  const errors = {};
  // The room is optional: a meeting with no room (or "Virtual / In Person") needs no location/room. Editing an existing
  // room booking still has both.
  if (!form.meetingOnly && !form.location) errors.location = "Please select a location";
  if (!form.meetingOnly && !form.room) errors.room = "Please select a room";
  if (!form.date) errors.date = "Please select a date";
  // The purpose is required: 10 to 200 characters.
  const purpose = (form.purpose || "").trim();
  if (!purpose) errors.purpose = "Enter a purpose";
  else if (purpose.length < 10) errors.purpose = "Purpose must be at least 10 characters";
  else if (purpose.length > 200) errors.purpose = "Purpose can be at most 200 characters";
  if (!form.participantIds || form.participantIds.length === 0) errors.participants = "Add at least one participant";
  if (form.start == null || form.end == null) errors.time = "Please select a time slot";
  if (form.start != null && form.end != null && form.start >= form.end) {
    errors.time = "End time must be after start time";
  }
  return errors;
}

// For the location whose plant code contains CRPO, Breakfast/Tea/Lunch are locked to "Not Required".
export function isMealRestrictedLocation(locationCode) {
  return String(locationCode || "").toUpperCase().includes("CRPO");
}