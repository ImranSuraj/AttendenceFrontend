import { useState, useMemo, useEffect } from "react";
import { Users, RefreshCw, Table2, CalendarDays, Search, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { TeamsMonthGrid } from "@/shared/components/TeamsCalendarParts";
import { cn } from "@/shared/utils/cn";
import { downloadExcelFile } from "@/shared/utils/downloadExcelFile";
import { Btn } from "@/shared/components/Btn";
import { useHasExactRole } from "@/shared/access/access.store";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { DataTable } from "@/shared/components/DataTable";
import { Spinner } from "@/shared/components/Spinner";
import { formatDate, attendanceCycleRange } from "@/shared/utils/date";
import { useAttendanceLogsForEmployees, useAttendanceStatsSummary } from "../hooks/useAttendanceLogQuery";
import { useCurrentUser, useLiveMyReportees, useCurrentEmployeeNo } from "@/features/employees";
import { CountUp } from "@/shared/components/CountUp";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";
import { FilterPanel } from "@/shared/components/FilterPanel";
import { ChatLauncher } from "@/features/chatbot";

// Confirmed status descriptions only (dbo.spv1_GetAttendanceLog's own @StatusMap) — every other
// code the real data map return passes through as its raw code rather than an invented label.
// This is the Calendar view's own legend/per-half-day vocabulary (see DapStatusChip/CELL_TINT) —
// NOT the Status filter's options, which use the 6-category stat-card vocabulary instead (see
// STATUS_FILTER_OPTIONS/matchesStatusFilter below — a deliberately different classification, since
// "Early Exit"/"Late"/"Forgot to Swipe" are derived facts, not raw per-half-day swipe statuses).
const STATUS_OPTIONS = ["Present", "Absent", "Weekly Off", "Holiday", "On-Duty", "Casual/Sick Leave", "Privilege/Earned Leave"];

// The Status filter dropdown's options — same 6-category vocabulary as the stat-card row below
// (Present/Early Exit/Late/Absent/On Duty/Forgot to Swipe), not the raw per-half-day swipe status.
const STATUS_FILTER_OPTIONS = ["Present", "Early Exit", "Late", "Absent", "On Duty", "Forgot to Swipe"];
const CORPORATE_ONLY_STATUS = ["Early Exit", "Late"]; // tracked for the Corporate Office (plant CRPO) only

// Same classification dbo.spv1_GetAttendanceStatsSummary uses server-side for the 6 stat cards
// (see that procedure's own header comment in RevampedFinalStoredProcedures.sql), replicated here
// per-record from fields the attendance log already returns (firstHalfStatusCode/
// secondHalfStatusCode/remarks) — Present/Absent/On Duty read the raw half-day status codes
// ('P'/'A'/'OD'), Early Exit/Late/Forgot to Swipe read the exact literal remarks text the backend
// writes ('Early by...'/'Late by...'/'...Forgot to swipe...'). Categories are NOT mutually
// exclusive (matching the backend's own "not mutually exclusive" counting convention) — a record
// can match more than one filter value at once, e.g. Present AND Late.
function matchesStatusFilter(r, filter) {
  if (!filter) return true;
  const remarks = r.remarks || "";
  switch (filter) {
    case "Present": return r.firstHalfStatusCode === "P" || r.secondHalfStatusCode === "P";
    case "Absent": return r.firstHalfStatusCode === "A" || r.secondHalfStatusCode === "A";
    case "On Duty": return r.firstHalfStatusCode === "OD" || r.secondHalfStatusCode === "OD";
    case "Early Exit": return remarks.includes("Early by");
    case "Late": return remarks.startsWith("Late by");
    case "Forgot to Swipe": return remarks.includes("Forgot to swipe");
    default: return true;
  }
}

// No border classes here on purpose — these render as content-width chips, not full-width/
// bordered blocks (see DapStatusChip below).
const CELL_TINT = {
  Present: "bg-green-200 text-green-900 dark:bg-green-800/50 dark:text-green-100",
  Absent: "bg-red-200 text-red-900 dark:bg-red-800/50 dark:text-red-100",
  "Weekly Off": "bg-gray-200 text-gray-800 dark:bg-gray-700/50 dark:text-white",
  Holiday: "bg-purple-200 text-purple-900 dark:bg-purple-800/50 dark:text-purple-100",
  "On-Duty": "bg-indigo-200 text-indigo-900 dark:bg-indigo-800/50 dark:text-indigo-100",
  "Casual/Sick Leave": "bg-blue-200 text-blue-900 dark:bg-blue-800/50 dark:text-blue-100",
  "Privilege/Earned Leave": "bg-teal-200 text-teal-900 dark:bg-teal-800/50 dark:text-teal-100",
};

// Single content-width chip, no border — "Present 08:25–18:31" when both halves of the day agree
// (the common case), just the bare status otherwise (Absent/Weekly Off/Holiday rarely have real
// swipe times). When the two halves genuinely differ (a real half-day fact, e.g. half-day leave),
// each renders its own chip stacked — still no invented single combined label.
function DapStatusChip({ status, timeRange }) {
  return (
    <span className={cn("inline-block w-fit max-w-full truncate text-xs font-semibold leading-4 rounded px-1.5 py-0.5", CELL_TINT[status] || "bg-muted text-foreground")}>
      {status}{timeRange ? ` ${timeRange}` : ""}
    </span>
  );
}

// Shared color set for the 6-card Present/Early Exit/Late/Absent/On Duty/Forgot to Swipe stat
// row — kept identical here and in HomePage.jsx's monthStatCards so the same status always
// reads as the same color on both pages.
const STAT_CARD_COLORS = {
  Present: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Early Exit": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Late: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Absent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "On Duty": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Forgot to Swipe": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

// Two half-day statuses, not one combined per-day status — dbo.consolidated has no single
// combined column, and no real source available confirms a rule for collapsing them into one.
// Each half gets its own tinted strip so both real facts stay visible without inventing a merge.
function AttendanceCalendar({ records, fromDate, toDate }) {
  const recordsByDate = useMemo(() => {
    const m = new Map();
    records.forEach(r => m.set(r.date, r));
    return m;
  }, [records]);

  const months = useMemo(() => {
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T00:00:00`);
    const list = [];
    let p = start.getFullYear(), m = start.getMonth();
    const endY = end.getFullYear(), endM = end.getMonth();
    while (p < endY || (p === endY && m <= endM)) {
      list.push({ year: p, month: m });
      m++;
      if (m > 11) { m = 0; p++; }
    }
    return list;
  }, [fromDate, toDate]);

  return (
    <div className="flex flex-col gap-6">
      {months.map(({ year, month }) => (
        <div key={`${year}-${month}`} className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          <h3 className="px-4 py-3 text-sm font-semibold text-foreground border-b border-border">
            {new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h3>
          <div className="overflow-x-auto">
            <div className="min-w-[630px]">
              <TeamsMonthGrid
                year={year} month={month} className="rounded-none border-0" minCellHeight={84} dimOutside={false}
                renderDay={(date, { inMonth, iso }) => {
                  if (!inMonth) return null;
                  const inRange = iso >= fromDate && iso <= toDate;
                  const record = recordsByDate.get(iso);
                  if (!record || !inRange) return null;
                  const hasTimes = record.checkIn !== "-" || record.checkOut !== "-";
                  const timeRange = hasTimes ? `${record.checkIn}–${record.checkOut}` : null;
                  const sameHalf = record.firstHalfStatus === record.secondHalfStatus;
                  return sameHalf ? (
                    <DapStatusChip status={record.firstHalfStatus} timeRange={timeRange}/>
                  ) : (
                    <>
                      <DapStatusChip status={record.firstHalfStatus}/>
                      <DapStatusChip status={record.secondHalfStatus}/>
                    </>
                  );
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-border">
            <span className="text-xs font-bold text-foreground mr-1">Legend:</span>
            {STATUS_OPTIONS.map(status => (
              <StatusBadge key={status} status={status}/>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AttendancePage() {
  const CURRENT_EMPLOYEE_NO = useCurrentEmployeeNo();
  const CURRENT_USER = useCurrentUser();
  const MY_REPORTEES = useLiveMyReportees();
  const isManager = MY_REPORTEES.length > 0;
  // Defaults to the attendance cycle so far (26th to today -- same window as Home's "My Attendance" card); the user can still
  // pick any range with the From/To inputs below.
  const [fromDate, setFromDate] = useState(() => attendanceCycleRange().fromDate);
  const [toDate, setToDate] = useState(() => attendanceCycleRange().toDate);
  const [statusFilter, setStatusFilter] = useState("");
  // The page always opens on My Attendance, even for a manager; Reportees Attendance is one click away.
  const [pickedScope, setScope] = useState(null);
  const scope = pickedScope ?? "mine";
  const [selectedReportee, setSelectedReportee] = useState("");
  const [pickedView, setViewMode] = useState(null); // null = the default: Calendar View whenever one employee is shown, otherwise the table
  const isCorporate = CURRENT_USER.plant?.trim().toUpperCase() === "CRPO";
  const canExport = useHasExactRole("HRAdmin"); // the Excel export is HRAdmin only (ITAdmin does not get it)
  const [search, setSearch] = useState("");
  const DEFAULT_RANGE = attendanceCycleRange();
  // Reset puts EVERY filter back (it used to clear only the status, so a changed date range stayed): dates, status, search and the chosen reportee.
  const resetFilters = () => { setFromDate(DEFAULT_RANGE.fromDate); setToDate(DEFAULT_RANGE.toDate); setStatusFilter(""); setSearch(""); setSelectedReportee(""); };

  const scopedEmployees = useMemo(() => {
    if (scope === "team" && isManager) {
      if (selectedReportee) return MY_REPORTEES.filter(e => e.id === selectedReportee);
      return MY_REPORTEES;
    }
    return CURRENT_EMPLOYEE_NO ? [{ id: CURRENT_EMPLOYEE_NO, name: CURRENT_USER.name }] : [];
  }, [scope, isManager, selectedReportee, MY_REPORTEES, CURRENT_USER, CURRENT_EMPLOYEE_NO]);

  const nameByEmpNo = useMemo(() => {
    const m = new Map();
    scopedEmployees.forEach(e => m.set(e.id, e.name));
    return m;
  }, [scopedEmployees]);

  const targetEmpNos = useMemo(() => scopedEmployees.map(e => e.id), [scopedEmployees]);

  useEffect(() => {
    if (scope !== "team") setSelectedReportee("");
  }, [scope]);


  const { data: log, isLoading } = useAttendanceLogsForEmployees(targetEmpNos, fromDate, toDate);

  const filtered = useMemo(() => log
    .filter(r => matchesStatusFilter(r, statusFilter))
    .map(r => {
      const employeeName = nameByEmpNo.get(r.employeeId) || r.employeeId;
      // Display-only: one "Emp ID - Employee" column (the id alone when the name isn't known).
      const employee = employeeName === r.employeeId ? r.employeeId : `${r.employeeId} - ${employeeName}`;
      return { ...r, employeeName, employee };
    })
  , [log, statusFilter, nameByEmpNo]);

  // Real backend-computed counts (see attendance.service.js's getAttendanceStatsSummary header
  // comment) — scoped by the same targetEmpNos/fromDate/toDate as the log itself, independent of
  // the client-side statusFilter (the stat row always reflects the full scoped date range).
  const { data: stats } = useAttendanceStatsSummary(targetEmpNos, fromDate, toDate);

  // Employees see only their own rows, so the Employee column is for a manager looking at the reportees.
  const showEmployeeColumn = isManager && scope === "team";
  const cols = [
    ...(showEmployeeColumn ? [{ key:"employee", label:"Employee" }] : []),
    { key:"date", label:"Date", render: r => formatDate(r.date) },
    { key:"checkIn", label:"Check In" },
    { key:"checkOut", label:"Check Out" },
    { key:"firstHalfStatus", label:"First Half", render: r => <StatusBadge status={r.firstHalfStatus}/> },
    { key:"secondHalfStatus", label:"Second Half", render: r => <StatusBadge status={r.secondHalfStatus}/> },
    { key:"remarks", label:"Remarks" },
  ];

  // Search box + Excel button live at the end of the filter row (table view), not in the table's own
  // toolbar, so the table is given the already-searched rows and its built-in search/export are hidden.
  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter(row => cols.some(c => String(row[c.key] ?? "").toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, search]);

  // Same cell text the table shows: a plain-string render() wins, otherwise the raw field value.
  const cellText = (row, col) => {
    if (col.render) {
      const rendered = col.render(row);
      if (typeof rendered === "string" || typeof rendered === "number") return String(rendered);
    }
    return row[col.key] == null ? "" : String(row[col.key]);
  };
  const exportExcel = () => {
    downloadExcelFile(`Attendance_${fromDate}_to_${toDate}.xls`, cols.map(c => c.label), tableRows.map(r => cols.map(c => cellText(r, c))));
    toast.success("Excel exported");
  };

  const canShowCalendar = scopedEmployees.length === 1;
  const viewMode = canShowCalendar ? (pickedView ?? "calendar") : "table";

  return (
    <div className="flex flex-col gap-4">
      {/* The Table / Calendar view switch has its own row. */}
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2">
        <div className="flex gap-1 teams-tablist w-fit ml-auto">
          <button onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors cursor-pointer border-none",
              viewMode==="table" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent"
            )}>
            <Table2 size={13}/> Table View
          </button>
          <button onClick={() => canShowCalendar && setViewMode("calendar")}
            disabled={!canShowCalendar}
            title={!canShowCalendar ? "Select a single employee to use Calendar View" : undefined}
            className={cn(
              "flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors border-none",
              !canShowCalendar ? "text-muted-foreground/50 bg-transparent cursor-not-allowed" :
                viewMode==="calendar" ? "bg-card shadow-sm text-foreground cursor-pointer" : "text-muted-foreground hover:text-foreground bg-transparent cursor-pointer"
            )}>
            <CalendarDays size={13}/> Calendar View
          </button>
        </div>
      </div>

      {isManager && (
      <div className={cn("flex items-center justify-between flex-wrap gap-2", "animate-fade-in-up")} style={{ animationDelay: "60ms" }}>
        {isManager && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 teams-tablist w-fit">
              <button onClick={() => setScope("team")}
                className={cn(
                  "flex items-center gap-1.5 py-1.5 px-4 text-sm font-medium rounded-md transition-colors cursor-pointer border-none",
                  scope==="team" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent"
                )}>
                <Users size={13}/> Reportees Attendance
              </button>
              <button onClick={() => setScope("mine")}
                className={cn(
                  "flex items-center gap-1.5 py-1.5 px-4 text-sm font-medium rounded-md transition-colors cursor-pointer border-none",
                  scope==="mine" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent"
                )}>
                My Attendance
              </button>
            </div>
            {scope === "team" && (
              <select value={selectedReportee} onChange={e=>setSelectedReportee(e.target.value)}
                className="border border-border rounded-md py-1.5 px-3 text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-ring min-w-[180px]">
                <option value="">All Reportees</option>
                {MY_REPORTEES.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            )}
          </div>
        )}

      </div>
      )}

      <FilterPanel className={cn("bg-card rounded-lg border border-border p-4 flex flex-wrap gap-3 items-end", "animate-fade-in-up")}
        toolbar={viewMode === "table" && (
          <div className="ml-auto max-md:ml-0 max-md:flex-1 max-md:min-w-0 flex items-center gap-2">
            <div className="relative max-md:flex-1 max-md:min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="py-1.5 pl-8 pr-3 text-sm border border-border rounded-md bg-input-background w-48 max-md:w-full focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {canExport && <button onClick={exportExcel} title="Export Excel" aria-label="Export to Excel"
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 max-md:h-[32px] max-md:w-[32px] max-md:px-0 text-xs font-medium border border-border rounded-md bg-transparent cursor-pointer transition-colors hover:bg-muted shrink-0">
              <FileSpreadsheet size={13} className="max-md:w-5 max-md:h-5"/> <span className="max-md:hidden">Excel</span>
            </button>}
          </div>
        )}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">From Date</label>
          <DatePickerCalendar value={fromDate} onChange={v => setFromDate(v)}/>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">To Date</label>
          <DatePickerCalendar value={toDate} onChange={v => setToDate(v)}/>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
            className="border border-border rounded-md py-1.5 px-3 text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All</option>
            {STATUS_FILTER_OPTIONS.filter(s => isCorporate || !CORPORATE_ONLY_STATUS.includes(s)).map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <Btn variant="ghost" size="sm" onClick={resetFilters}>
          <RefreshCw size={13}/> Reset
        </Btn>
      </FilterPanel>
      <div className={cn("grid grid-cols-3 gap-1.5 md:gap-2", isCorporate ? "lg:grid-cols-6" : "lg:grid-cols-4")}>
        {[
          { label:"Present", value:stats.present },
          ...(isCorporate ? [{ label:"Early Exit", value:stats.earlyExit }, { label:"Late", value:stats.late }] : []),
          { label:"Absent", value:stats.absent },
          { label:"On Duty", value:stats.onDuty },
          { label:"Forgot to Swipe", value:stats.forgotToSwipe },
        ].map((s,i)=>(
          <div key={s.label} className={cn("rounded-md pt-0.5 pb-1 max-md:pt-1.5 max-md:pb-[6px] px-2 text-center hover-lift animate-fade-in-up", STAT_CARD_COLORS[s.label])} style={{ animationDelay: `${240 + i*40}ms` }}>
            <p className="text-base max-md:text-[13px] font-bold leading-tight"><CountUp value={s.value}/></p>
            <p className="text-[11px] font-medium leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "480ms" }}>
        {isLoading ? (
          <div className="bg-card rounded-lg border border-border"><Spinner message="Loading attendance…"/></div>
        ) : viewMode === "calendar" && canShowCalendar ? (
          <AttendanceCalendar records={filtered} fromDate={fromDate} toDate={toDate}/>
        ) : (
          <DataTable columns={cols} data={tableRows} hideSearch hideExport/>
        )}
      </div>
    </div>
  );
}
