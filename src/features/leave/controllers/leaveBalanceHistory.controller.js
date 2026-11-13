import { api } from "@/shared/api/apiClient";

// LeaveBalanceHistoryController (api/leave/balance-history): pure API calls (config = extra axios options, e.g. { skipErrorToast: true }).
const data = (res) => res?.data?.data;

export const summary = (params, config) => api.get("/leave/balance-history/summary", { params, ...config }).then(data);
export const datewise = (params) => api.get("/leave/balance-history/datewise", { params }).then(data);
