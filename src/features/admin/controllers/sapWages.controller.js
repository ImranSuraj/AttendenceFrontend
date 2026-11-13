import { api } from "@/shared/api/apiClient";

// SapWagesController (api/admin/sap-wages): pure API calls.
const data = (res) => res?.data?.data;

export const getPlants = () => api.get("/admin/sap-wages/plants").then(data);
export const getCategories = () => api.get("/admin/sap-wages/categories").then(data);
export const getShiftWeeklyOff = (params) => api.get("/admin/sap-wages/shift-weekly-off", { params }).then(data);
export const getCanteenDeductions = (params) => api.get("/admin/sap-wages/canteen-deductions", { params }).then(data);