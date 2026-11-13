import { api } from "@/shared/api/apiClient";

// ConferenceRoomController (api/conference-rooms): pure API calls.
const data = (res) => res?.data?.data;

export const getLocations = () => api.get("/conference-rooms/locations").then(data);

export const getRooms = (locationCode) =>
  api.get(`/conference-rooms/locations/${encodeURIComponent(locationCode)}/rooms`).then(data);

export const getLocationBookings = (location, params) =>
  api.get(`/conference-rooms/locations/${encodeURIComponent(location)}/bookings`, { params }).then(data);

export const getNearestLocation = (params) =>
  api.get("/conference-rooms/locations/nearest", { params }).then(data);

export const getMyBookings = (params) => api.get("/conference-rooms/bookings/mine", { params }).then(data);

export const getBooking = (bookingId) => api.get(`/conference-rooms/bookings/${Number(bookingId)}`).then(data);

export const createBooking = (body) => api.post("/conference-rooms/bookings", body).then(data);

export const updateBooking = (bookingId, body) =>
  api.put(`/conference-rooms/bookings/${Number(bookingId)}`, body).then(data);

export const deleteBooking = (bookingId, params) =>
  api.delete(`/conference-rooms/bookings/${Number(bookingId)}`, { params }).then(data);

export const inviteParticipant = (bookingId, body) =>
  api.post(`/conference-rooms/bookings/${Number(bookingId)}/invitations`, body).then(data);