// Real AMSBackendAPI integration for per-employee Settings (dbo.EmployeeSettings via
// spv1_EmployeeSettings) -- self-scoped only, no EmpNo param since the backend resolves the
// caller's own identity.
//   GET /settings/me -> { data: { darkMode, leaveApprovalAlerts, ticketStatusUpdates } }
//   PUT /settings/me  body: { darkMode, leaveApprovalAlerts, ticketStatusUpdates } -> same shape back
import * as controller from "../controllers/employeeSettings.controller";

export async function getEmployeeSettings() {
  const data = await controller.getMe();
  return data;
}

export async function updateEmployeeSettings(settings) {
  const data = await controller.updateMe(settings);
  return data;
}
