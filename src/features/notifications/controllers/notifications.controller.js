import { api } from "@/shared/api/apiClient";

// NotificationsController (api/notifications): pure API calls.
export const getCounts = () => api.get("/notifications/counts").then((res) => res?.data?.data);

export const markRead = (module) => api.post(`/notifications/${encodeURIComponent(module)}/read`);