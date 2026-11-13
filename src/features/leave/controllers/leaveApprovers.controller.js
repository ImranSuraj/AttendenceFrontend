import { api } from "@/shared/api/apiClient";

// LeaveApproversController (api/leave/approvers): pure API calls.
const data = (res) => res?.data?.data;

export const getApprovers = () => api.get("/leave/approvers").then(data);
