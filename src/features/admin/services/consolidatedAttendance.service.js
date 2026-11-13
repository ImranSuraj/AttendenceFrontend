import * as controller from "../controllers/consolidatedAttendance.controller";
import { toReport } from "./adminResponses";

// Consolidated Attendance (HR Admin, Plant HR, employee 386).
export async function getConsolidatedPlants() {
  return (await controller.getPlants()) ?? [];
}

export async function getConsolidatedReport(params) {
  return toReport(await controller.getReport(params));
}

export async function getForm25Report(params) {
  return toReport(await controller.getForm25(params));
}