import { api } from "@/shared/api/apiClient";

// EmployeeProfileController (api/employees): pure API calls.
const data = (res) => res?.data?.data;

export const getEmployees = (params) => api.get("/employees", { params }).then(data);

export const getDepartments = () => api.get("/employees/departments").then(data);

export const getLocations = (params) => api.get("/employees/locations", { params }).then(data);

export const getProfile = (empNo) => api.get(`/employees/${encodeURIComponent(empNo)}`).then(data);

export const getReportees = () => api.get("/employees/reportees").then(data);

export const search = (params) => api.get("/employees/search", { params }).then(data);

// "No match" is a normal answer here, so no error toast is raised for it.
export const getDirectory = (params) => api.get("/employees/directory", { params, skipErrorToast: true }).then(data);