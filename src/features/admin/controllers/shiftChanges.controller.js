import { api } from "@/shared/api/apiClient";
import { postForm } from "./postForm";

// ShiftChangesController (api/admin/shift-changes).
export const getShifts = () => api.get("/admin/shift-changes/shifts").then((res) => res?.data?.data);
export const upload = (form) => postForm("/admin/shift-changes", form);