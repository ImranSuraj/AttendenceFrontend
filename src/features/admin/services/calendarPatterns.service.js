import * as controller from "../controllers/calendarPatterns.controller";
import { buildUploadForm, readUpload } from "./adminResponses";

// Calendar Upload (HR Admin) -> the server's message
export async function uploadCalendarPattern(file) {
  return (await readUpload(await controller.upload(buildUploadForm(file)))).message;
}