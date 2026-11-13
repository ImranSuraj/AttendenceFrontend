import * as controller from "../controllers/leaveRequests.controller";
import { titleCase } from "@/shared/utils/text";
import { toDate as parseDate } from "@/shared/utils/date";
import { LEAVE_TYPE_VERTICAL, SESSION_TO_LEAVE_CODE, REQUEST_CODE_TO_SESSION, LEAVE_STATUS_CODE_TO_LABEL, APPLY_DATES_CODE } from "@/features/leave/leave.constants";
import { toTableRow } from "./leaveRows";

// The pending-approval listing returns the backend's own type words; the screens show the combined names.
const displayLeaveType = (type) => (type === "Casual Leave" || type === "Sick Leave" ? "Casual/Sick Leave" : type === "Earned Leave" || type === "Privilege Leave" ? "Privilege/Earned Leave" : type);

// The dates of a range with what the database lets the person choose on each (GET /leave/requests/apply-dates -> dbo.usp_v1_GetLeaveApplyDates). Any date can be
// picked in the date pickers: the answer says which dates are choosable (a working day with nothing already taken), which sessions each allows, and - when the
// range cannot be applied - why (resultCode 1, 2 or 3 with a message). Works for the leave types, On Duty (OD) and Forgot to Swipe (FS).
export async function getApplyDates({ leaveType, fromDate, toDate }) {
  return controller.applyDates({ leaveType: APPLY_DATES_CODE[leaveType], fromDate, toDate });
}

export async function applyLeaveRequest({ leaveType, fromDate, toDate, dates, authPersonEmpNo, remarks }) {
  const { code } = LEAVE_TYPE_VERTICAL[leaveType];
  const body = {
    leaveType: code,
    fromDate, toDate,
    dates: dates.map(d => ({ date: d.date, session: SESSION_TO_LEAVE_CODE[d.session] ?? null })),
    authPerson: authPersonEmpNo,
    remarks: remarks || null,
  };
  return controller.apply(body);
}

export async function getLeaveMine(fromDate, toDate) {
  const rows = [];
  for (const code of ["CL", "EL"]) {
    const items = (await controller.mine({ leaveType: code, fromDate, toDate })) ?? [];
    // The backend's MINE scope is one row per DATE, not per request (see LeaveRequestMineItem's
    // own doc comment) -- a multi-date leave request (e.g. a 3-day range) comes back as 3 rows
    // all sharing the same requestNo, which rendered as the same "Leave No." appearing 3 times in
    // the table (read as duplicate tickets). Grouped here into one table row per requestNo,
    // matching how the PENDING_APPROVAL scope is already grouped server-side -- fromDate/toDate
    // become the group's min/max date, days becomes the date count, and dateSessions carries the
    // full per-date breakdown so sessionSummary()/the View Details modal's per-date list still
    // work exactly as they do for a fresh Apply Leave submission.
    const byRequest = new Map();
    items.forEach(r => {
      if (!byRequest.has(r.requestNo)) byRequest.set(r.requestNo, []);
      byRequest.get(r.requestNo).push(r);
    });
    byRequest.forEach((group, requestNo) => {
      const sorted = [...group].sort((a, b) => (parseDate(a.requestDate)?.getTime() ?? 0) - (parseDate(b.requestDate)?.getTime() ?? 0));
      const dateSessions = {};
      sorted.forEach(r => { dateSessions[r.requestDate] = REQUEST_CODE_TO_SESSION[r.session?.trim()] ?? r.session; });
      const first = sorted[0], last = sorted[sorted.length - 1];
      rows.push(toTableRow("leave", requestNo, {
        leaveNumber: String(requestNo), employeeName: undefined, leaveType: code === "CL" ? "Casual/Sick Leave" : "Privilege/Earned Leave",
        session: sorted.length === 1 ? dateSessions[first.requestDate] : undefined, dateSessions,
        fromDate: first.requestDate, toDate: last.requestDate, days: sorted.length,
        approver: first.approvalPerson, status: titleCase(first.status), remarks: first.remarks, createdOn: first.receivedDate, actionDate: first.actionDate,
      }));
    });
  }
  return rows;
}

export async function getLeavePending(fromDate, toDate) {
  const rows = [];
  for (const code of ["CL", "EL"]) {
    const items = (await controller.pendingApproval({ leaveType: code, fromDate, toDate })) ?? [];
    items.forEach(r => rows.push(toTableRow("leave", r.requestNo, {
      leaveNumber: String(r.requestNo), employeeId: r.requestorEmpNo, employeeName: r.requestor,
      leaveType: displayLeaveType(titleCase(r.leaveTypeDescription)), session: undefined,
      fromDate: r.fromDate, toDate: r.toDate, days: r.noOfDays,
      approver: undefined, status: LEAVE_STATUS_CODE_TO_LABEL[r.statusCode?.trim()] ?? titleCase(r.statusCode), remarks: r.remarks,
      createdOn: r.receivedDate, actionDate: r.actionDate,
    })));
  }
  return rows;
}
