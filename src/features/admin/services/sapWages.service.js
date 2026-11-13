import * as controller from "../controllers/sapWages.controller";
import { toReport } from "./adminResponses";

// SAP Wages (Plant HR).
export async function getSapPlants() {
  return (await controller.getPlants()) ?? [];
}

export async function getSapCategories() {
  return (await controller.getCategories()) ?? [];
}

export async function getShiftWeeklyOff(params) {
  return toReport(await controller.getShiftWeeklyOff(params));
}

export async function getCanteenDeductions(params) {
  return toReport(await controller.getCanteenDeductions(params));
}