import { api } from "@/shared/api/apiClient";

// EmpDocUploadAccessController (api/documents/upload-access): pure API calls.
export const getUploadAccess = () => api.get("/documents/upload-access").then((res) => res.data.data);