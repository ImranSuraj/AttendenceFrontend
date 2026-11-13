import { api } from "@/shared/api/apiClient";

// AttendanceLogController (api/attendance): pure API calls, no mapping or logic. Each one returns the payload of the server's response.
export const logs = (params) => api.get("/attendance/logs", { params }).then((res) => res?.data?.data);
export const summary = (params) => api.get("/attendance/summary", { params }).then((res) => res?.data?.data);
