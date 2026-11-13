import * as controller from "../controllers/forgotToSwipeRequests.controller";
import { titleCase } from "@/shared/utils/text";
import { SESSION_TO_REQUEST_CODE, REQUEST_CODE_TO_SESSION, FTS_STATUS_CODE_TO_LABEL } from "@/features/leave/leave.constants";
import { toTableRow } from "@/features/leave/services/leaveRows";

export async function applyForgotToSwipeRequest({ reason, remarks, date, session, authPersonEmpNo }) {
  const body = {
    reason,
    remarks: remarks || null,
    dates: [{ date, session: SESSION_TO_REQUEST_CODE[session] ?? "ES" }],
    authPerson: authPersonEmpNo,
  };
  return controller.apply(body);
}

export async function getFtsMine(fromDate, toDate) {
  const items = (await controller.mine({ fromDate, toDate })) ?? [];
  return items.map(r => toTableRow("fts", r.requestNo, {
    leaveNumber: String(r.requestNo), employeeName: undefined, leaveType: "Forgot to Swipe",
    session: REQUEST_CODE_TO_SESSION[r.session?.trim()] ?? r.session, fromDate: r.requestDate, toDate: r.requestDate, days: 1,
    approver: r.approvalPerson, status: titleCase(r.status), reason: r.reason, remarks: r.remarks, createdOn: r.createdDate, actionDate: r.actionDate,
  }));
}

export async function getFtsPending(fromDate, toDate) {
  const items = (await controller.pendingApproval({ fromDate, toDate })) ?? [];
  return items.map(r => toTableRow("fts", r.requestNo, {
    leaveNumber: String(r.requestNo), employeeId: r.requestorEmpNo, employeeName: r.requestor,
    leaveType: "Forgot to Swipe", session: REQUEST_CODE_TO_SESSION[r.session?.trim()] ?? r.session,
    fromDate: r.requestDate, toDate: r.requestDate, days: 1,
    approver: undefined, status: FTS_STATUS_CODE_TO_LABEL[r.statusCode?.trim()] ?? titleCase(r.statusCode),
    reason: r.reason, remarks: r.remarks, createdOn: r.createdDate, actionDate: r.actionDate,
  }));
}
