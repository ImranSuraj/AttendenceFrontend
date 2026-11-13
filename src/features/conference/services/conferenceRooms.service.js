import * as controller from "../controllers/conferenceRooms.controller";
import { toBooking, toLocation, toRoom } from "./conferenceRows";

export async function getBookingContext() {
  return { locations: ((await controller.getLocations()) ?? []).map(toLocation) };
}

export async function getRoomsForLocation(locationCode) {
  return ((await controller.getRooms(locationCode)) ?? []).map(toRoom);
}

// Every booking at a location between two dates (yyyy-MM-dd, inclusive).
export async function getLocationBookings({ location, from, to }) {
  const rows = await controller.getLocationBookings(location, {
    from: from || undefined, to: to || undefined, includeCancelled: false,
  });
  return (rows ?? []).map(toBooking);
}

// Every booking at the location on one day.
export function getLocationDayBookings(locationCode, date) {
  return getLocationBookings({ location: locationCode, from: date, to: date });
}

export async function getBookingById(bookingId) {
  return toBooking((await controller.getBooking(bookingId)) ?? {});
}

export async function addBooking({ locationCode, roomCode, date, start, end, purpose, participantIds, breakfast, tea, lunch }) {
  const created = await controller.createBooking({
    location: locationCode, conferenceRoom: roomCode || null, bookDate: date,
    startMinutes: start, endMinutes: end, purpose: purpose?.trim(),
    // The attendee count is always the number of picked participants.
    attendees: (participantIds || []).length, participantIds: participantIds || [],
    breakfast, tea, lunch,
  });
  return toBooking(created ?? {});
}

// slotStart/slotEnd say which part of the booking is edited; start/end are the new time for that part.
export async function updateBookingSlot({ bookingId, locationCode, roomCode, date, slotStart, slotEnd, start, end, purpose, participantIds, breakfast, tea, lunch }) {
  const updated = await controller.updateBooking(bookingId, {
    location: locationCode, conferenceRoom: roomCode || null, bookDate: date,
    slotStartMinutes: slotStart, slotEndMinutes: slotEnd, startMinutes: start, endMinutes: end,
    purpose: purpose?.trim(),
    attendees: (participantIds || []).length, participantIds: participantIds || [],
    breakfast, tea, lunch,
  });
  return toBooking(updated ?? {});
}

// Re-notifies everyone by saving the booking again with its own values unchanged.
export function resendInvitation(booking) {
  return updateBookingSlot({
    bookingId: booking.id, locationCode: booking.locationCode, roomCode: booking.roomCode,
    date: booking.date, slotStart: booking.start, slotEnd: booking.end,
    start: booking.start, end: booking.end, purpose: booking.purpose,
    participantIds: (booking.participants || []).map((p) => p.id),
    breakfast: booking.breakfast, tea: booking.tea, lunch: booking.lunch,
  });
}

// Sends the invitation e-mail to one already-listed participant.
export async function inviteSingleParticipant(bookingId, participantEmpId) {
  await controller.inviteParticipant(bookingId, { participantEmpId });
}

// Cancels the given part of a booking (the whole booking when the range is its full range).
export async function cancelBookingSlot({ bookingId, start, end }) {
  await controller.deleteBooking(bookingId, { slotStartMinutes: start, slotEndMinutes: end });
  return { bookingId, status: "Cancelled" };
}

// The caller's own bookings and meetings (booked or invited), every location; cancelled ones included.
export async function getMyBookings({ from, to } = {}) {
  const rows = await controller.getMyBookings({ includeCancelled: true, fromDate: from || undefined, toDate: to || undefined });
  return (rows ?? []).map(toBooking);
}

// The location the browser's GPS position is in, or null.
export async function getNearestLocation({ latitude, longitude }) {
  return (await controller.getNearestLocation({ latitude, longitude })) || null;
}