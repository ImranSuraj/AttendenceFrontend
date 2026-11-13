import { useEffect, useMemo, useState } from "react";
import { Eye, Check, X, User as UserIcon, Phone, Mail, Building2, Target, Users, Calendar, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/shared/components/Btn";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { DataTable } from "@/shared/components/DataTable";
import { Spinner } from "@/shared/components/Spinner";
import { Modal } from "@/shared/components/Modal";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { useHasRole, useHasExactRole, useHasAccess } from "@/shared/access/access.store";
import { useCurrentEmployeeNo } from "@/features/employees";
import { formatDate, localIsoDate } from "@/shared/utils/date";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";
import { useVisitorRequestsQuery, useVisitorMutations } from "../hooks/useVisitorsQuery";
import { VISITOR_STATUS, MEETING_TYPE } from "../visitors.constants";
import { useNavIntent } from "@/shared/navigation/navIntent";
import { emailLinkRange } from "@/shared/navigation/deepLink";

const STATUS_OPTIONS = ["All", VISITOR_STATUS.PENDING, VISITOR_STATUS.ACCEPTED, VISITOR_STATUS.REJECTED];
const MEETING_TYPE_OPTIONS = ["All", MEETING_TYPE.SCHEDULED, MEETING_TYPE.WALK_IN];

// Visitor Requests: the visitors who asked to meet the signed-in employee, with Accept / Reject in the details
// window. Whoever has the "visitorRequestsAll" item (the receptionists) and ITAdmin see EVERY request (all hosts, every status) instead of only
// their own; the receptionist's view is read-only, an employee (or ITAdmin) decides a Pending request. Accepting or
// rejecting sends no e-mail -- the request just moves to its new status in this same table.
export default function VisitorRequestsPage({ onNavigate }) {
  // The signed-in employee's real number (from the session). currentUser.id is NOT it -- that stays the sample user's id, which is why a host
  // never saw Accept / Reject on their own visitors.
  const myEmpNo = useCurrentEmployeeNo();
  // Whoever has the "visitorRequestsAll" item (receptionists, ITAdmin) gets the extra "Whom to Meet" column; the SERVER decides which rows come back.
  const seesAll = useHasAccess("visitorRequestsAll");
  const isItAdmin = useHasRole("ITAdmin");
  const canExport = useHasExactRole("HRAdmin"); // the Excel export is HRAdmin only (ITAdmin does not get it)
  const { data: requests = [], isFetching } = useVisitorRequestsQuery();
  // Accept / Reject: the employee being visited, or ITAdmin (the server enforces this too). A receptionist only views.
  const canDecide = (v) => isItAdmin || String(v.hostEmpNo).trim() === String(myEmpNo ?? "").trim();
  const { decide } = useVisitorMutations();

  const today = localIsoDate(new Date());
  const [from, setFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState("All");
  const [meetingType, setMeetingType] = useState("All");
  const [viewing, setViewing] = useState(null);
  const setIntent = useNavIntent(s => s.setIntent);
  const navIntent = useNavIntent(s => s.intent);
  const clearNavIntent = useNavIntent(s => s.clear);

  // A Scheduled request (made from a conference booking) opens the Visitor page, where its missing details are filled in; a Walk In opens the details window.
  const open = (r) => {
    if (r.meetingType === MEETING_TYPE.SCHEDULED && onNavigate) {
      setIntent({ module: "visitor", requestId: r.id });
      onNavigate("visitor");
    } else {
      setViewing(r);
    }
  };

  // Newest first by Created Date (date + time). `createdAt` is a sortable yyyy-MM-dd HH:mm string, so clicking the
  // column header sorts chronologically too (the displayed dd/MM/yyyy text would not).
  const rows = useMemo(() => requests
    .filter(r => (!from || r.date >= from) && (!to || r.date <= to))
    .filter(r => status === "All" || r.status === status)
    .filter(r => meetingType === "All" || r.meetingType === meetingType)
    .map(r => ({ ...r, createdAt: `${r.date} ${r.time}` }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  [requests, from, to, status, meetingType]);
  // Opened from the "Review & Decide" button of the visitor e-mail (the host is signed in by now): open that request, ready to Accept / Reject.
  useEffect(() => {
    if (navIntent?.module !== "visitorRequests" || navIntent.requestId == null || isFetching) return;
    const row = requests.find(r => String(r.id) === String(navIntent.requestId));
    if (row) {
      if (navIntent.fromEmail) { const range = emailLinkRange(); setFrom(range.fromDate); setTo(localIsoDate(new Date())); } // from an e-mail: the list behind the window is wide enough to show it
      open(row);
    } else {
      toast.info(`Visitor request ${navIntent.requestId} was not found.`);
    }
    clearNavIntent();
  }, [navIntent, isFetching, requests]); // eslint-disable-line react-hooks/exhaustive-deps
  // The filters differ from their start values (the year so far, All, All): how many, for the badge on the phone's Filters button; Reset puts them back.
  const defaultFrom = `${new Date().getFullYear()}-01-01`;
  const filterCount = (from !== defaultFrom ? 1 : 0) + (to !== today ? 1 : 0) + (status !== "All" ? 1 : 0) + (meetingType !== "All" ? 1 : 0);
  const resetFilters = () => { setFrom(defaultFrom); setTo(today); setStatus("All"); setMeetingType("All"); };
  const showCreated = (r) => `${formatDate(r.date)} ${r.time}`;

  const act = (req, decision) => {
    decide.mutate({ id: req.id, decision }, {
      onSuccess: (updated) => {
        toast.success(`Request ${decision === VISITOR_STATUS.ACCEPTED ? "accepted" : "rejected"}`);
        setViewing(updated);
      },
    });
  };

  const cols = [
    { key: "createdAt", label: "Created Date", render: showCreated },
    { key: "visitorName", label: "Visitor Name" },
    { key: "company", label: "Company" },
    { key: "noOfVisitors", label: "No. of Visitors" },
    ...(seesAll ? [{ key: "hostName", label: "Whom to Meet" }] : []),
    { key: "meetingType", label: "Meeting Type" },
    { key: "status", label: "Status", render: r => <StatusBadge status={r.status}/> },
  ];

  const exportColumns = [
    { key: "createdAt", label: "Created Date", render: showCreated },
    { key: "visitorName", label: "Visitor Name" },
    { key: "contactNumber", label: "Contact Number" },
    { key: "visitorEmail", label: "Visitor Email" },
    { key: "company", label: "Company" },
    { key: "purpose", label: "Purpose" },
    { key: "noOfVisitors", label: "No. of Visitors" },
    { key: "hostName", label: "Whom to Meet" },
    { key: "hostDepartment", label: "Department" },
    { key: "meetingType", label: "Meeting Type" },
    { key: "status", label: "Status" },
    { key: "decidedOn", label: "Decided On", render: r => (r.decidedOn ? formatDate(r.decidedOn) : "") },
    { key: "decidedBy", label: "Decided By" },
  ];

  const detail = (v) => viewing && [
    [<UserIcon size={15}/>, "Visitor Name", v.visitorName],
    [<Phone size={15}/>, "Contact Number", v.contactNumber],
    [<Mail size={15}/>, "Visitor Email", v.visitorEmail],
    [<Building2 size={15}/>, "Company", v.company],
    [<Users size={15}/>, "No. of Visitors", v.noOfVisitors],
    [<UserCheck size={15}/>, "Whom to Meet", `${v.hostName}${v.hostDepartment ? ` - ${v.hostDepartment}` : ""}`],
    [<Calendar size={15}/>, "Created Date", `${formatDate(v.date)} ${v.time}`],
    [<Calendar size={15}/>, "Meeting Type", v.meetingType],
    [<Check size={15}/>, "Status", (
      <>
        <StatusBadge status={v.status}/>
        {v.decidedOn && <p className="text-xs text-muted-foreground mt-1">{v.status} by {v.decidedByName || v.decidedBy} on {formatDate(v.decidedOn)}</p>}
      </>
    )],
    // Purpose is free text, so it takes the whole row; every other field sits side by side in two columns.
    [<Target size={15}/>, "Purpose", v.purpose, true],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        {isFetching && requests.length === 0 ? (
          <div className="bg-card rounded-lg border border-border"><Spinner message="Loading visitor requests…"/></div>
        ) : (
          <DataTable
            titleExtra={
              <>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">From Date
                  <DatePickerCalendar value={from} onChange={setFrom} max={to || undefined}/>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">To Date
                  <DatePickerCalendar value={to} onChange={setTo} min={from || undefined}/>
                </label>
                <div className="flex flex-col gap-1 min-w-[150px] text-xs text-muted-foreground">Status
                  <SearchableSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="Status"/>
                </div>
                <div className="flex flex-col gap-1 min-w-[150px] text-xs text-muted-foreground">Meeting Type
                  <SearchableSelect value={meetingType} onChange={setMeetingType} options={MEETING_TYPE_OPTIONS} placeholder="Meeting Type"/>
                </div>
              </>
            }
            compact
            columns={cols} data={rows} exportColumns={exportColumns} exportFileName="VisitorRequests" hideExport={!canExport}
            actions={(r) => (
              <button onClick={() => open(r)} className="p-1.5 rounded-md transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary text-foreground" title={r.meetingType === MEETING_TYPE.SCHEDULED ? "Open visitor details" : "View details"}>
                <Eye size={14}/>
              </button>
            )}
          />
        )}
      </div>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Visitor Request"
        maxWidth="max-w-2xl"
        footer={viewing && (
          <div className="flex flex-wrap gap-2 w-full">
            {canDecide(viewing) && viewing.status === VISITOR_STATUS.PENDING && (
              <>
                <Btn variant="primary" size="sm" loading={decide.isPending} onClick={() => act(viewing, VISITOR_STATUS.ACCEPTED)}><Check size={13}/> Accept</Btn>
                <Btn variant="secondary" size="sm" disabled={decide.isPending} onClick={() => act(viewing, VISITOR_STATUS.REJECTED)}><X size={13}/> Reject</Btn>
              </>
            )}
            <Btn variant="ghost" size="sm" className="ml-auto" onClick={() => setViewing(null)}>Close</Btn>
          </div>
        )}
      >
        {viewing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {detail(viewing).map(([icon, label, value, full]) => (
              <div key={label} className={`flex items-start gap-2.5 text-sm ${full ? "sm:col-span-2" : ""}`}>
                <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
                  <div className="text-foreground break-words whitespace-pre-wrap">{value}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
