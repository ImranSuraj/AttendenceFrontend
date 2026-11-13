import * as controller from "../controllers/registerAccounts.controller";

// Register Account (HR Admin and IT Admin): who can sign in with an Employee No and password.
export async function listLoginAccounts(search) {
  return (await controller.getAccounts({ search: search || undefined })) ?? [];
}

export async function listLoginCandidates(search) {
  return (await controller.getCandidates({ search })) ?? [];
}

// { empNo, userType } -> the employee gets a link + 6-digit code by e-mail; nobody sets the password for them
export const registerLoginAccount = (body) => controller.register(body);

export const sendLoginResetLink = ({ userType, empNo }) => controller.sendResetLink(userType, empNo);

export const setLoginAccountActive = ({ userType, empNo, active }) => controller.setActive(userType, empNo, { active });