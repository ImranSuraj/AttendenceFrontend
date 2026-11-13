import { api, resolvedBaseUrl, getAuthHeaders } from "@/shared/api/apiClient";

// HRTicketController (api/hr-tickets): pure API calls.
const data = (res) => res?.data?.data;
const rawPost = (route, formData) =>
  fetch(`${resolvedBaseUrl}${route}`, { method: "POST", headers: getAuthHeaders(), body: formData });

export const getMasterData = () => api.get("/hr-tickets/master-data").then(data);

export const getTickets = (params) => api.get("/hr-tickets", { params }).then(data);

export const getExport = (params) => api.get("/hr-tickets/export", { params }).then(data);

export const createTicket = (body) => api.post("/hr-tickets", body).then(data);

export const updateStatus = (ticketNo, body) =>
  api.patch(`/hr-tickets/${encodeURIComponent(ticketNo)}/status`, body);

// File calls return the raw response, read by the service.
export const uploadIdCardImage = (formData) => rawPost("/hr-tickets/id-card-images", formData);

export const uploadAttachments = (formData) => rawPost("/hr-tickets/attachments", formData);

export const requestAttachments = (query) =>
  fetch(`${resolvedBaseUrl}/hr-tickets/attachments?${query}`, { headers: getAuthHeaders() });