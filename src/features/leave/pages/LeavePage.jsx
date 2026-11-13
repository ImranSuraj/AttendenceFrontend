import { useState, useMemo, useEffect, useRef } from "react";
import { Users, Calendar, Plus, RefreshCw, Trash2, Eye, Pencil } from "lucide-react";
import { useHasExactRole } from "@/shared/access/access.store";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { LEAVE_TYPES, LEAVE_SESSIONS, FORGOT_TO_SWIPE_REASONS } from "@/features/leave/leave.constants";
import { Modal, FormField, inputCls } from "@/shared/components/Modal";
import { Btn } from "@/shared/components/Btn";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { LeaveTypeBadge } from "../components/LeaveTypeBadge";
import { DataTable } from "@/shared/components/DataTable";
import { Spinner } from "@/shared/components/Spinner";
import { formatDate, toIsoDate, currentMonthRange } from "@/shared/utils/date";
import { validateApplyLeaveForm, validateManageEditForm } from "../leave.validators";
import { useLiveLeaveRequestsQuery, useLiveLeaveMutations, useApplyDatesQuery } from "../hooks/useLeaveRequestsQuery";
import { useReporteeLeaveBalances } from "../hooks/useLeaveBalanceQuery";
import { useMyApproversQuery } from "../hooks/useLeaveApproversQuery";
import { REQUEST_ACTIONS } from "@/features/leave/leave.constants";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";
import { getEmpNo } from "@/shared/auth/auth.store";
import { useCurrentUser, useLiveMyReporteesState } from "@/features/employees";
import { CountUp } from "@/shared/components/CountUp";
import { useNavIntent } from "@/shared/navigation/navIntent";
import { emailLinkRange } from "@/shared/navigation/deepLink";

