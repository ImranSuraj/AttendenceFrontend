import * as controller from "../controllers/shiftChanges.controller";
import { buildUploadForm, readUpload } from "./adminResponses";

// Shift Change Upload (Plant HR).
export async function getShifts() {
  return (await controller.getShifts()) ?? [];
}

// -> { saved, message, rejected: [{ reference, description }] }
export async function uploadShiftChange({ date, file }) {
  return (await readUpload(await controller.upload(buildUploadForm(file, { date })))).data;
}