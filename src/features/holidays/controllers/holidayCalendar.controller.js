import { api } from "@/shared/api/apiClient";

// HolidayCalendarController (api/holidays): pure API calls, no mapping or logic. Each one returns the payload of the server's response.
export const locations = () => api.get("/holidays/locations").then((res) => res?.data?.data);
export const list = (params) => api.get("/holidays", { params }).then((res) => res?.data?.data);
