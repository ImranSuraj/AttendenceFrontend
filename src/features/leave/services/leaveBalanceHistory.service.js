import * as controller from "../controllers/leaveBalanceHistory.controller";

// ---- Balance ---------------------------------------------------------------------------------
// Own balance when empNo is omitted; a reportee's when supplied (LeaveBalanceController re-checks
// Manager role + that empNo is actually one of the caller's reportees server-side).

export async function getLiveLeaveBalance(leaveYear, empNo, quiet = false) {
  const extra = empNo ? { empNo } : {};
  const config = quiet ? { skipErrorToast: true } : undefined; // quiet: the caller handles a refusal itself (one person's balance missing is not an error to shout about)
  // One procedure for every balance on screen (spv1_LeaveBalanceHistory, SUMMARY): this year's row = CL/SL (casual + sick) and PL/EL.
  const rows = (await controller.summary({ year: leaveYear, ...extra }, config)) ?? [];
  const row = rows.find(r => Number(r.leaveYear) === Number(leaveYear));
  return [
    { type: "Casual/Sick Leave", allocated: undefined, used: undefined, balance: row?.casualLeaveBalance ?? 0 },
    { type: "Privilege/Earned Leave", allocated: undefined, used: undefined, balance: row?.privilegeLeaveBalance ?? 0 },
  ];
}

// ---- Balance history (Employee Leave Balance page, spv1_LeaveBalanceHistory) ------------------
// Real AMSBackendAPI calls — no mock fallback. Caller's own history only (no reportee mode, unlike
// getLiveLeaveBalance above), since this backs a personal drill-down page reached from the
// caller's own Dashboard card, not a manager-facing view.

export async function getLeaveBalanceHistorySummary(year) {
  return (await controller.summary({ year: year ?? undefined })) ?? [];
}

export async function getLeaveBalanceHistoryDatewise(year) {
  return (await controller.datewise({ year })) ?? [];
}