function datesInRange(startRaw, endRaw) {
  const start = toIsoDate(startRaw);
  const end = toIsoDate(endRaw);
  if (!start || !end || end < start) return [];
  const dates = [];
  const d = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (d <= last) {
    dates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Every request type here (Casual / Privilege leave, On Duty, Forgot to Swipe): a Sunday cannot be selected and is not counted inside a range.
// Saturdays and holidays are allowed (holidays change at short notice).
const isSundayIso = (iso) => new Date(`${iso}T00:00:00`).getDay() === 0;
const withoutSundays = (dates) => dates.filter(d => !isSundayIso(d));

// Half-day rule of the chatbot leave service for Privilege Leave: the FIRST date may be the full day or the 2nd session, the LAST date the full day or the 1st session, and
// every date in between is a full day. Casual Leave has no such limit (any session on any date). The server checks the same rule.
function sessionChoices(date, dates) {
  if (dates.length === 0) return LEAVE_SESSIONS;
  const first = dates[0], last = dates[dates.length - 1];
  const allowed = ["Full Session"];
  if (date === first && date !== last) allowed.push("2nd Session");
  if (date === last && date !== first) allowed.push("1st Session");
  return LEAVE_SESSIONS.filter(s => allowed.includes(s));
}const keepAllowed = (current, choices) => (current && choices.includes(current) ? current : LEAVE_SESSIONS[2]);

const emptyApplyForm = {
  leaveType: LEAVE_TYPES[0],
  startDate: "", endDate: "", reason: "",
  singleDate: "", session: LEAVE_SESSIONS[2], forgotReason: "",
  // On Duty only — the real backend still requires a Place. Reason Code was dropped from this form
  // (never part of the legacy On-Duty entry screen) — the backend now hardcodes the real On-Duty
  // reason code (999) itself since this app never offers the WFH alternative that field used to
  // distinguish.
  place: "",
  // Required on every leave type — populated from the real Approver_Master Level 1/Level 2
  // mapping (spv1_GetLeaveApprovers), defaulting to Level 1 once loaded.
  authPerson: "",
};

export default function LeavePage() {
  return (
    <div className="flex flex-col gap-4">
      <LeaveRequestsSection />
    </div>
  );
}

function LeaveRequestsSection() {
  const CURRENT_USER = useCurrentUser();
  // Real reportee identities (LeaveBalanceController now supports a manager viewing a verified
  // reportee's balance) — safe to use live here since this section's own data (requests, balance)
  // is already 100% real, unlike ServiceDeskPage's shared mock useMyReportees().
  const { data: MY_REPORTEES, ready: reporteesReady } = useLiveMyReporteesState();

  const [tab, setTab] = useState("Pending");
  const [typeFilter, setTypeFilter] = useState("");
  // Defaults to the current month so far (1st through today). The frontend decides this window;
  // spv1_GetLeaveRequests / spv1_GetOnDutyRequests / spv1_GetForgotToSwipeRequests match it
  // against each request's CREATION date (the "Created On" column), not its leave dates -- for
  // both My Requests and My Reportees (the approver's pending queue).
  // Reset returns to this same default rather than clearing to an open range.
  const DEFAULT_RANGE = currentMonthRange();
  const [fromDate, setFromDate] = useState(DEFAULT_RANGE.fromDate);
  const [toDate, setToDate] = useState(DEFAULT_RANGE.toDate);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [viewLeave, setViewLeave] = useState(null);
  const [applyForm, setApplyForm] = useState(emptyApplyForm);
  // Client-side validation messages, shown in red under their field. Cleared as soon as the person changes anything.
  // (Messages returned by the backend are NOT shown here — they come up as toasts.)
  const [applyErrors, setApplyErrors] = useState({});
  const [manageErrors, setManageErrors] = useState({});
  const [dateSessions, setDateSessions] = useState({});
  const [pendingManage, setPendingManage] = useState(null); // { requestNo, action } — which row's Approve/Reject/Cancel is in flight
  const [confirmCancelRow, setConfirmCancelRow] = useState(null); // row pending a Cancel confirmation (table's own "My Requests" Cancel button)
  const [confirmReject, setConfirmReject] = useState(false); // true while the manager's View & Manage modal is asking to confirm Reject

  // Manager's "View & Manage" modal — replaces the old bare Approve/Reject icons for a pending
  // team row with one modal that shows full details + remarks, and lets the manager Approve,
  // Reject, or Edit the request's own fields before deciding, across all 4 leave types.
  const [manageRow, setManageRow] = useState(null);
  const [manageMode, setManageMode] = useState("view"); // "view" | "edit"
  const [ownEdit, setOwnEdit] = useState(false); // true = the applicant is editing their own pending request (no Approve / Reject; Back closes the window)
  const [manageForm, setManageForm] = useState(null);
  const [manageDateSessions, setManageDateSessions] = useState({});

  const { data: approvers, isLoading: approversLoading } = useMyApproversQuery();
  // Default to Level 1 (approvers[0], since spv1_GetLeaveApprovers/getMyApprovers always order
  // Level 1 before Level 2) as soon as the list loads, but only if the user hasn't already picked
  // something (don't clobber a deliberate Level 2 selection on a background refetch).
  useEffect(() => {
    if (approvers.length > 0 && !applyForm.authPerson) {
      setApplyForm(f => ({ ...f, authPerson: approvers[0].empNo }));
    }
    // applyForm.authPerson is a dependency on purpose (not just approvers) — resetApplyForm()
    // clears it back to "" after every submit/close, and without re-running this effect then, the
    // dropdown would only ever auto-select once per page load instead of every time the form
    // resets. The `!applyForm.authPerson` guard keeps this a safe fixed point (re-defaulting stops
    // as soon as a value is set) rather than an infinite loop.
  }, [approvers, applyForm.authPerson]);

  const isRangeType = applyForm.leaveType !== "Forgot to Swipe";

  // Any date can be picked. Once the dates are chosen the database is asked (usp_v1_GetLeaveApplyDates) which dates of the range can be chosen
  // (a working day with nothing already taken), which sessions each allows, and whether the range can be applied at all (day limits, balance ...).
  const lookupFrom = toIsoDate(isRangeType ? applyForm.startDate : applyForm.singleDate);
  const lookupTo = toIsoDate(isRangeType ? applyForm.endDate : applyForm.singleDate);
  const lookupReady = showApply && !!lookupFrom && !!lookupTo && lookupTo >= lookupFrom;
  const { data: applyDates, isFetching: applyDatesLoading } = useApplyDatesQuery(applyForm.leaveType, lookupFrom, lookupTo, lookupReady);
  const applyDatesMessage = lookupReady && !applyDatesLoading && applyDates && applyDates.resultCode !== 0 ? applyDates.message : "";
  const choosableDates = useMemo(
    () => (lookupReady && applyDates ? applyDates.dates.filter(d => d.canFullDay || d.canFirstHalf || d.canSecondHalf) : []),
    [lookupReady, applyDates]);
  // The sessions the database allows on each date: the full day first (the default), then the halves.
  const sessionOptionsByDate = useMemo(() => {
    const map = {};
    choosableDates.forEach(d => {
      const options = [];
      if (d.canFullDay) options.push(LEAVE_SESSIONS[2]);
      if (d.canFirstHalf) options.push(LEAVE_SESSIONS[0]);
      if (d.canSecondHalf) options.push(LEAVE_SESSIONS[1]);
      map[d.leaveDate] = options;
    });
    return map;
  }, [choosableDates]);
  const rangeDates = useMemo(() => (isRangeType ? choosableDates.map(d => d.leaveDate) : []), [isRangeType, choosableDates]);

  useEffect(() => {
    if (!isRangeType) return;
    setDateSessions(prev => {
      const next = {};
      rangeDates.forEach(d => { const options = sessionOptionsByDate[d] ?? []; next[d] = options.includes(prev[d]) ? prev[d] : (options[0] ?? LEAVE_SESSIONS[2]); });
      return next;
    });
  }, [rangeDates, isRangeType, sessionOptionsByDate]);

  // Forgot to Swipe: one date, one session - the sessions the database allows on that date.
  const swipeSessionOptions = useMemo(() => (!isRangeType && applyForm.singleDate ? sessionOptionsByDate[toIsoDate(applyForm.singleDate)] ?? [] : []),
    [isRangeType, applyForm.singleDate, sessionOptionsByDate]);
  useEffect(() => {
    if (isRangeType || swipeSessionOptions.length === 0 || swipeSessionOptions.includes(applyForm.session)) return;
    setApplyForm(f => ({ ...f, session: swipeSessionOptions[0] }));
  }, [isRangeType, swipeSessionOptions, applyForm.session]);


  // "My Reportees" now means "requests awaiting MY approval" (spv1_Get*Requests' PENDING_APPROVAL
  // scope, keyed by AuthPerson = CURRENT_USER) rather than the mock model's "any reportee's request
  // regardless of status" — a real approval queue, matching what Approve/Reject actually operate on.
  //
  // isManager therefore can't be gated on MY_REPORTEES (empmast.mgr_no org-chart reportees) alone —
  // Approver_Master is a genuinely separate real relation (confirmed live: empno 3843 approves
  // 3663's requests and has real pending items, but has ZERO mgr_no reportees) — an org-chart
  // manager with no reportees would never see this page's own approval queue otherwise. Both
  // "mine" and "pending" are fetched unconditionally so a real approver whose queue is non-empty
  // is detected even with 0 reportees, and the active scope just picks which result set to render.
  const { data: rawMine, isFetching: mineLoading } = useLiveLeaveRequestsQuery("mine", fromDate, toDate);
  const { data: rawPending, isFetching: pendingLoading } = useLiveLeaveRequestsQuery("pending", fromDate, toDate);
  // The Reportees tab depends only on Approver_Master (MY_REPORTEES = the people whose Appr1 is me). Old requests that were once addressed to me do not keep the tab alive.
  const isManager = MY_REPORTEES.length > 0;
  // The page always opens on My Requests, even for a manager; a mail link / notification switches it to the right tab.
  const [pickedScope, setScope] = useState(null);
  const scope = pickedScope ?? "mine";

  // "My Reportees' Leave Balance" — same widened identity as isManager above: not just mgr_no
  // reportees, but every distinct requestor currently in MY pending-approval queue (confirmed
  // live: empno 3843 approves for 3663, who is not a mgr_no reportee — LeaveBalanceController's
  // own authorization now re-verifies this same Approver_Master relationship server-side, so this
  // isn't just a display-side union). Pending rows only carry employeeId/employeeName (no
  // designation/department — those come from toEmployeeRow(), never fetched for a non-reportee
  // requestor to avoid an extra profile call per row), so those two fields are blank for a
  // pending-only entry rather than fabricated.
  const balanceTargets = useMemo(() => {
    const byId = new Map(MY_REPORTEES.map(e => [e.id, e]));
    rawPending.forEach(r => {
      // Only a request still WAITING for this approver adds its requestor: the queue also holds approved / rejected / cancelled requests, and someone whose old
      // requests were once addressed to this person is not their reportee.
      if (r.status !== "Pending") return;
      // Trimmed defensively — spv1_GetLeaveRequests' pending-approval RequestorEmpNo was found
      // live to come back padded ("3663      ", from a fixed-width empno column) while On-Duty/
      // FTS's own RequestorEmpNo was already trimmed, so the SAME real employee produced two
      // different Map keys and appeared twice in this modal. Fixed at the SQL source too, but
      // this stays defensive so any future untrimmed source can't reintroduce the same bug.
      const id = r.employeeId?.trim ? r.employeeId.trim() : r.employeeId;
      if (id && !byId.has(id)) {
        byId.set(id, { id, name: r.employeeName || id, designation: "", department: "" });
      }
    });
    return [...byId.values()];
  }, [MY_REPORTEES, rawPending]);

  // Fetched only while the window is open, so every opening shows the balances as they are in the database right now.
  const balanceYear = new Date().getFullYear(); // the balances (here and in the own-balance window) are for the current calendar year; the title shows it
  const reporteeBalanceResults = useReporteeLeaveBalances(
    useMemo(() => balanceTargets.map(e => e.id), [balanceTargets]),
    balanceYear,
    showTeamModal
  );
  // The modal shows a spinner until every reportee's balance has come back (one request per reportee).
  const reporteeBalancesLoading = pendingLoading || reporteeBalanceResults.some(r => r.isLoading);
  const reporteeBalances = useMemo(() =>
    // Someone the server says does not exist / is inactive / is not this manager's to see is simply not listed (no message).
    balanceTargets.map(emp => { const r = reporteeBalanceResults.find(x => x.empNo === emp.id); return { emp, balances: r?.balances || [], unavailable: !!r?.unavailable, skip: !!r?.skip }; }).filter(r => !r.skip),
    [balanceTargets, reporteeBalanceResults]
  );

  const liveScope = scope === "team" && isManager ? "pending" : "mine";
  const rawLeaves = liveScope === "pending" ? rawPending : rawMine;
  const leavesLoading = liveScope === "pending" ? pendingLoading : mineLoading;
  const LIVE = useLiveLeaveMutations();

  // Reportees Requests has no Cancelled tab (and no cancelled rows): a reportee cancelling their own request is not the approver's concern.
  const scoped = useMemo(() => rawLeaves.filter(r => liveScope !== "pending" || r.status !== "Cancelled").map(r => ({
    ...r,
    employeeId: r.employeeId ?? CURRENT_USER.id,
    employeeName: r.employeeName ?? CURRENT_USER.name,
    // The Leave/Forgot-to-Swipe "pending approval" listings don't return an approver name column
    // at all (the PENDING_APPROVAL scope is by definition "assigned to ME", so the value is always
    // the current viewer) — On-Duty's own listing does return a real ApproverName either way, so
    // this only fills the gap rather than overriding real data.
    approver: r.approver ?? (liveScope === "pending" ? CURRENT_USER.name : r.approver),
  })), [rawLeaves, CURRENT_USER, liveScope]);

  const filtered = useMemo(() => scoped.filter(l =>
    l.status === tab &&
    (!typeFilter || l.leaveType === typeFilter)
  ), [scoped, tab, typeFilter]);

  // Opened from a header-bell notification: switch to the right list (the approval queue for "Approval
  // Pending", My Requests otherwise), then -- once that list has loaded -- open the request the
  // notification is about (the Approve/Reject window for a pending approval, the details window otherwise).
  const navIntent = useNavIntent(s => s.intent);
  const clearNavIntent = useNavIntent(s => s.clear); // also called when the person clicks a tab or a balance button themselves: a notification jump still waiting for the lists must not override that
  const intentStage = useRef("first"); // "first" = the list the link points at; "fallback" = My Requests, tried when the request is not one waiting on them
  useEffect(() => {
    if (navIntent?.module !== "leave") return;
    intentStage.current = "first";
    // No request named (plain sidebar open): always My Requests. A request link / notification still opens the tab its request is in.
    setScope(navIntent.requestNo == null ? "mine" : (navIntent.scope ?? "mine"));
    setTab("Pending");
    setTypeFilter("");
    // A link / notification that names a request (the list starts on the current month): widen the dates (3 months back to the end of next year) so the request is in it.
    if (navIntent.requestNo != null) {
      const range = emailLinkRange();
      setFromDate(range.fromDate);
      setToDate(range.toDate);
    }
  }, [navIntent]);
  useEffect(() => {
    if (navIntent?.module !== "leave") return;
    // Opened from the sidebar with no request to open (just "you have items on the Reportees tab"): the effect above has already chosen the tab and there is nothing to look
    // for. Without this, the lookup below found no request and then "fell back" to the other tab -- a manager landed on My Reportees and was moved to My Requests.
    if (navIntent.requestNo == null) { clearNavIntent(); return; }
    if (mineLoading || pendingLoading) return;
    if (navIntent.fromEmail) {
      // A mail link is the same for everyone on the mail, so the tab follows who the request belongs to: my own request opens in My Requests, anyone else's in Reportees Requests.
      if (!reporteesReady) return; // whether I am an approver is not known yet
      const sameNo = r => String(r._requestNo) === String(navIntent.requestNo);
      const target = rawMine.some(sameNo) ? "mine" : (isManager && rawPending.some(sameNo) ? "pending" : "mine");
      if (liveScope !== target) { setScope(target === "pending" ? "team" : "mine"); return; }
      const mailRow = scoped.find(sameNo);
      if (mailRow) {
        if (liveScope === "pending" && mailRow.status === "Pending") openManage(mailRow);
        else setViewLeave(mailRow);
      } else toast.info(`Request ${navIntent.requestNo} is not in the selected date range.`);
      clearNavIntent();
      return;
    }
    // A notification already says which list its request is in.
    const primary = navIntent.scope === "team" && isManager ? "pending" : "mine";
    const other = primary === "pending" ? "mine" : (isManager ? "pending" : null);
    const wanted = intentStage.current === "first" ? primary : other;
    if (liveScope !== wanted) return; // the scope switch above hasn't been applied yet
    const row = navIntent.requestNo != null
      ? scoped.find(r => String(r._requestNo) === String(navIntent.requestNo))
      : null;
    if (!row && intentStage.current === "first" && other && navIntent.fromEmail) { intentStage.current = "fallback"; setScope(other === "pending" ? "team" : "mine"); return; }
    if (row) {
      if (liveScope === "pending" && row.status === "Pending") openManage(row);
      else setViewLeave(row);
    } else if (navIntent.fromEmail) {
      toast.info(`Request ${navIntent.requestNo} is not in the selected date range.`);
    }
    clearNavIntent();
  }, [navIntent, mineLoading, pendingLoading, liveScope, isManager, scoped, reporteesReady, rawMine, rawPending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every status a request can actually end up in across all 3 verticals (Leave/On-Duty/
  // Forgot-to-Swipe): Pending -> Approved / Rejected / Cancelled. "Approved" covers the identical
  // approved-and-done outcome across all 3 types -- Leave/FTS's own legacy vocabulary called this
  // "Completed" while On-Duty called it "Approved"; the backend now unifies on "Approved" (see
  // liveLeave.service.js's status-label maps), so one tab covers all 3 instead of splitting the
  // same real-world state across two tabs. A tab used to be missing for Cancelled entirely too, so
  // any cancelled request had nowhere to move to and stayed stuck under "All" only.
  const STATUS_TABS = liveScope === "pending" ? ["Pending","Approved","Rejected"] : ["Pending","Approved","Rejected","Cancelled"];
  useEffect(() => { if (!STATUS_TABS.includes(tab)) setTab("Pending"); }, [liveScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => ({
    Pending: scoped.filter(l=>l.status==="Pending").length,
    Approved: scoped.filter(l=>l.status==="Approved").length,
    Rejected: scoped.filter(l=>l.status==="Rejected").length,
    Cancelled: scoped.filter(l=>l.status==="Cancelled").length,
  }), [scoped]);

  const sessionSummary = (r) => {
    if (r.session) return r.session;
    if (r.dateSessions) {
      const vals = Object.values(r.dateSessions);
      return vals.length > 1 ? `${vals.length} dates` : (vals[0] || "Full Session");
    }
    return "Full Session";
  };

  // A blank value shows as "-".
  const dash = (v) => (v === undefined || v === null || String(v).trim() === "" ? "-" : v);
  const dateOrDash = (v) => dash(v ? formatDate(v) : "");

  // The Employee column is for a manager looking at the reportees' requests; a person's own requests do not need it. The Approver column is not shown at all
  // (it stays in the Excel export).
  const showEmployee = scope === "team" && isManager;
  const cols = [
    { key:"leaveNumber", label:"Leave No.", render: r => dash(r.leaveNumber) },
    { key:"status", label:"Status", render: r => <StatusBadge status={r.status}/> },
    { key:"createdOn", label:"Created On", render: r => dateOrDash(r.createdOn) },
    ...(showEmployee ? [{ key:"employeeName", label:"Employee", render: r => dash(r.employeeName) }] : []),
    { key:"leaveType", label:"Leave Type", render: r => <LeaveTypeBadge type={r.leaveType}/> },
    { key:"session", label:"Session", render: r => dash(sessionSummary(r)) },
    { key:"fromDate", label:"From Date", render: r => dateOrDash(r.fromDate), sortValue: r => toIsoDate(r.fromDate) },
    { key:"toDate", label:"To Date", render: r => dateOrDash(r.toDate), sortValue: r => toIsoDate(r.toDate) },
    { key:"days", label:"Days", render: r => <span className="font-semibold">{dash(r.days)}</span> },
    // The tab decides the extra date column: Approved / Rejected / Cancelled Date (nothing for Pending).
    ...(tab === "Pending" ? [] : [{ key:"actionDate", label:`${tab} Date`, render: r => dateOrDash(r.actionDate), sortValue: r => toIsoDate(r.actionDate) }]),
  ];

  // Excel (HRAdmin only): every request in the chosen dates and leave type, whatever tab is open, with the employee and the approver too.
  const canExport = useHasExactRole("HRAdmin");
  const exportCols = [
    { key:"leaveNumber", label:"Leave No.", render: r => dash(r.leaveNumber) },
    { key:"status", label:"Status", render: r => dash(r.status) },
    { key:"createdOn", label:"Created On", render: r => dateOrDash(r.createdOn) },
    { key:"employeeName", label:"Employee", render: r => dash(r.employeeName) },
    { key:"leaveType", label:"Leave Type", render: r => dash(r.leaveType) },
    { key:"session", label:"Session", render: r => dash(sessionSummary(r)) },
    { key:"fromDate", label:"From Date", render: r => dateOrDash(r.fromDate) },
    { key:"toDate", label:"To Date", render: r => dateOrDash(r.toDate) },
    { key:"days", label:"Days", render: r => dash(r.days) },
    { key:"approver", label:"Approver", render: r => dash(r.approver) },
    // One generic column for every tab: the date it was approved, rejected or cancelled.
    { key:"actionDate", label:"Action Date", render: r => dateOrDash(r.actionDate) },
  ];
  const exportRows = useMemo(() => scoped.filter(l => !typeFilter || l.leaveType === typeFilter), [scoped, typeFilter]);
  const resetApplyForm = () => {
    setApplyForm(emptyApplyForm);
    setDateSessions({});
    setApplyErrors({});
  };

  useEffect(() => { setApplyErrors({}); }, [applyForm, dateSessions]);
  useEffect(() => { setManageErrors({}); }, [manageForm, manageDateSessions]);

  const submitApply = async () => {
    const errors = validateApplyLeaveForm(applyForm, getEmpNo());
    if (Object.keys(errors).length) { setApplyErrors(errors); return; }
    // The database already said (usp_v1_GetLeaveApplyDates) whether the dates can be applied; the same checks run again when the request is saved.
    if (applyDatesLoading || !applyDates) { setApplyErrors({ dates: "Checking the dates, please wait." }); return; }
    if (applyDates.resultCode !== 0) { setApplyErrors({ dates: applyDates.message }); return; }
    if (isRangeType && rangeDates.length === 0) { setApplyErrors({ dates: "No date in this range can be chosen." }); return; }

    try {
      if (applyForm.leaveType === "Forgot to Swipe") {
        await LIVE.applyForgotToSwipe.mutateAsync({
          reason: applyForm.forgotReason, remarks: applyForm.reason || undefined,
          date: applyForm.singleDate, session: applyForm.session, authPersonEmpNo: applyForm.authPerson,
        });
      } else if (applyForm.leaveType === "On Duty") {
        await LIVE.applyOnDuty.mutateAsync({
          place: applyForm.place, remarks: applyForm.reason,
          dates: rangeDates.map(d => ({ date: d, session: dateSessions[d] })), authPersonEmpNo: applyForm.authPerson,
        });
      } else {
        await LIVE.applyLeave.mutateAsync({
          leaveType: applyForm.leaveType, fromDate: applyForm.startDate, toDate: applyForm.endDate,
          dates: rangeDates.map(d => ({ date: d, session: dateSessions[d] })),
          authPersonEmpNo: applyForm.authPerson, remarks: applyForm.reason || undefined,
        });
      }
      setShowApply(false);
      resetApplyForm();
    } catch {
      // The backend's message was already toasted by the api.js interceptor — leave the modal open to retry.
    }
  };

  // "leave"/"onduty" edit forms a Start/End Date range (mirrors Apply's own rangeDates); "fts" is
  // always a single date, no range to compute.
  const manageRangeDates = useMemo(() => {
    if (!manageForm || manageRow?._source === "fts") return [];
    const all = datesInRange(manageForm.fromDate, manageForm.toDate);
    return withoutSundays(all);
  }, [manageForm, manageRow]);

  useEffect(() => {
    if (!manageForm || manageRow?._source === "fts") return;
    setManageDateSessions(prev => {
      const next = {};
      manageRangeDates.forEach(d => { next[d] = keepAllowed(prev[d], manageRow?._source === "leave" && manageRow?.leaveType === "Privilege/Earned Leave" ? sessionChoices(d, manageRangeDates) : LEAVE_SESSIONS); });
      return next;
    });
  }, [manageRangeDates]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fills the Edit form from whatever the listing already returned for this row — On-Duty/Leave
  // listings only return the request's overall date range (not a per-date session breakdown), so
  // re-opening a multi-date request for edit resets each date to "Full Session" rather than
  // recovering the original per-date split, same limitation Apply's own UI already has.
  const openManage = (r) => {
    setOwnEdit(false);
    setManageRow(r);
    setManageErrors({});
    setManageMode("view");
    setManageDateSessions({});
    // Every date the listing gives us is dd/MM/yyyy (the app-wide display format) — a native
    // <input type="date"> only accepts/displays yyyy-MM-dd, so these must be converted here or the
    // date fields render blank despite manageForm actually holding the real value.
    if (r._source === "fts") {
      setManageForm({ date: toIsoDate(r.fromDate), session: r.session || LEAVE_SESSIONS[2], reason: r.reason || "", remarks: r.remarks || "" });
    } else if (r._source === "onduty") {
      setManageForm({ fromDate: toIsoDate(r.fromDate), toDate: toIsoDate(r.toDate), place: r.place || "", remarks: r.remarks || "" });
    } else {
      setManageForm({ fromDate: toIsoDate(r.fromDate), toDate: toIsoDate(r.toDate), remarks: r.remarks || "" });
    }
  };

  // The applicant edits their own still-pending request from My Requests: the same Edit window the approver uses (dates / sessions / remarks; the leave type
  // cannot be changed), opened straight in edit mode.
  const openOwnEdit = (r) => {
    openManage(r);
    setOwnEdit(true);
    setManageMode("edit");
  };

  const manageAction = async (action) => {
    if (!manageRow) return;
    try {
      await LIVE.manage.mutateAsync({ source: manageRow._source, requestNo: manageRow._requestNo, action, requestorEmpNo: manageRow.employeeId });
      setManageRow(null);
      setConfirmReject(false);
    } catch {
      // Toasted by the api.js interceptor — leave the modal (and, for Reject, the confirmation) open to retry.
    }
  };

  const confirmCancel = () => {
    if (!confirmCancelRow) return;
    const r = confirmCancelRow;
    setConfirmCancelRow(null);
    setPendingManage({ requestNo: r._requestNo, action: REQUEST_ACTIONS.CANCEL });
    LIVE.manage.mutate(
      { source: r._source, requestNo: r._requestNo, action: REQUEST_ACTIONS.CANCEL, requestorEmpNo: r.employeeId },
      { onSettled: () => setPendingManage(null) }
    );
  };

  const submitManageEdit = async () => {
    if (!manageRow || !manageForm) return;
    const errors = validateManageEditForm(manageRow._source, manageForm, manageRangeDates.length);
    if (Object.keys(errors).length) { setManageErrors(errors); return; }
    const fields = manageRow._source === "fts"
      ? { date: manageForm.date, session: manageForm.session, reason: manageForm.reason, remarks: manageForm.remarks }
      : {
          fromDate: manageForm.fromDate, toDate: manageForm.toDate, remarks: manageForm.remarks,
          dates: manageRangeDates.map(d => ({ date: d, session: manageDateSessions[d] })),
          ...(manageRow._source === "onduty" ? { place: manageForm.place } : {}),
        };
    try {
      await LIVE.edit.mutateAsync({ source: manageRow._source, requestNo: manageRow._requestNo, requestorEmpNo: manageRow.employeeId, fields });
      setManageRow(null);
    } catch {
      // Toasted by the api.js interceptor — leave the modal open to retry.
    }
  };

  const statusTabs = (
    <div className="flex gap-1 flex-wrap teams-tablist max-w-full">
      {STATUS_TABS.map(t => (
        <button key={t} onClick={() => setTab(t)}
          className={cn("py-1.5 px-3 max-md:h-[32px] text-sm font-medium rounded-md transition-colors text-muted-foreground bg-transparent border-none cursor-pointer hover:text-foreground", tab===t && "bg-card shadow text-foreground")}>
          {t} <span className="ml-1 text-xs opacity-70 dark:opacity-100">({counts[t]})</span>
        </button>
      ))}
    </div>
  );
  const resetLeaveFilters = () => { setTypeFilter(""); setFromDate(DEFAULT_RANGE.fromDate); setToDate(DEFAULT_RANGE.toDate); };
  const leaveFilterCount = (typeFilter ? 1 : 0) + (fromDate !== DEFAULT_RANGE.fromDate || toDate !== DEFAULT_RANGE.toDate ? 1 : 0);
  const dateAndTypeControls = (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground">From Date</label>
        <DatePickerCalendar value={fromDate} onChange={v => setFromDate(v)}/>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground">To Date</label>
        <DatePickerCalendar value={toDate} onChange={v => setToDate(v)}/>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-muted-foreground">Leave Type</label>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
          className="border border-border rounded-md py-1.5 px-3 text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-ring min-w-[150px]">
          <option value="">All Types</option>
          {LEAVE_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
    </>
  );
  return (
    <div className="flex flex-col gap-4">
      {/* The Reportees/My switch and the action buttons share this row, on the right. */}
      <div className={cn("flex items-center justify-between flex-wrap gap-x-4 gap-y-2", "animate-fade-in-up")} style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap items-center gap-2 ml-auto max-md:ml-0 max-md:w-full max-md:flex-col max-md:items-stretch">
        {isManager && (
          <div className="flex gap-1 teams-tablist w-fit max-md:w-full">
            <button onClick={() => { clearNavIntent(); setScope("team"); }}
              className={cn("flex items-center gap-1.5 py-1.5 px-4 text-sm font-medium rounded-md transition-colors border-none cursor-pointer",
                scope==="team" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
              <Users size={13}/> Reportees Requests
            </button>
            <button onClick={() => { clearNavIntent(); setScope("mine"); }}
              className={cn("flex items-center gap-1.5 py-1.5 px-4 text-sm font-medium rounded-md transition-colors border-none cursor-pointer",
                scope==="mine" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
              My Requests
            </button>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {isManager && scope === "team" && (
            <Btn variant="secondary" size="sm" onClick={() => { clearNavIntent(); setShowTeamModal(true); }} className="hover-lift max-md:!h-[28px] max-md:!min-h-0 max-md:!px-2 max-md:!text-xs">
              <Users size={14}/> <span className="max-md:hidden">My Reportees' Leave Balance</span><span className="md:hidden">Balance</span>
            </Btn>
          )}
          <Btn variant="primary" size="sm" onClick={() => setShowApply(true)} className="hover-lift max-md:!h-[28px] max-md:!min-h-0 max-md:!px-2 max-md:!text-xs">
            <Plus size={14}/> Apply Leave
          </Btn>
        </div>
        </div>
      </div>

      {/* Merged toolbar (same pattern as ServiceDeskPage's tabs+filters row) — tabs, date range,
          Leave Type, and Reset all in one flex-wrap row instead of two stacked rows, so the table
          sits higher on the page and the row itself wraps cleanly on mobile instead of the two
          rows just stacking taller. */}
      <div className={cn("bg-card rounded-lg border border-border p-3 flex flex-wrap gap-3 items-end", "animate-fade-in-up")} style={{ animationDelay: "120ms" }}>
        <div className="flex flex-col gap-1 max-w-full min-w-0">
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          {statusTabs}
        </div>
        {dateAndTypeControls}
        {leaveFilterCount > 0 && (
          <Btn variant="ghost" size="sm" onClick={resetLeaveFilters}>
            <RefreshCw size={13}/> Reset
          </Btn>
        )}
      </div>
      <div className="animate-fade-in-up" style={{ animationDelay: "180ms" }}>
      {leavesLoading && scoped.length === 0 ? (
        <div className="bg-card rounded-lg border border-border shadow-sm"><Spinner message="Loading leave requests…"/></div>
      ) : (
      <DataTable
        title={scope === "team" && isManager ? "My Reportees' Leave Requests" : "My Leave Requests"}
        columns={cols}
        data={filtered}
        hideExport={!canExport} exportColumns={exportCols} exportData={exportRows} exportFileName="LeaveRequests"
        actions={(row) => {
          const r = row;
          const isRowPending = pendingManage?.requestNo === r._requestNo;
          const canApprove = r.status === "Pending" && scope === "team" && isManager;
          const canCancel = r.status === "Pending" && scope === "mine";
          const spinnerBtn = (
            <span className="p-1.5 inline-flex items-center justify-center text-muted-foreground"><RefreshCw size={14} className="animate-spin"/></span>
          );
          if (isRowPending) return spinnerBtn;
          return canApprove ? (
            <button onClick={() => openManage(r)}
              className="p-1.5 rounded-md text-primary transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary" title="View & Manage"><Eye size={14}/></button>
          ) : canCancel ? (
            <>
              <button onClick={() => setViewLeave(r)} className="p-1.5 rounded-md text-primary transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary" title="View"><Eye size={14}/></button>
              <button onClick={() => openOwnEdit(r)} className="p-1.5 rounded-md text-muted-foreground transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary" title="Edit"><Pencil size={14}/></button>
              <button onClick={() => setConfirmCancelRow(r)}
                className="p-1.5 rounded-md text-red-500 transition-colors bg-transparent border-none cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20" title="Cancel"><Trash2 size={14}/></button>
            </>
          ) : (
            <button onClick={() => setViewLeave(r)} className="p-1.5 rounded-md text-primary transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary" title="View"><Eye size={14}/></button>
          );
        }}
      />
      )}
      </div>

      <Modal open={showTeamModal} onClose={() => setShowTeamModal(false)} title={`My Reportees – Leave Balance (${balanceYear})`} maxWidth="max-w-lg"
        footer={<>
          <Btn variant="secondary" size="sm" onClick={() => setShowTeamModal(false)}>Close</Btn>
        </>}>
        {reporteeBalancesLoading ? (
          <Spinner message="Loading leave balances…"/>
        ) : (
        <div className="-m-2 divide-y divide-border">
          {reporteeBalances.map(({ emp, balances, unavailable }) => (
            <div key={emp.id} className="py-2.5 px-2 flex flex-col gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-[0.625rem] font-bold shrink-0">
                  {emp.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{emp.name}</p>
                  {(emp.designation || emp.department) && (
                    <p className="text-[0.6875rem] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                      {[emp.designation, emp.department].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-10">
                {unavailable && <span className="text-[11px] py-1 px-2 rounded-md bg-secondary text-muted-foreground">Balance not available</span>}
                {balances.map(b => (
                  <span key={b.type} className="text-[11px] py-1 px-2 rounded-md bg-secondary text-secondary-foreground">
                    {b.type}: <span className="font-semibold text-primary">{b.balance}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
          {reporteeBalances.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No reportees found.</p>
          )}
        </div>
        )}
      </Modal>

      <Modal open={showApply} onClose={() => { setShowApply(false); resetApplyForm(); }} title="Apply Leave" maxWidth="max-w-lg"
        closeOnOverlayClick={false}
        footer={<>
          <Btn variant="primary" size="sm" onClick={submitApply}
            loading={LIVE.applyLeave.isPending || LIVE.applyOnDuty.isPending || LIVE.applyForgotToSwipe.isPending}>
            Submit
          </Btn>
          <Btn variant="secondary" size="sm" onClick={() => { setShowApply(false); resetApplyForm(); }}>Cancel</Btn>
        </>}>
        <FormField label="Leave Type" required error={applyErrors.leaveType}>
          <select value={applyForm.leaveType}
            onChange={e => { setApplyForm(f=>({...f, leaveType:e.target.value})); setDateSessions({}); }}
            className={inputCls}>
            {LEAVE_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </FormField>

        {applyForm.leaveType === "Forgot to Swipe" ? (
          <>
            <FormField label="Date" required error={applyErrors.date || applyErrors.dates || applyDatesMessage}>
              <DatePickerCalendar value={applyForm.singleDate} onChange={d=>setApplyForm(f=>({...f, singleDate:d}))}/>
            </FormField>
            {applyForm.singleDate && (
              <>
                <FormField label="Session" required>
                  <select value={applyForm.session} onChange={e=>setApplyForm(f=>({...f, session:e.target.value}))} className={inputCls}>
                    {(swipeSessionOptions.length ? swipeSessionOptions : LEAVE_SESSIONS).map(s=><option key={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="Reason" required error={applyErrors.forgotReason}>
                  <select value={applyForm.forgotReason} onChange={e=>setApplyForm(f=>({...f, forgotReason:e.target.value}))} className={inputCls}>
                    <option value="">Select a reason...</option>
                    {FORGOT_TO_SWIPE_REASONS.map(r=><option key={r}>{r}</option>)}
                  </select>
                </FormField>
              </>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Start Date" required>
                <DatePickerCalendar value={applyForm.startDate} onChange={d=>setApplyForm(f=>({...f, startDate:d}))}/>
              </FormField>
              <FormField label="End Date" required>
                <DatePickerCalendar value={applyForm.endDate} onChange={d=>setApplyForm(f=>({...f, endDate:d}))}/>
              </FormField>
            </div>
            {applyDatesLoading && lookupReady && <p className="text-xs text-muted-foreground -mt-2">Checking the dates…</p>}
            {(applyErrors.dates || applyDatesMessage) && <p className="text-xs text-destructive -mt-2" role="alert">{applyErrors.dates || applyDatesMessage}</p>}
            {applyForm.leaveType === "On Duty" && (
              <FormField label="Place" required error={applyErrors.place}>
                <input value={applyForm.place} onChange={e=>setApplyForm(f=>({...f, place:e.target.value}))}
                  placeholder="Client Site, Bangalore" className={inputCls}/>
              </FormField>
            )}
            {rangeDates.length > 0 && (
              <FormField label={`Session Datewise (${rangeDates.length} day${rangeDates.length>1?"s":""})`}>
                <div className="-mx-1 max-h-[200px] overflow-y-auto flex flex-col gap-1.5 pr-1">
                  {rangeDates.map(d => (
                    <div key={d} className="flex items-center justify-between gap-2 py-1 px-2 rounded-md bg-secondary/40">
                      <span className="text-sm text-foreground">{formatDate(d)}</span>
                      <select value={dateSessions[d] || LEAVE_SESSIONS[2]}
                        onChange={e => setDateSessions(prev => ({ ...prev, [d]: e.target.value }))}
                        className="border border-border rounded-md py-1 px-2 text-xs bg-input-background focus:outline-none focus:ring-2 focus:ring-ring">
                        {(sessionOptionsByDate[d] ?? LEAVE_SESSIONS).map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </FormField>
            )}
          </>
        )}

        {(applyForm.leaveType !== "Forgot to Swipe" || applyForm.singleDate) && (
          <FormField
            label={applyForm.leaveType === "Forgot to Swipe" && applyForm.forgotReason === "Others" ? "Remarks" : "Remarks (optional)"}
            required={applyForm.leaveType === "Forgot to Swipe" && applyForm.forgotReason === "Others"}
            error={applyErrors.remarks}>
            <textarea rows={3} value={applyForm.reason} onChange={e=>setApplyForm(f=>({...f, reason:e.target.value}))}
              placeholder="Remarks..." className={cn(inputCls,"resize-none")}/>
          </FormField>
        )}

        <FormField label="Authorized Person" required error={applyErrors.authPerson}>
          {approversLoading ? (
            <div className={cn(inputCls, "flex items-center gap-2 text-muted-foreground")}>
              <RefreshCw size={14} className="animate-spin"/> Loading approvers…
            </div>
          ) : approvers.length === 0 ? (
            <p className="text-sm text-destructive">No approver is configured for you — contact HR.</p>
          ) : (
            <select value={applyForm.authPerson} onChange={e=>setApplyForm(f=>({...f, authPerson:e.target.value}))} className={inputCls}>
              {approvers.map(a => <option key={a.empNo} value={a.empNo}>{a.name} (Level {a.level})</option>)}
            </select>
          )}
        </FormField>
      </Modal>

      <Modal open={!!viewLeave} onClose={() => setViewLeave(null)} title="Leave Request Details"
        footer={<Btn variant="secondary" size="sm" onClick={() => setViewLeave(null)}>Close</Btn>}>
        {viewLeave && (
          <div className="flex flex-col gap-2.5 text-sm">
            {[
              { label:"Leave No.", value:viewLeave.leaveNumber },
              { label:"Employee", value:viewLeave.employeeName },
              { label:"Leave Type", value:viewLeave.leaveType },
              { label:"From Date", value:formatDate(viewLeave.fromDate) },
              { label:"To Date", value:formatDate(viewLeave.toDate) },
              { label:"Days", value:viewLeave.days },
              { label:"Approver", value:viewLeave.approver },
              { label:"Status", value:viewLeave.status },
              ...(viewLeave.reason ? [{ label:"Reason", value:viewLeave.reason }] : []),
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-medium text-foreground text-right">{f.value}</span>
              </div>
            ))}
            {!viewLeave.reason && (
              <div className="pt-2 mt-1 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Remarks</p>
                <p className="text-sm text-foreground">{viewLeave.remarks || "No remarks."}</p>
              </div>
            )}
            {viewLeave.dateSessions && Object.keys(viewLeave.dateSessions).length > 0 && (
              <div className="pt-2 mt-1 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Session Datewise</p>
                <div className="flex flex-col gap-1">
                  {Object.entries(viewLeave.dateSessions).map(([d, s]) => (
                    <div key={d} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{formatDate(d)}</span>
                      <span className="font-medium text-foreground">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {viewLeave.session && !(viewLeave.dateSessions && Object.keys(viewLeave.dateSessions).length > 0) && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Session</span>
                <span className="font-medium text-foreground text-right">{viewLeave.session}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!manageRow} onClose={() => { setManageRow(null); setConfirmReject(false); }} maxWidth="max-w-lg"
        closeOnOverlayClick={false}
        title={manageMode === "edit" ? "Edit Request" : "View & Manage Request"}
        footer={manageMode === "edit" ? (
          <>
            <Btn variant="primary" size="sm" onClick={submitManageEdit} loading={LIVE.edit.isPending}>Save Changes</Btn>
            <Btn variant="secondary" size="sm" onClick={() => (ownEdit ? setManageRow(null) : setManageMode("view"))}>{ownEdit ? "Cancel" : "Back"}</Btn>
          </>
        ) : (
          <>
            <Btn variant="primary" size="sm" onClick={() => manageAction(REQUEST_ACTIONS.APPROVE)} loading={LIVE.manage.isPending}>Approve</Btn>
            <Btn variant="danger" size="sm" onClick={() => setConfirmReject(true)}>Reject</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setManageRow(null)}>Close</Btn>
          </>
        )}>
        {manageRow && manageMode === "view" && (
          <div className="flex flex-col gap-2.5 text-sm">
            {[
              { label:"Leave No.", value:manageRow.leaveNumber },
              { label:"Employee", value:manageRow.employeeName },
              { label:"Leave Type", value:manageRow.leaveType },
              { label:"From Date", value:formatDate(manageRow.fromDate) },
              { label:"To Date", value:formatDate(manageRow.toDate) },
              { label:"Days", value:manageRow.days },
              { label:"Status", value:manageRow.status },
              ...(manageRow.place ? [{ label:"Place", value:manageRow.place }] : []),
              ...(manageRow.reason ? [{ label:"Reason", value:manageRow.reason }] : []),
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-medium text-foreground text-right">{f.value}</span>
              </div>
            ))}
            {!manageRow.reason && (
              <div className="pt-2 mt-1 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Remarks</p>
                <p className="text-sm text-foreground">{manageRow.remarks || "No remarks."}</p>
              </div>
            )}
          </div>
        )}
        {manageRow && manageMode === "edit" && manageForm && (
          <>
            {manageRow._source === "fts" ? (
              <>
                <FormField label="Date" required error={manageErrors.date || manageErrors.dates}>
                  <DatePickerCalendar value={manageForm.date} onChange={d=>setManageForm(f=>({...f, date:d}))}/>
                </FormField>
                <FormField label="Session" required>
                  <select value={manageForm.session} onChange={e=>setManageForm(f=>({...f, session:e.target.value}))} className={inputCls}>
                    {LEAVE_SESSIONS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="Reason" required error={manageErrors.reason}>
                  <select value={manageForm.reason} onChange={e=>setManageForm(f=>({...f, reason:e.target.value}))} className={inputCls}>
                    <option value="">Select a reason...</option>
                    {FORGOT_TO_SWIPE_REASONS.map(r=><option key={r}>{r}</option>)}
                  </select>
                </FormField>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Start Date" required>
                    <DatePickerCalendar value={manageForm.fromDate} onChange={d=>setManageForm(f=>({...f, fromDate:d}))}/>
                  </FormField>
                  <FormField label="End Date" required>
                    <DatePickerCalendar value={manageForm.toDate} onChange={d=>setManageForm(f=>({...f, toDate:d}))}/>
                  </FormField>
                </div>
                {manageErrors.dates && <p className="text-xs text-destructive -mt-2" role="alert">{manageErrors.dates}</p>}
                {manageRow._source === "onduty" && (
                  <FormField label="Place" required error={manageErrors.place}>
                    <input value={manageForm.place} onChange={e=>setManageForm(f=>({...f, place:e.target.value}))} className={inputCls}/>
                  </FormField>
                )}
                {manageRangeDates.length > 0 && (
                  <FormField label={`Session Datewise (${manageRangeDates.length} day${manageRangeDates.length>1?"s":""})`}>
                    <div className="-mx-1 max-h-[200px] overflow-y-auto flex flex-col gap-1.5 pr-1">
                      {manageRangeDates.map(d => (
                        <div key={d} className="flex items-center justify-between gap-2 py-1 px-2 rounded-md bg-secondary/40">
                          <span className="text-sm text-foreground">{formatDate(d)}</span>
                          <select value={manageDateSessions[d] || LEAVE_SESSIONS[2]}
                            onChange={e => setManageDateSessions(prev => ({ ...prev, [d]: e.target.value }))}
                            className="border border-border rounded-md py-1 px-2 text-xs bg-input-background focus:outline-none focus:ring-2 focus:ring-ring">
                            {(manageRow?._source === "leave" && manageRow?.leaveType === "Privilege/Earned Leave" ? sessionChoices(d, manageRangeDates) : LEAVE_SESSIONS).map(s=><option key={s}>{s}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </FormField>
                )}
              </>
            )}
            <FormField
              label={manageRow._source === "fts" && manageForm.reason === "Others" ? "Remarks" : "Remarks (optional)"}
              required={manageRow._source === "fts" && manageForm.reason === "Others"}
              error={manageErrors.remarks}>
              <textarea rows={3} value={manageForm.remarks} onChange={e=>setManageForm(f=>({...f, remarks:e.target.value}))}
                className={cn(inputCls,"resize-none")}/>
            </FormField>
          </>
        )}
      </Modal>

      <Modal open={!!confirmCancelRow} onClose={() => setConfirmCancelRow(null)} title="Cancel Leave Request" maxWidth="max-w-sm"
        footer={<>
          <Btn variant="danger" size="sm" onClick={confirmCancel} loading={LIVE.manage.isPending}>Yes, Cancel It</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setConfirmCancelRow(null)}>No, Keep It</Btn>
        </>}>
        <p className="text-sm">Are you sure you want to cancel <strong>{confirmCancelRow?.leaveNumber}</strong>? This cannot be undone.</p>
      </Modal>

      <Modal open={confirmReject} onClose={() => setConfirmReject(false)} title="Reject Leave Request" maxWidth="max-w-sm"
        footer={<>
          <Btn variant="danger" size="sm" onClick={() => manageAction(REQUEST_ACTIONS.REJECT)} loading={LIVE.manage.isPending}>Yes, Reject It</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setConfirmReject(false)}>No, Go Back</Btn>
        </>}>
        <p className="text-sm">Are you sure you want to reject <strong>{manageRow?.leaveNumber}</strong>'s request from <strong>{manageRow?.employeeName}</strong>? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
