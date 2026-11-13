// Date/layout helpers for the Teams-style calendar (TeamsCalendar.jsx). Dates travel as "yyyy-MM-dd"
// strings (the same format the rest of the Conference feature and its API use); times as minutes since
// midnight. Pure functions, no React.

export const pad2 = (n) => String(n).padStart(2, "0");
export const toDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const fromDateStr = (s) => new Date(`${s}T00:00:00`);
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addMonths = (d, n) => { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x; };
export const sameDay = (a, b) => a.toDateString() === b.toDateString();

// Sunday-first weeks, as in the Teams calendar (used by the mini month).
export const startOfWeek = (d) => addDays(startOfDay(d), -startOfDay(d).getDay());

// Teams' "Time scale": the height of one hour. 30 minutes is the Teams default.
export const SCALES = {
  "15": { label: "15 minutes", hourPx: 160 },
  "30": { label: "30 minutes", hourPx: 80 },
  "60": { label: "1 hour", hourPx: 48 },
};

/** Toolbar label for the day shown: "Thursday, October 15, 2026". */
export const dayLabel = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

/** "3 PM" / "15:00" label for an hour line. */
export const hourLabel = (h, timeFormat) => (timeFormat === "12" ? `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}` : `${pad2(h)}:00`);

/** Side-by-side layout for overlapping bookings: each item gets its column and its cluster's column count. */
export function layoutDay(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let cluster = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const cols = [];
    cluster.forEach((it) => {
      let c = cols.findIndex((end) => end <= it.start);
      if (c === -1) { c = cols.length; cols.push(it.end); } else cols[c] = it.end;
      it._col = c;
    });
    cluster.forEach((it) => out.push({ item: it, col: it._col, cols: cols.length }));
    cluster = [];
  };
  sorted.forEach((it) => {
    if (cluster.length && it.start >= clusterEnd) { flush(); clusterEnd = -Infinity; }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  });
  if (cluster.length) flush();
  return out;
}

// ---- Day / Week / Month views (the Teams calendar's view switch) ------------------------------------------------------------
export const VIEWS = { day: "Day", week: "Week", month: "Month" };

/** The first day of the month grid: the Sunday on or before the 1st (a month view always shows whole weeks). */
export const monthGridStart = (d) => startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1));

/** Every date the view draws, as "yyyy-MM-dd" from/to -- what the bookings are fetched for. A month covers its whole 6-week grid. */
export function viewRange(view, anchor) {
  const a = startOfDay(anchor);
  if (view === "week") { const s = startOfWeek(a); return { from: toDateStr(s), to: toDateStr(addDays(s, 6)) }; }
  if (view === "month") { const s = monthGridStart(a); return { from: toDateStr(s), to: toDateStr(addDays(s, 41)) }; }
  return { from: toDateStr(a), to: toDateStr(a) };
}

/** Moves the shown day/week/month one step back (-1) or forward (+1). A month step keeps the day of the month where it exists. */
export function stepAnchor(view, anchor, dir) {
  const a = startOfDay(anchor);
  if (view === "week") return addDays(a, 7 * dir);
  if (view === "month") {
    const target = new Date(a.getFullYear(), a.getMonth() + dir, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return new Date(target.getFullYear(), target.getMonth(), Math.min(a.getDate(), last));
  }
  return addDays(a, dir);
}

/** Toolbar title: "Thursday, October 15, 2026" / "October 11 – 17, 2026" / "October 2026". */
export function rangeLabel(view, anchor) {
  const a = startOfDay(anchor);
  if (view === "month") return a.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  if (view === "week") {
    const s = startOfWeek(a); const e = addDays(s, 6);
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    if (sameMonth) return `${s.toLocaleDateString("en-US", { month: "long" })} ${s.getDate()} – ${e.getDate()}, ${e.getFullYear()}`;
    const sameYear = s.getFullYear() === e.getFullYear();
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return dayLabel(a);
}
