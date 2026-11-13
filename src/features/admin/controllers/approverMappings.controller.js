import { api } from "@/shared/api/apiClient";

// ApproverMappingsController (api/admin/approver-mappings): pure API calls.
export const getMappings = () => api.get("/admin/approver-mappings").then((res) => res?.data?.data);
export const addMapping = (mapping) => api.post("/admin/approver-mappings", mapping);
export const updateMapping = (empNo, mapping) => api.put(`/admin/approver-mappings/${encodeURIComponent(empNo)}`, mapping);