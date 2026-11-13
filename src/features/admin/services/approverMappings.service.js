import * as controller from "../controllers/approverMappings.controller";

// Approver Mapping (HR Admin).
export async function listApproverMappings() {
  return (await controller.getMappings()) ?? [];
}

export async function addApproverMapping(body) {
  return (await controller.addMapping(body)).data?.message;
}

export async function updateApproverMapping({ employeeNo, ...body }) {
  return (await controller.updateMapping(employeeNo, body)).data?.message;
}