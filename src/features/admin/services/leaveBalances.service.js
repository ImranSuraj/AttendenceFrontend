import * as controller from "../controllers/leaveBalances.controller";
import { buildUploadForm, readUpload } from "./adminResponses";

// Upload CL / PL (HR Admin) -> { rows, inserted, updated, errors }
export async function uploadCl(file) {
  return (await readUpload(await controller.uploadCl(buildUploadForm(file)))).data;
}

export async function uploadPl(file) {
  return (await readUpload(await controller.uploadPl(buildUploadForm(file)))).data;
}