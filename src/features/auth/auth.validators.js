// The rules of a new password - the same as the legacy change-password page and the server (PasswordPolicy.cs), so the person sees what is missing while typing.
// The server checks everything again, and also that the password is not the current one or one of the last three.

export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "lower", label: "One lower case letter", test: (p) => /\p{Ll}/u.test(p) },
  { id: "upper", label: "One upper case letter", test: (p) => /\p{Lu}/u.test(p) },
  { id: "digit", label: "One number", test: (p) => /\p{Nd}/u.test(p) },
  { id: "special", label: "One special character", test: (p) => /[\p{S}\p{P}]/u.test(p) },
  { id: "space", label: "No spaces", test: (p) => !/\s/.test(p) },
];

/** The first thing wrong with the new password (legacy wording), or "" when it is acceptable. confirm = the second box ("" skips that check). */
export function passwordProblem(empNo, password, confirm) {
  const p = password ?? "";
  if (p.length < 8) return "Password length should be minimum 8 characters!";
  if (p.length > 64) return "Password can be at most 64 characters!";
  if (!PASSWORD_RULES[1].test(p)) return "New password should contain at least one lower case letter!";
  if (!PASSWORD_RULES[2].test(p)) return "New password should contain at least one upper case letter!";
  if (!PASSWORD_RULES[3].test(p)) return "New password should contain at least one number!";
  if (!PASSWORD_RULES[4].test(p)) return "New password should contain at least one special character!";
  if (!PASSWORD_RULES[5].test(p)) return "Password should not contain spaces!";
  if (empNo && String(empNo).trim().toLowerCase() === p.toLowerCase()) return "Login ID and password cannot be the same!";
  if (confirm !== undefined && p !== confirm) return "Both passwords should match!";
  return "";
}

/** The Employee No box: letters and digits, at most 10 (what the server accepts). */
export function empNoProblem(empNo) {
  const v = String(empNo ?? "").trim();
  if (!v) return "Please enter your Employee ID.";
  if (!/^[A-Za-z0-9]{1,10}$/.test(v)) return "Employee ID can contain only letters and digits (at most 10).";
  return "";
}

/** The e-mail box of the forgot-password screen. */
export function emailProblem(email) {
  const v = String(email ?? "").trim();
  if (!v) return "Please enter your e-mail address.";
  if (v.length > 255 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "Please enter a valid e-mail address.";
  return "";
}
