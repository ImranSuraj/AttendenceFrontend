import { useMemo } from "react";
import { Clock, Calendar, FileText, Building2, Headphones } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Spinner } from "@/shared/components/Spinner";
import { DotsLoader } from "@/shared/components/DotsLoader";
import { formatDate, lastSevenDaysRange, attendanceCycleRange } from "@/shared/utils/date";
import { useLeaveBalanceHistorySummaryQuery } from "@/features/leave";
import { useCurrentUser, useCurrentUserLoading, useCurrentEmployeeNo, useDepartmentOptionsQuery } from "@/features/employees";
import { useAttendanceLog, useAttendanceStatsSummary } from "@/features/attendance";
import { useAllLocationsHolidaysQuery } from "@/features/holidays";

// Shared color set for the 6-card Present/Early Exit/Late/Absent/On Duty/Forgot to Swipe stat
// row — kept identical here and in AttendancePage.jsx's STAT_CARD_COLORS so the same status
// always reads as the same color on both pages.
const STAT_CARD_COLORS = {
  Present: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Early Exit": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Late: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Absent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "On Duty": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Forgot to Swipe": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

export default function HomePage({ onNavigate }) {
  const CURRENT_EMPLOYEE_NO = useCurrentEmployeeNo();
  const CURRENT_USER = useCurrentUser();
  const profileLoading = useCurrentUserLoading();
  // The banner shows the department as "Code - Description" (e.g. "INFT - Information Technology"), the same text as the Employees page's Department list.
  const { data: departmentOptions = [] } = useDepartmentOptionsQuery();
  const departmentText = useMemo(() => {
    const code = String(CURRENT_USER.departmentCode ?? "").trim();
    if (!code) return CURRENT_USER.department;
    const match = departmentOptions.find(o => String(o.value ?? "").trim().toUpperCase() === code.toUpperCase());
    return match ? match.label : code;
  }, [departmentOptions, CURRENT_USER.departmentCode, CURRENT_USER.department]);

  const now = new Date();
  // "My Attendance" covers the last 7 days (today + the 6 before it) -- same shared window as
  // the Attendance page's default range. Local-date strings, not UTC (see localIsoDate).
  const { toDate: todayStr } = lastSevenDaysRange();
  // Home shows one attendance cycle: the 26th of the previous month through the 25th of this month.
  const { fromDate: weekFromDate, toDate: weekToDate } = attendanceCycleRange();

  // Real AMSBackendAPI call (same spv1_GetAttendanceLog as AttendancePage) — no more mock
  // ATTENDANCE here, so this widget reflects actual swipe data instead of random mock status.
  const { data: weekAttendance, isLoading: attendanceLoading } = useAttendanceLog(CURRENT_EMPLOYEE_NO, weekFromDate, weekToDate);

  // Real AMSBackendAPI call (spv1_GetLeaveBalance, same live query LeavePage's own "Leave Balance"
  // modal uses) — no more mock leave.mock.js getLeaveBalance() here, so this reflects the real
  // CL/EL balance for whichever employee is being demoed instead of a hardcoded mock figure.
  // The same procedure and figures as the Employee Leave Balance page (spv1_LeaveBalanceHistory, SUMMARY): this year's row, CL/SL (casual + sick) and PL/EL.
  const thisYear = now.getFullYear();
  const { data: balanceRows } = useLeaveBalanceHistorySummaryQuery(thisYear);
  const leaveBalance = useMemo(() => {
    const row = balanceRows.find(r => Number(r.leaveYear) === thisYear);
    return [
      { type: "Casual/Sick Leave", balance: row?.casualLeaveBalance ?? 0 },
      { type: "Privilege/Earned Leave", balance: row?.privilegeLeaveBalance ?? 0 },
    ];
  }, [balanceRows, thisYear]);

  const { data: holidayData } = useAllLocationsHolidaysQuery([thisYear, thisYear + 1]);
  // Scoped to the viewer's own Plant, not every branch's holidays merged together -- without this,
  // the same real-world holiday appears once per branch that observes it (e.g. Independence Day
  // showing up a dozen times), which reads as duplicates even though each row is a genuinely
  // distinct branch's record. HolidayCalendarMaster.Location stores "<CODE> | <NAME>" (e.g.
  // "CRPO | Bangalore Corporate Office"); the code before "|" is the same Plant code space as
  // empmast.plant (confirmed live: both draw from the identical code set — CRPO/BLRF/UTTF/etc.),
  // so this is a direct match, not a fuzzy one. A Location with no "|" (a small number of legacy
  // rows stored as a plain branch name with no code prefix) can't be matched to any Plant and is
  // correctly excluded here rather than shown to everyone.
  const upcomingHolidays = useMemo(() => (
    holidayData
      .filter(h => h.location?.split("|")[0]?.trim() === CURRENT_USER.plant?.trim())
      .filter(h => h.date >= todayStr)
      .sort((a,b)=>a.date.localeCompare(b.date))
      .slice(0,8)
  ), [holidayData, todayStr, CURRENT_USER.plant]);

  // Early Exit / Late are tracked for the Corporate Office (plant CRPO) only.
  const isCorporate = CURRENT_USER.plant?.trim().toUpperCase() === "CRPO";

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  })();

  // Real backend-computed counts (see attendance.service.js's getAttendanceStatsSummary header
  // comment for the assumed request/response contract) — self-scoped to just CURRENT_EMPLOYEE_NO,
  // matching this widget's existing "My Attendance" personal-only scope. No longer counted
  // client-side from weekAttendance's raw firstHalfStatus/secondHalfStatus fields.
  const { data: weekStats } = useAttendanceStatsSummary([CURRENT_EMPLOYEE_NO], weekFromDate, weekToDate);

  // Show a real loading state instead of CURRENT_USER's mock fields (employees.mock.js) briefly
  // flashing in the greeting banner before the real employee profile arrives --
  // useCurrentUser() itself still returns that mock fallback instantly (other pages rely on that
  // instant-render behavior), so the gate lives here rather than in the shared hook.
  if (profileLoading) {
    return <DotsLoader message="Loading your dashboard…" className="py-24"/>;
  }

  return (
    <div className="flex flex-col gap-3 md:gap-6">
      <div className={cn("bg-primary text-primary-foreground rounded-lg shadow-sm p-2.5 sm:p-5 sm:py-3 flex items-center gap-2.5 md:gap-4", "animate-fade-in-up", "card-shimmer")}>
        <div className={cn("w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center text-sm sm:text-base font-bold shrink-0", "animate-pop-in")}>
          {CURRENT_USER.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
        </div>
        {/* One line from sm up (details truncate if they run out of room); stacks on phones. */}
        <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
          <h2 className="text-sm md:text-lg leading-tight font-bold shrink-0">{greeting},{" "}
            <span className="font-medium tracking-wide">
              {CURRENT_USER.empCode && (
                <>
                  <span className="inline-block align-middle px-1.5 py-px rounded bg-white/20 text-xs md:text-sm font-semibold tabular-nums tracking-normal">{CURRENT_USER.empCode}</span>
                  {" - "}
                </>
              )}
              {CURRENT_USER.name}
            </span>
          </h2>
          <span className="hidden sm:inline text-primary-foreground/60">·</span>
          <p className="text-xs md:text-sm text-primary-foreground/80 min-w-0">{[CURRENT_USER.designation, departmentText, CURRENT_USER.location].filter(Boolean).join(", ")}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 md:gap-3 animate-fade-in-up" style={{ animationDelay: "180ms" }}>
        {[
          { label:"Apply Leave", icon:Calendar, module:"leave" },
          { label:"My Documents", icon:FileText, module:"employeeDocuments" },
          { label:"Book a meeting", icon:Building2, module:"conference" },
          { label:"HR Support", icon:Headphones, module:"servicedesk" },
        ].map((a,i) => (
          <button key={a.label} onClick={() => onNavigate(a.module)}
            style={{ animationDelay: `${180 + i*40}ms` }}
            className={cn("group bg-card rounded-lg border border-border shadow-sm p-2 md:p-4 flex flex-col items-center gap-1 md:gap-2 transition-all duration-200 hover:shadow-md hover:border-primary", "animate-fade-in-up")}>
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110">
              <a.icon size={16}/>
            </div>
            <span className="text-[11px] leading-tight md:text-xs font-medium text-foreground text-center">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className={cn("lg:col-span-3 bg-card rounded-lg border border-border shadow-sm p-3 md:p-5", "hover-lift", "animate-fade-in-up")} style={{ animationDelay: "240ms" }}>
          <div className="flex items-center justify-between mb-4">
            {/* The title with the window shown right after it: the 26th that started this cycle up to today. */}
            <h3 className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold text-base md:text-sm">
              <span className="flex items-center gap-2"><Clock size={16} className="text-primary"/> My Attendance</span>
              <span className="text-xs font-normal text-muted-foreground">{formatDate(weekFromDate)} – {formatDate(weekToDate)}</span>
            </h3>
            <button onClick={() => onNavigate("attendance")}
              className="text-xs max-md:text-sm max-md:min-h-[32px] max-md:px-2 font-medium text-primary bg-transparent border-none cursor-pointer hover:underline">
              View All
            </button>
          </div>
          <div className={cn("grid grid-cols-3 gap-1.5 mb-3", isCorporate ? "lg:grid-cols-6" : "lg:grid-cols-4")}>
            {[
              { label:"Present", value:weekStats.present },
              ...(isCorporate ? [{ label:"Early Exit", value:weekStats.earlyExit }, { label:"Late", value:weekStats.late }] : []),
              { label:"Absent", value:weekStats.absent },
              { label:"On Duty", value:weekStats.onDuty },
              { label:"Forgot to Swipe", value:weekStats.forgotToSwipe },
            ].map(s => (
              <div key={s.label} className={cn("rounded-md pt-0.5 pb-1 max-md:pt-1.5 max-md:pb-[6px] px-2 text-center", STAT_CARD_COLORS[s.label])}>
                <p className="text-base max-md:text-[13px] font-bold leading-tight">{s.value}</p>
                <p className="text-[11px] font-medium leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="max-h-[220px] overflow-auto mt-2">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pt-1.5 pr-2 pb-1.5 pl-0 font-medium">Date</th>
                  <th className="pt-1.5 pr-2 pb-1.5 pl-0 font-medium">Check In</th>
                  <th className="pt-1.5 pr-2 pb-1.5 pl-0 font-medium">Check Out</th>
                  <th className="pt-1.5 pr-2 pb-1.5 pl-0 font-medium">First Half</th>
                  <th className="pt-1.5 pr-2 pb-1.5 pl-0 font-medium">Second Half</th>
                </tr>
              </thead>
              <tbody>
                {weekAttendance.map(r => (
                  <tr key={`${r.employeeId}-${r.date}`} className="[&:last-child_td]:border-b-0">
                    <td className="pt-1.5 pr-2 pb-1.5 pl-0 text-foreground border-b border-border">{formatDate(r.date)}</td>
                    <td className="pt-1.5 pr-2 pb-1.5 pl-0 text-foreground border-b border-border">{r.checkIn}</td>
                    <td className="pt-1.5 pr-2 pb-1.5 pl-0 text-foreground border-b border-border">{r.checkOut}</td>
                    <td className="pt-1.5 pr-2 pb-1.5 pl-0 text-foreground border-b border-border"><StatusBadge status={r.firstHalfStatus}/></td>
                    <td className="pt-1.5 pr-2 pb-1.5 pl-0 text-foreground border-b border-border"><StatusBadge status={r.secondHalfStatus}/></td>
                  </tr>
                ))}
                {!attendanceLoading && weekAttendance.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No attendance records for this period.</td></tr>
                )}
              </tbody>
            </table>
            {attendanceLoading && weekAttendance.length === 0 && <Spinner message="Loading attendance…" size={18}/>}
          </div>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className={cn("bg-card rounded-lg border border-border shadow-sm p-3 md:p-5", "hover-lift", "animate-fade-in-up")} style={{ animationDelay: "300ms" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base md:text-sm flex items-center gap-2"><Calendar size={16} className="text-primary"/> My Leave Balance</h3>
              <button onClick={() => onNavigate("leaveBalanceHistory")}
                className="text-xs max-md:text-sm max-md:min-h-[32px] max-md:px-2 font-medium text-primary bg-transparent border-none cursor-pointer hover:underline">
                View All
              </button>
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pt-1.5 pr-2 pb-1.5 pl-0 font-medium">Type</th>
                  <th className="pt-1.5 pr-2 pb-1.5 pl-0 font-medium text-right">Balance <span className="text-xs font-bold">({thisYear})</span></th>
                </tr>
              </thead>
              <tbody>
                {leaveBalance.map(b => (
                  <tr key={b.type} className="[&:last-child_td]:border-b-0">
                    <td className="py-2 pr-2 pl-0 text-foreground border-b border-border">{b.type}</td>
                    <td className="py-2 pr-2 pl-0 text-foreground border-b border-border text-right font-semibold text-primary">{b.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={cn("bg-card rounded-lg border border-border shadow-sm p-4", "animate-fade-in-up")}
            style={{ animationDelay: "360ms" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] md:text-xs font-semibold text-muted-foreground">Upcoming Holidays</p>
              <button onClick={() => onNavigate("holidays")}
                className="text-xs max-md:text-sm max-md:min-h-[32px] max-md:px-2 font-medium text-primary bg-transparent border-none cursor-pointer hover:underline">
                View All
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {upcomingHolidays.map(h => (
                <p key={h.id} className="text-sm md:text-xs text-foreground flex items-center justify-between py-1 md:py-0">
                  <span className="truncate">{h.name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">{formatDate(h.date)}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
