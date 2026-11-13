import { api } from "@/shared/api/apiClient";

// ConsolidatedAttendanceController (api/admin/consolidated-attendance): pure API calls.
const data = (res) => res?.data?.data;

export const getPlants = () => api.get("/admin/consolidated-attendance/plants").then(data);
export const getReport = (params) => api.get("/admin/consolidated-attendance", { params }).then(data);
export const getForm25 = (params) => api.get("/admin/consolidated-attendance/form-25", { params }).then(data);