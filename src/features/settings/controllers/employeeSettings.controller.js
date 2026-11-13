import { api } from "@/shared/api/apiClient";

// EmployeeSettingsController (api/settings): pure API calls, no mapping or logic. Each one returns the payload of the server's response.
export const getMe = () => api.get("/settings/me").then((res) => res?.data?.data);
export const updateMe = (settings) => api.put("/settings/me", settings).then((res) => res?.data?.data);
