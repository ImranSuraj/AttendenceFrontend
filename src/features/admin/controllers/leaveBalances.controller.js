import { postForm } from "./postForm";

// LeaveBalancesController (api/admin/leave-balances): the raw upload responses, read by the service.
export const uploadCl = (form) => postForm("/admin/leave-balances/cl", form);
export const uploadPl = (form) => postForm("/admin/leave-balances/pl", form);