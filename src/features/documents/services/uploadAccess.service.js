import * as controller from "../controllers/uploadAccess.controller";

// Which upload programs the signed-in employee may use ({ flag: true/false, ... }).
export function getUploadAccess() {
  return controller.getUploadAccess();
}