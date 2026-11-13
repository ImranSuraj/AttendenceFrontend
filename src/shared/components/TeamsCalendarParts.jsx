import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "../utils/cn";

// Building blocks shared by every calendar in the app so they all look like the Microsoft Teams calendar:
//   TeamsMiniMonth  - the small Sunday-first month (date pickers, side calendars)
//   TeamsMonthGrid  - the full month view (Teams "Month" layout): tinted weekday header, bordered day cells with
//                     the date top-left, today as a filled brand circle, weekends tinted, free-form cell content
// Dates travel as "yyyy-MM-dd" strings built from LOCAL date parts (never toISOString, which shifts the day in
// time zones ahead of UTC).

export const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayIso = () => toIso(new Date());

/** The 6 weeks (42 days, Sunday first) that cover a month, including the dimmed days of the neighbouring months. */
export function monthDays(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** Drops a trailing week that lies entirely in the next month (5-week months look like Teams' own). */
function trimWeeks(days, month) {
  const weeks = [];
  for (let i = 0; i < 42; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks.filter((w) => w.some((d) => d.getMonth() === month)).flat();
}

const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Teams "Month" view. `renderDay(date, { inMonth, isToday, isWeekend, iso })` returns the content under the date number. */
export function TeamsMonthGrid({ year, month, renderDay, onDayClick, minCellHeight = 84, dimOutside = true, className }) {
  const days = useMemo(() => trimWeeks(monthDays(year, month), month), [year, month]);
  const today = todayIso();

  return (
    <div className={cn("border border-border rounded-lg overflow-hidden bg-card", className)} style={{ fontFamily: "var(--font-sans)" }}>
      <div className="grid grid-cols-7 border-b border-border" style={{ backgroundColor: "color-mix(in srgb, var(--muted) 40%, var(--card))" }}>
        {LONG_DAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-xs text-muted-foreground truncate">
            <span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d.slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date, i) => {
          const iso = toIso(date);
          const inMonth = date.getMonth() === month;
          const isToday = iso === today;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const label = date.getDate() === 1 ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : date.getDate();
          return (
            <div key={iso}
              onClick={onDayClick ? () => onDayClick(date, iso) : undefined}
              className={cn(
                "flex flex-col gap-1 p-1.5 border-b border-border overflow-hidden",
                i % 7 !== 0 && "border-l",
                isWeekend && "bg-muted/40",
                !inMonth && dimOutside && "opacity-50",
                onDayClick && "cursor-pointer hover:bg-[var(--colorNeutralBackground1Hover)]",
              )}
              style={{ minHeight: minCellHeight }}>
              <span className={cn(
                "self-start text-[13px] min-w-6 h-6 leading-6 text-center rounded-full px-1 text-foreground",
                isToday && "bg-[var(--colorBrandBackground)] text-[var(--colorNeutralForegroundOnBrand)] font-semibold",
              )}>{label}</span>
              {renderDay?.(date, { inMonth, isToday, isWeekend, iso })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS_PER_PAGE = 12;

/**
 * The Teams mini calendar: month title with up/down arrows, S M T W T F S, 28px day buttons, today as a
 * filled brand circle, the selected day outlined in brand, neighbouring-month days dimmed. Like the Fluent calendar,
 * clicking the title opens a month picker (12 months of that year) and clicking the year there opens a year picker
 * (12 years per page), so any date can be reached without paging month by month.
 *   value   selected "yyyy-MM-dd" (or "")        month / onMonthChange   the visible month (a Date on the 1st)
 *   min/max inclusive "yyyy-MM-dd" limits         onPick(iso)             a day was chosen
 *   disableDay(iso) => true greys that day out and makes it unclickable (e.g. Sundays for leave)
 */
export function TeamsMiniMonth({ value, month: monthProp, onMonthChange, onPick, min, max, disableDay, className }) {
  // Never let a bad month value turn the grid into NaN: fall back to the current month.
  const month = monthProp instanceof Date && !isNaN(monthProp.getTime()) ? monthProp : new Date();
  const y = month.getFullYear();
  const m = month.getMonth();
  const [mode, setMode] = useState("days"); // "days" | "months" | "years"
  const [pickerYear, setPickerYear] = useState(y);
  const [yearPageStart, setYearPageStart] = useState(y - (y % YEARS_PER_PAGE));
  const days = useMemo(() => monthDays(y, m), [y, m]);
  const today = todayIso();
  const thisYear = new Date().getFullYear();
  const thisMonth = new Date().getMonth();

  const openMonths = () => { setPickerYear(y); setMode("months"); };
  const openYears = () => { setYearPageStart(pickerYear - (pickerYear % YEARS_PER_PAGE)); setMode("years"); };

  const title = mode === "days" ? month.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : mode === "months" ? String(pickerYear)
    : `${yearPageStart} – ${yearPageStart + YEARS_PER_PAGE - 1}`;
  const onTitle = mode === "days" ? openMonths : mode === "months" ? openYears : () => setMode("days");
  const prev = () => {
    if (mode === "days") onMonthChange(new Date(y, m - 1, 1));
    else if (mode === "months") setPickerYear(pickerYear - 1);
    else setYearPageStart(yearPageStart - YEARS_PER_PAGE);
  };
  const next = () => {
    if (mode === "days") onMonthChange(new Date(y, m + 1, 1));
    else if (mode === "months") setPickerYear(pickerYear + 1);
    else setYearPageStart(yearPageStart + YEARS_PER_PAGE);
  };
  const iconBtn = "p-2.5 md:p-1.5 rounded-md border-0 bg-transparent cursor-pointer text-foreground hover:bg-[var(--colorSubtleBackgroundHover)] active:bg-[var(--colorSubtleBackgroundPressed)]";
  const cellBtn = "h-10 md:h-10 rounded-md border-0 bg-transparent cursor-pointer text-sm font-[inherit] text-foreground hover:bg-[var(--colorSubtleBackgroundHover)] active:bg-[var(--colorSubtleBackgroundPressed)]";

  return (
    <div className={cn("w-[232px] max-md:w-full", className)} style={{ fontFamily: "var(--font-sans)" }}>
      <div className="flex items-center justify-between pb-1 pl-1">
        <button type="button" onClick={onTitle} aria-label={mode === "days" ? "Choose a month" : mode === "months" ? "Choose a year" : "Back to days"}
          className="px-2 py-2 md:px-1.5 md:py-0.5 rounded-md border-0 bg-transparent cursor-pointer text-base md:text-sm font-semibold text-foreground hover:bg-[var(--colorSubtleBackgroundHover)] active:bg-[var(--colorSubtleBackgroundPressed)]">
          {title}
        </button>
        <span className="flex">
          <button type="button" aria-label={mode === "days" ? "Previous month" : mode === "months" ? "Previous year" : "Previous years"} onClick={prev} className={iconBtn}><ArrowUp size={14}/></button>
          <button type="button" aria-label={mode === "days" ? "Next month" : mode === "months" ? "Next year" : "Next years"} onClick={next} className={iconBtn}><ArrowDown size={14}/></button>
        </span>
      </div>

      {mode === "days" && (
        <div className="grid grid-cols-7 gap-y-0.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="h-9 leading-9 md:h-7 md:leading-7 text-center text-sm md:text-xs text-foreground">{d}</div>)}
          {days.map((d) => {
            const iso = toIso(d);
            const disabled = (min && iso < min) || (max && iso > max) || (disableDay ? disableDay(iso) : false);
            const selected = iso === value;
            const isToday = iso === today;
            return (
              <button key={iso} type="button" disabled={disabled} aria-label={d.toDateString()} aria-pressed={selected}
                onClick={() => onPick(iso)}
                className={cn(
                  "relative h-10 md:h-7 flex items-center justify-center text-[15px] md:text-xs border-0 bg-transparent font-[inherit] cursor-pointer rounded-md",
                  d.getMonth() === m ? "text-foreground" : "text-muted-foreground",
                  !selected && !isToday && "hover:bg-[var(--colorSubtleBackgroundHover)]",
                  disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
                )}>
                {(isToday || selected) && (
                  <span className={cn("absolute w-9 h-9 md:w-[26px] md:h-[26px] rounded-full", isToday ? "bg-[var(--colorBrandBackground)]" : "border-2 border-[var(--colorBrandBackground)]")}/>
                )}
                <span className={cn("relative", isToday && "font-semibold text-[var(--colorNeutralForegroundOnBrand)]", selected && !isToday && "font-semibold")}>{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      )}

      {mode === "months" && (
        <div className="grid grid-cols-3 gap-1 pt-1" role="listbox" aria-label="Months">
          {MONTH_SHORT.map((label, i) => {
            const isCurrent = pickerYear === thisYear && i === thisMonth;
            const isShown = pickerYear === y && i === m;
            return (
              <button key={label} type="button" role="option" aria-selected={isShown}
                onClick={() => { onMonthChange(new Date(pickerYear, i, 1)); setMode("days"); }}
                className={cn(cellBtn, isShown && "bg-[var(--colorBrandBackground2)] font-semibold", isCurrent && !isShown && "text-[var(--colorBrandForeground1)] font-semibold")}>
                {label}
              </button>
            );
          })}
        </div>
      )}

      {mode === "years" && (
        <div className="grid grid-cols-3 gap-1 pt-1" role="listbox" aria-label="Years">
          {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i).map((yr) => (
            <button key={yr} type="button" role="option" aria-selected={yr === y}
              onClick={() => { setPickerYear(yr); setMode("months"); }}
              className={cn(cellBtn, yr === y && "bg-[var(--colorBrandBackground2)] font-semibold", yr === thisYear && yr !== y && "text-[var(--colorBrandForeground1)] font-semibold")}>
              {yr}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}