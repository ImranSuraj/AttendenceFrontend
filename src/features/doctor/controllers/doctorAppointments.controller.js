import { api } from "@/shared/api/apiClient";

// DoctorAppointmentController (api/doctor-appointments): pure API calls.
const data = (res) => res?.data?.data;

export const getBookingContext = () => api.get("/doctor-appointments/booking-context").then(data);

export const getSlots = (bookingDate) => api.get("/doctor-appointments/slots", { params: { bookingDate } }).then(data);

export const getMyAppointments = () => api.get("/doctor-appointments/mine").then(data);

// The created row may come back wrapped in { data } or bare, so the body is returned as the fallback.
export const bookAppointment = (body) =>
  api.post("/doctor-appointments", body).then((res) => res?.data?.data ?? res?.data);

export const cancelAppointment = (id) =>
  api.post(`/doctor-appointments/${encodeURIComponent(id)}/cancel`).then(data);

export const markAttended = (id) =>
  api.post(`/doctor-appointments/${encodeURIComponent(id)}/attend`).then(data);

export const getReport = (params) => api.get("/doctor-appointments/report", { params }).then(data);