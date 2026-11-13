import { api } from "@/shared/api/apiClient";

// ForgotToSwipeRequestsController (api/forgot-to-swipe/requests): pure API calls, no mapping or logic. Each one returns the payload of the server's response.
const data = (res) => res?.data?.data;

export const apply = (body) => api.post("/forgot-to-swipe/requests", body).then(data);
export const mine = (params) => api.get("/forgot-to-swipe/requests/mine", { params }).then(data);
export const pendingApproval = (params) => api.get("/forgot-to-swipe/requests/pending-approval", { params }).then(data);
export const manage = (requestNo, action, body) => api.post(`/forgot-to-swipe/requests/${requestNo}/${action}`, body);
export const edit = (requestNo, body) => api.put(`/forgot-to-swipe/requests/${requestNo}`, body);
