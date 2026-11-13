import * as controller from "../controllers/auth.controller";
import { useAuthStore } from "@/shared/auth/auth.store";
import { ensureTeamsSdk } from "@/shared/utils/teams";
import { sendEncrypted } from "./credentialCrypto";

// Sign-in flow: encrypts the credentials, reads the answers and starts the session.

const finish = (data, method) => {
  useAuthStore.getState().signIn({ token: data.token, empNo: data.empNo, name: data.name, expiresAtUtc: data.expiresAtUtc, method });
};

/**
 * Sign in with Employee No and password. Both are encrypted in the browser before they are sent (see credentialCrypto.js).
 * Returns { signedIn: true } when the session was created, or { mustChange: true, resetToken } when the password is older than 90 days and has to be changed first.
 */
export async function signInWithPassword(empNo, password) {
  const res = await sendEncrypted({ empNo: empNo.trim(), password }, (body) => controller.createSession(body));
  return afterPassword(res.data.data);
}

// The three answers a password step (or the code step) can give: a 6-digit code was e-mailed (first sign-in only), the password must be changed first, or the session.
function afterPassword(data) {
  if (data.mfaRequired) return { mfa: true, challengeId: data.challengeId, maskedEmail: data.maskedEmail };
  if (data.mustChangePassword) return { mustChange: true, resetToken: data.resetToken };
  finish(data.session, "password");
  return { signedIn: true };
}

/** First sign-in only: the 6-digit code that was e-mailed (encrypted like the password). Same answers as signInWithPassword, without "mfa". */
export async function verifyMfaCode(challengeId, otp) {
  const res = await sendEncrypted({ otp }, (body) => controller.verifyMfa({ ...body, challengeId }));
  return afterPassword(res.data.data);
}

/** "Forgot password": asks the server to e-mail the reset link. The answer is the same whether or not the Employee No exists. */
export async function requestPasswordReset(email) {
  const res = await sendEncrypted({ empNo: email.trim() }, (body) => controller.requestPasswordReset(body));
  return res.data.message;
}

/** Sets a new password with the one-time token (from the e-mail link - then the 6-digit code from the same e-mail is needed too - or given after an expired-password sign-in, which needs no code). */
export async function resetPassword(token, newPassword, otp) {
  const res = await sendEncrypted({ password: newPassword, otp }, (body) => controller.resetPassword({ ...body, token }));
  return res.data.message;
}
/** Microsoft Teams single sign-on: ask Teams for the user's token, then exchange it for an application session. */
export async function signInWithTeams() {
  const { authentication } = await import("@microsoft/teams-js");
  // Inside an iframe that is not Teams the SDK is never answered and would wait for ever: give up after 8 seconds so the Employee ID box is offered.
  await Promise.race([ensureTeamsSdk(), new Promise((_, reject) => setTimeout(() => reject(new Error("Microsoft Teams did not respond. Sign in with your Employee ID instead.")), 8000))]);
  const idToken = await authentication.getAuthToken();
  const res = await controller.createTeamsSession({ idToken });
  finish(res.data.data, "teams");
}

export function signOut() {
  useAuthStore.getState().signOut();
  window.location.reload(); // a clean slate: no cached data from the previous user
}

/** The server's own message from a failed sign-in call, else a generic one. */
export const authErrorMessage = (err) =>
  err?.response?.data?.message || (err?.message && !/status code/i.test(err.message) ? err.message : "Sign-in failed. Please try again.");