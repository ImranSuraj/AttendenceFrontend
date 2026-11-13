import { api } from "@/shared/api/apiClient";

// OnDutyRequestsController (api/on-duty/requests): pure API calls, no mapping or logic. Each one returns the payload of the server's response.
const data = (res) => res?.data?.data;

export const apply = (body) => api.post("/on-duty/requests", body).then(data);
export const mine = (params) => api.get("/on-duty/requests/mine", { params }).then(data);
export const pendingApproval = (params) => api.get("/on-duty/requests/pending-approval", { params }).then(data);
export const manage = (requestNo, action, body) => api.post(`/on-duty/requests/${requestNo}/${action}`, body);
export const edit = (requestNo, body) => api.put(`/on-duty/requests/${requestNo}`, body);
