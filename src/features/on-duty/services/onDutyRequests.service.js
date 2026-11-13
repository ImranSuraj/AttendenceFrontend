import * as controller from "../controllers/onDutyRequests.controller";
import { titleCase } from "@/shared/utils/text";
import { SESSION_TO_REQUEST_CODE } from "@/features/leave/leave.constants";
import { toTableRow } from "@/features/leave/services/leaveRows";

export async function applyOnDutyRequest({ place, remarks, dates, authPersonEmpNo }) {
  const body = {
    leaveType: "OD",
    place,
    remarks: remarks || null,
    dates: dates.map(d => ({ date: d.date, session: SESSION_TO_REQUEST_CODE[d.session] ?? "ES" })),
    authPerson: authPersonEmpNo,
  };
  return controller.apply(body);
}

// approvalStatusDescription is NULL for a still-pending row (the backend's own CASE has no branch
// for that state, only Approved/Cancelled/Rejected) -- "Pending" is the correct fallback rather
// than showing a blank status. Display-only; the backend/stored procedure is untouched.
export async function getOnDutyMine(fromDate, toDate) {
  const items = (await controller.mine({ fromDate, toDate })) ?? [];
  return items.map(r => toTableRow("onduty", r.requestNo, {
    leaveNumber: String(r.requestNo), employeeId: r.requestorEmpNo, employeeName: r.requestor,
    leaveType: "On Duty", session: undefined, fromDate: r.fromDate, toDate: r.toDate, days: r.noOfDays,
    approver: r.approverName, status: titleCase(r.approvalStatusDescription) || "Pending",
    place: r.place, remarks: r.remarks, createdOn: r.createdOn, actionDate: r.authDate,
  }));
}

export async function getOnDutyPending(fromDate, toDate) {
  const items = (await controller.pendingApproval({ fromDate, toDate })) ?? [];
  return items.map(r => toTableRow("onduty", r.requestNo, {
    leaveNumber: String(r.requestNo), employeeId: r.requestorEmpNo, employeeName: r.requestor,
    leaveType: "On Duty", session: undefined, fromDate: r.fromDate, toDate: r.toDate, days: r.noOfDays,
    approver: r.approverName, status: titleCase(r.approvalStatusDescription) || "Pending",
    place: r.place, remarks: r.remarks, createdOn: r.createdOn, actionDate: r.authDate,
  }));
}
