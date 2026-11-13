import { api } from "@/shared/api/apiClient";

// OrgChartController (api/org): pure API calls, no mapping or logic. Returns the payload of the server's response.
export const chart = (params) => api.get("/org/chart", { params }).then((res) => res?.data?.data);
