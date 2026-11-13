import { api } from "@/shared/api/apiClient";

// PolicyController (api/policies): pure API calls, no mapping or logic. Each one returns the payload of the server's response.
export const list = () => api.get("/policies").then((res) => res?.data?.data);
export const add = (body) => api.post("/policies", body).then((res) => res?.data?.data);
export const update = (id, body) => api.put(`/policies/${encodeURIComponent(id)}`, body).then((res) => res?.data?.data);
