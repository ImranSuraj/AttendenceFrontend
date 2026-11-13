// App-wide display format: dd/MM/yyyy (dates) and dd/MM/yyyy HH:mm:ss in 24-hour time
// (date+time). Accepts a Date, an ISO "yyyy-MM-dd"/"yyyy-MM-ddTHH:mm:ss" string, a SQL Server
// style-104 "dd.mm.yyyy" string (several backend procedures format dates this way — CONVERT(...,
// 104) — and JS's Date constructor can't parse dot-separated dates at all, so without this those
// values silently fell through unparsed and displayed with dots instead of this app's own
// dd/MM/yyyy convention), or anything else `new Date(...)` can parse. Returns the original value
// unchanged if it can't be parsed as a date, so a non-date string never silently becomes
// "Invalid Date" in the UI.
export function toDate(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || !value.trim()) return null;
  const dotMatch = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const [, d, m, y] = dotMatch;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const d = new Date(value.includes("T") || value.includes(" ") ? value : `${value}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

const pad = (n) => String(n).padStart(2, "0");

export function formatDate(value) {
  const d = toDate(value);
  if (!d) return value;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return value;
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// yyyy-MM-dd in the browser's LOCAL timezone -- never toISOString(), which is UTC and returns
// yesterday's date in IST between 00:00 and 05:30.
export function localIsoDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Default attendance window shared by Home's "My Attendance" card and the Attendance page:
// today plus the 6 days before it. spv1_GetAttendanceLog/spv1_GetAttendanceStatsSummary are plain
// @FromDate..@ToDate range filters, so the window is decided entirely here.
export function lastSevenDaysRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  return { fromDate: localIsoDate(start), toDate: localIsoDate(now) };
}

// The attendance cycle so far, used by Home and the Attendance page: from the 26th that started the current cycle up to today.
// Before the 26th that is the 26th of the previous month; from the 26th onward the new cycle has started, so it is the 26th of this month.
export function attendanceCycleRange() {
  const now = new Date();
  const startMonth = now.getDate() >= 26 ? now.getMonth() : now.getMonth() - 1;
  const start = new Date(now.getFullYear(), startMonth, 26);
  return { fromDate: localIsoDate(start), toDate: localIsoDate(now) };
}

// The current month so far: the 1st through today (local time) -- Leaves's default
// From/To filter.
export function currentMonthRange() {
  const now = new Date();
  return {
    fromDate: localIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: localIsoDate(now),
  };
}

// The reverse of formatDate — converts a dd/MM/yyyy string (the shape every real backend date
// column comes back as, e.g. CONVERT(..., 103)) into yyyy-MM-dd, the one format a native
// <input type="date"> will actually display/accept as its `value`. Without this, pre-filling a
// date input from a dd/MM/yyyy API value silently renders blank (the browser can't parse it) even
// though the underlying React state holds a real value. Returns the original value unchanged if
// it isn't a recognizable date string. Besides dd/MM/yyyy it also accepts dd.MM.yyyy (SQL style 104) and an ISO
// date-time ("2026-10-16T00:00:00" -> "2026-10-16"), so a date that came back from the API in any of those
// shapes always ends up as a plain yyyy-MM-dd that date arithmetic (new Date(`${d}T00:00:00`)) can read.
export function toIsoDate(value) {
  if (typeof value !== "string") return value;
  const s = value.trim();
  const match = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${pad(Number(m))}-${pad(Number(d))}`;
  }
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})[T ]/);
  return iso ? iso[1] : value;
}
