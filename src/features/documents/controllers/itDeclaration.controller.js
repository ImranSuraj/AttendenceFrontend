import { api, resolvedBaseUrl, getAuthHeaders } from "@/shared/api/apiClient";

// ITDeclarationController (api/documents/it-declarations): pure API calls.
const data = (res) => res?.data?.data;
const dataOrBody = (res) => res?.data?.data ?? res?.data;
const rawGet = (route) => fetch(`${resolvedBaseUrl}${route}`, { headers: getAuthHeaders() });

export const getMine = () => api.get("/documents/it-declarations/mine").then(data);

export const getLookups = (operation, regime) =>
  api.get("/documents/it-declarations/lookups", { params: { operation, regime: regime || undefined } }).then(data);

export const submit = (body) => api.post("/documents/it-declarations", body).then(dataOrBody);

export const getAll = () => api.get("/documents/it-declarations").then(data);

export const setEditPermission = (employeeCode) =>
  api.put(`/documents/it-declarations/${encodeURIComponent(employeeCode)}/edit-permission`).then(dataOrBody);

// Files come back as raw responses (PDF / CSV), read by the service.
export const requestMyPdf = () => rawGet("/documents/it-declarations/mine/pdf");
export const requestPdfFor = (employeeCode) => rawGet(`/documents/it-declarations/${encodeURIComponent(employeeCode)}/pdf`);
export const requestExport = () => rawGet("/documents/it-declarations/export");