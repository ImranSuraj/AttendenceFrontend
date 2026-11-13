import { cn } from "@/shared/utils/cn";

// Colored pill for the Leave Requests table's Leave Type column -- same pill shape as
// StatusBadge, but its own palette, deliberately avoiding the Status column's
// yellow/green/red/gray (Pending/Approved/Rejected/Cancelled) so a row's two badges never read
// as the same thing. On Duty (indigo) and Forgot to Swipe (purple) match the Dashboard/Attendance
// stat cards. "Earned Leave" is the backend's own description for PL (the pending-approval
// scope returns the raw leaveTypeDescription), so it shares Privilege Leave's color.
const LEAVE_TYPE_COLORS = {
  "Casual/Sick Leave": "bg-sky-100 text-sky-800 dark:bg-sky-900/40",
  "Privilege/Earned Leave": "bg-teal-100 text-teal-800 dark:bg-teal-900/40",
  "Earned Leave": "bg-teal-100 text-teal-800 dark:bg-teal-900/40",
  "On Duty": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40",
  "Forgot to Swipe": "bg-purple-100 text-purple-700 dark:bg-purple-900/40",
};

export function LeaveTypeBadge({ type }) {
  if (!type) return null;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap",
      LEAVE_TYPE_COLORS[type] || "bg-slate-100 text-slate-700 dark:bg-slate-700"
    )}>
      {type}
    </span>
  );
}
