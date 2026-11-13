import { api } from "@/shared/api/apiClient";

// LeaveRequestsController (api/leave/requests): pure API calls, no mapping or logic. Each one returns the payload of the server's response.
const data = (res) => res?.data?.data;

export const apply = (body) => api.post("/leave/requests", body).then(data);
export const mine = (params) => api.get("/leave/requests/mine", { params }).then(data);
export const pendingApproval = (params) => api.get("/leave/requests/pending-approval", { params }).then(data);
export const manage = (requestNo, action, body) => api.post(`/leave/requests/${requestNo}/${action}`, body);
export const edit = (requestNo, body) => api.put(`/leave/requests/${requestNo}`, body);
export const applyDates = (params) => api.get("/leave/requests/apply-dates", { params }).then(data);
