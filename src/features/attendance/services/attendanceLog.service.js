import * as controller from "../controllers/attendanceLog.controller";
import { titleCase } from "@/shared/utils/text";

// consolidated.emp_no and empmast.empno may not share the same underlying column width/padding —
// trimming means this always matches the Employees/reportees' empno by value, not by
// incidental padding (see the same normalization in employees.service.js's toEmployeeRow).
const trimEmpNo = (v) => (typeof v === "string" ? v.trim() : v);

// Real AMSBackendAPI call (spv1_GetAttendanceLog via GET /attendance/logs) — no mock fallback.
// Confirmed status codes only: P/A/WO/H/OD/C-OFF/CL/SL (see the proc's own header comment in
// RevampedFinalStoredProcedures.sql) — every other code passes through as its raw code, never an
// invented label. AttendanceDate comes back as dd/MM/yyyy; converted here to yyyy-MM-dd so the
// rest of the app (date-range filtering, calendar keys) can compare it as a plain string.
function toIsoDate(ddMMyyyy) {
  const [d, m, y] = ddMMyyyy.split("/");
  return `${y}-${m}-${d}`;
}

// Leave statuses are shown with the combined names: Casual / Sick Leave -> "Casual/Sick Leave", Privilege / Earned Leave -> "Privilege/Earned Leave".
const leaveLabel = (text) => {
  const label = titleCase(text);
  return label === "Casual Leave" || label === "Sick Leave" ? "Casual/Sick Leave"
    : label === "Privilege Leave" || label === "Earned Leave" ? "Privilege/Earned Leave" : label;
};

function toAttendanceLogRow(r) {
  return {
    employeeId: trimEmpNo(r.empNo),
    date: toIsoDate(r.attendanceDate),
    checkIn: r.checkIn || "-",
    checkOut: r.checkOut || "-",
    breakIn: r.breakIn || "-",
    breakOut: r.breakOut || "-",
    firstHalfStatusCode: r.firstHalfStatusCode,
    firstHalfStatus: leaveLabel(r.firstHalfStatusDescription),
    secondHalfStatusCode: r.secondHalfStatusCode,
    secondHalfStatus: leaveLabel(r.secondHalfStatusDescription),
    remarks: r.remarks || "",
  };
}

export async function getAttendanceLog({ empNo, fromDate, toDate }) {
  const data = await controller.logs({ empNo: empNo || undefined, fromDate, toDate });
  return (data ?? []).map(toAttendanceLogRow);
}

// Real AMSBackendAPI call backing the 6-card Present/Early Exit/Late/Absent/On Duty/Forgot to
// Swipe stat row shared by HomePage ("My Attendance") and AttendancePage — counts are
// computed by dbo.spv1_GetAttendanceStatsSummary, NOT derived client-side from the attendance log
// rows the way the old monthStats/stats useMemos used to (those client computations have been
// removed entirely).
//
// RECONCILED contract (confirmed against the real backend):
//   GET /attendance/summary   query: empNo, fromDate, toDate   — exactly ONE @EmpNo per
//     call, same shape as /attendance/log (NOT a bulk empNos[] call, despite that being the
//     original assumption here) — a manager's "My Reportees" scope fires one call per reportee in
//     parallel and sums the six counts client-side, mirroring getAttendanceLog's own
//     one-empNo-per-call convention exactly (see useAttendanceLogsForEmployees above).
//     -> { data: { presentCount, earlyExitCount, lateCount, absentCount, onDutyCount,
//                   forgotToSwipeCount } }
// (dates are inclusive yyyy-MM-dd, same convention as /attendance/log's fromDate/toDate).
function toAttendanceStatsSummary(r) {
  return {
    present: r.present ?? r.presentCount ?? 0,
    earlyExit: r.earlyExit ?? r.earlyExitCount ?? 0,
    late: r.late ?? r.lateCount ?? 0,
    absent: r.absent ?? r.absentCount ?? 0,
    onDuty: r.onDuty ?? r.onDutyCount ?? 0,
    forgotToSwipe: r.forgotToSwipe ?? r.forgotToSwipeCount ?? 0,
  };
}

export async function getAttendanceStatsSummary({ empNo, fromDate, toDate }) {
  const data = await controller.summary({ empNo: empNo || undefined, fromDate, toDate });
  return toAttendanceStatsSummary(data || {});
}
