import * as controller from "../controllers/leaveApprovers.controller";

// Real AMSBackendAPI call (spv1_GetLeaveApprovers) — resolves the caller's own Approver_Master
// Level 1/Level 2 mapping into real names, for the Apply Leave "Authorized Person" dropdown.
// Either level can come back null (no approver configured at that level) — filtered out here so
// the frontend only ever sees pickable options.
export async function getMyApprovers() {
  const data = (await controller.getApprovers()) ?? {};
  const options = [];
  if (data.appr1EmpNo && data.appr1Name) options.push({ empNo: data.appr1EmpNo, name: data.appr1Name, level: 1 });
  if (data.appr2EmpNo && data.appr2Name) options.push({ empNo: data.appr2EmpNo, name: data.appr2Name, level: 2 });
  return options;
}
