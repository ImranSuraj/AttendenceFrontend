import { api } from "@/shared/api/apiClient";

// VisitorRequestsController (api/visitors/requests): pure API calls, no mapping or logic. Each one returns the payload of the server's response.
const data = (res) => res?.data?.data;

export const submit = (body) => api.post("/visitors/requests", body).then(data);
export const list = () => api.get("/visitors/requests").then((res) => res?.data?.data);
export const update = (id, body) => api.put(`/visitors/requests/${id}`, body).then(data);
export const decide = (id, body) => api.post(`/visitors/requests/${id}/decision`, body).then(data);
