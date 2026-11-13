// Real AMSBackendAPI integration for the Leaves page's Apply/Approve/Reject/Cancel/
// listing/balance flows — leave.mock.js/leave.service.js (the old fully-mock equivalents) have
// since been removed entirely; every consumer of Leave data now goes through this file.
//
// The backend splits what this page shows as one "Leave Requests" table into 3 separate
// verticals (Casual/Privilege Leave, On-Duty, Forgot-to-Swipe) with 3 different session-code
// vocabularies and DTO shapes — every function below is tagged with which vertical it talks to,
// and toTableRow() below normalizes all 3 shapes into the one row shape LeavePage's table expects.
import * as leaveController from "../controllers/leaveRequests.controller";
import * as onDutyController from "@/features/on-duty/controllers/onDutyRequests.controller";
import * as forgotToSwipeController from "@/features/forgot-to-swipe/controllers/forgotToSwipeRequests.controller";
import { toDate as parseDate } from "@/shared/utils/date";
import { SESSION_TO_LEAVE_CODE, SESSION_TO_REQUEST_CODE } from "@/features/leave/leave.constants";
import { getLeaveMine, getLeavePending } from "./leaveRequests.service";
import { getOnDutyMine, getOnDutyPending } from "@/features/on-duty/services/onDutyRequests.service";
import { getFtsMine, getFtsPending } from "@/features/forgot-to-swipe/services/forgotToSwipeRequests.service";

// Which backend controller serves each request type (source: leave | onduty | fts).
const CONTROLLER_BY_SOURCE = { leave: leaveController, onduty: onDutyController, fts: forgotToSwipeController };

// ---- Manage (Approve/Reject/Cancel) ----------------------------------------------------------

export async function manageRequest({ source, requestNo, action, requestorEmpNo }) {
  await CONTROLLER_BY_SOURCE[source].manage(requestNo, action.toLowerCase(), { requestorEmpNo });
}

// ---- Edit (Manager-facing, still-Pending requests only) --------------------------------------
// One shared entry point across all 3 verticals, dispatching on `source` (see LEAVE_TYPE_VERTICAL
// above for the same idea on Apply) — LeavePage's Manage Request modal calls this uniformly and
// lets this file translate each vertical's own field/session-code shape.

export async function editRequest({ source, requestNo, requestorEmpNo, fields }) {
  const body = source === "leave" ? {
    requestorEmpNo,
    fromDate: fields.fromDate, toDate: fields.toDate,
    dates: fields.dates.map(d => ({ date: d.date, session: SESSION_TO_LEAVE_CODE[d.session] ?? null })),
    remarks: fields.remarks || null,
  } : source === "onduty" ? {
    requestorEmpNo,
    place: fields.place, remarks: fields.remarks || null,
    dates: fields.dates.map(d => ({ date: d.date, session: SESSION_TO_REQUEST_CODE[d.session] ?? "ES" })),
  } : {
    requestorEmpNo,
    date: fields.date, session: SESSION_TO_REQUEST_CODE[fields.session] ?? "ES",
    reason: fields.reason, remarks: fields.remarks || null,
  };
  await CONTROLLER_BY_SOURCE[source].edit(requestNo, body);
}

function defaultDateRange() {
  const today = new Date();
  const from = new Date(today); from.setDate(from.getDate() - 365);
  const to = new Date(today); to.setDate(to.getDate() + 90);
  const iso = d => d.toISOString().split("T")[0];
  return { fromDate: iso(from), toDate: iso(to) };
}

// scope: "mine" | "pending" — fromDate/toDate apply to BOTH: the 3 procs match them against each
// request's creation date ("Created On"), for my own requests and my approval queue alike.
export async function getLiveLeaveRequests(scope, fromDate, toDate) {
  const range = fromDate && toDate ? { fromDate, toDate } : defaultDateRange();
  const calls = scope === "pending"
    ? [getLeavePending(range.fromDate, range.toDate), getOnDutyPending(range.fromDate, range.toDate), getFtsPending(range.fromDate, range.toDate)]
    : [getLeaveMine(range.fromDate, range.toDate), getOnDutyMine(range.fromDate, range.toDate), getFtsMine(range.fromDate, range.toDate)];

  const results = await Promise.allSettled(calls);
  const rows = results.filter(r => r.status === "fulfilled").flatMap(r => r.value);
  // Each of the 3 verticals (leave/onduty/fts) is already sorted newest-first on its own, but
  // simply concatenating 3 independently-sorted lists doesn't produce one globally newest-first
  // list -- e.g. a Forgot-to-Swipe request submitted seconds ago would still land at the very
  // bottom of the merged table, after every Leave and On-Duty row. Re-sorting the merged list by
  // createdOn (falling back to fromDate for any row somehow missing it) makes the latest request
  // across all 3 types appear first, matching every other table in this app.
  return rows.sort((a, b) => (parseDate(b.createdOn ?? b.fromDate)?.getTime() ?? 0) - (parseDate(a.createdOn ?? a.fromDate)?.getTime() ?? 0));
}
