import { cn } from "../utils/cn";
import { titleCase } from "../utils/text";

// suffix (optional): a label shown after the status in brackets, e.g. "Present (First Half)".
export function StatusBadge({ status, suffix }) {
  const map = {
    Active: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    Inactive: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-white",
    "On Leave": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    Present: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    Absent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-white",
    Late: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-white",
    Leave: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-white",
    Holiday: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-white",
    WFH: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    "On Duty": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    "On-Duty": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    "Forgot to Swipe": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-white",
    "Weekly Off": "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-white",
    "Casual/Sick Leave": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    "Privilege/Earned Leave": "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
    Pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    Accepted: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    Approved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    Rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-white",
    Available: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    Booked: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    "My Booking": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    Past: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-white",
    Open: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-white",
    "In Progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-white",
    Resolved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    Closed: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-white",
    // HR Support's own real status vocabulary (all-caps) -- see ServiceDeskPage.jsx.
    OPEN: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-white",
    ACKNOWLEDGED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-white",
    CLOSED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    Low: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-white",
    Medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-white",
    High: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-white",
    Critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-white",
    "Not Started": "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-white",
    "In Progress (course)": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-white",
    Completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    Attended: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    "Not Attended": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    Scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-white",
    National: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-white",
    Regional: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-white",
    Optional: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-white",
    "": "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-white",
  };
  const badge = (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold", map[status] || map[""])}>
      {titleCase(status)}
    </span>
  );
  if (!suffix) return badge;
  // The suffix sits after the badge as plain text -- no background or border.
  return (
    <span className="inline-flex items-center gap-1">
      {badge}
      <span className="text-xs text-muted-foreground">({suffix})</span>
    </span>
  );
}
