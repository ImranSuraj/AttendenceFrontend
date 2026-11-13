export const LEAVE_TYPES = ["Casual/Sick Leave","Privilege/Earned Leave","On Duty","Forgot to Swipe"];
export const LEAVE_SESSIONS = ["1st Session","2nd Session","Full Session"];
export const FORGOT_TO_SWIPE_REASONS = ["Forgot to Bring ID", "Swipe Machine Down", "Others"];

export const REQUEST_ACTIONS = { APPROVE: "APPROVE", REJECT: "REJECT", CANCEL: "CANCEL" };

export const LEAVE_TYPE_VERTICAL = {
  "Casual/Sick Leave": { vertical: "leave", code: "CL" },
  "Privilege/Earned Leave": { vertical: "leave", code: "EL" },
  "On Duty": { vertical: "onduty" },
  "Forgot to Swipe": { vertical: "fts" },
};

// Two different session-code vocabularies the backend expects on Apply, index-aligned with
// LEAVE_SESSIONS = ["1st Session", "2nd Session", "Full Session"] from leave.constants.js.
export const SESSION_TO_LEAVE_CODE = { "1st Session": "FN", "2nd Session": "AN", "Full Session": null };
export const SESSION_TO_REQUEST_CODE = { "1st Session": "FS", "2nd Session": "SS", "Full Session": "ES" };
// Inverse of the above — for displaying a Forgot-to-Swipe row's raw session code back as the same
// words the Apply/Edit forms' own Session dropdown uses, instead of the bare 'FS'/'SS'/'ES' code.
// Exported — EmployeeLeaveBalancePage.jsx reuses this same map for spv1_LeaveBalanceHistory's
// DATEWISE SessionCode column, which deliberately returns the same 'FS'/'SS'/'ES' vocabulary
// rather than inventing a second one.
export const REQUEST_CODE_TO_SESSION = { FS: "1st Session", SS: "2nd Session", ES: "Full Session" };

// "My Reportees" (pending-approval) mode returns the raw single-letter status code un-translated
// (unlike "Mine" mode, whose own CASE expression in the stored procedure already spells these out) —
// titleCase() can't expand a single letter into a word, so it displayed the bare code ('C', 'R', ...)
// verbatim. These mirror spv1_GetLeaveRequests'/spv1_GetForgotToSwipeRequests' own status CASE
// expressions exactly, so "Pending" mode reads identically to "Mine" mode. Display-only — the
// backend/stored procedures are untouched.
// "Approved" (not "Completed") for the approved/done code in both maps -- Leave and
// Forgot-to-Swipe's own legacy vocabulary called this "Completed" while On-Duty called the
// identical outcome "Approved"; unified on "Approved" since this page merges all 3 request types
// into one table/tab set (see spv1_GetLeaveRequests' own matching fix comment).
export const LEAVE_STATUS_CODE_TO_LABEL = { P: "Pending", R: "Rejected", D: "Draft", E: "Cancelled", C: "Approved" };
export const FTS_STATUS_CODE_TO_LABEL = { A: "Pending", C: "Approved", R: "Rejected", D: "Cancelled" };

// The dates of a range with what the database lets the person choose on each (GET /leave/requests/apply-dates -> dbo.usp_v1_GetLeaveApplyDates). Any date can be
// picked in the date pickers: the answer says which dates are choosable (a working day with nothing already taken), which sessions each allows, and - when the
// range cannot be applied - why (resultCode 1, 2 or 3 with a message). Works for the leave types, On Duty (OD) and Forgot to Swipe (FS).
export const APPLY_DATES_CODE = { "Casual/Sick Leave": "CL", "Privilege/Earned Leave": "EL", "On Duty": "OD", "Forgot to Swipe": "FS" };
