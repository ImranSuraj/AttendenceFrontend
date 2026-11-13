import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays, CalendarPlus, Check, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { Spinner } from "@/shared/components/Spinner";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";
import { SLOT_END_MIN, SLOT_START_MIN, minutesTo12hLabel, minutesToLabel } from "../conference.constants";
import {
  SCALES, VIEWS, addDays, fromDateStr, hourLabel, layoutDay, monthGridStart, rangeLabel, sameDay, startOfDay, startOfWeek, stepAnchor, toDateStr,
} from "../teamsCalendar.utils";

const BOOKED = "var(--cal-booked-fg)"; // booked = red, the palette the original booking page used (theme.css --cal-*)
const BOOKED_BG = "var(--cal-booked-bg)";
const PAST = "var(--cal-past-fg)";
const PAST_BG = "var(--cal-past-bg)";
const MEETING = "#5B5FC7"; // a meeting with no room yet (Teams meeting only): purple; a room booking is red
const MEETING_BG = "color-mix(in srgb, #5B5FC7 16%, var(--card))";
const palette = (b, finished) => (finished ? { fg: PAST, bg: PAST_BG } : b.roomCode ? { fg: BOOKED, bg: BOOKED_BG } : { fg: MEETING, bg: MEETING_BG });
const GUTTER = 56;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Phone: the day / week shown as dd/mm/yyyy ("23/10/2026"); the month view keeps its month name.
const dmy = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
/** Small click-to-open menu used by the toolbar (view switch, time format). */
function Dropdown({ trigger, children, align = "left", panelClass }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={cn("absolute top-full mt-1 z-40 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px]", align === "right" ? "right-0" : "left-0", panelClass)}>
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ checked, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left text-foreground bg-transparent border-none cursor-pointer hover:bg-muted">
      <span className="w-4 shrink-0">{checked && <Check size={14} className="text-[#5B5FC7]"/>}</span>{children}
    </button>
  );
}

function MenuHeader({ children }) {
  return <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground">{children}</p>;
}

const isPastRange = (dateStr, endMin) => {
  const n = new Date();
  return dateStr < toDateStr(n) || (dateStr === toDateStr(n) && endMin <= n.getHours() * 60 + n.getMinutes());
};

// One-line tooltip text, same wording the original booking page used for a taken slot, plus the room.
const bookingTip = (b, fmtTime) =>
  `${fmtTime(b.start)} - ${fmtTime(b.end)}\n${b.roomCode ? "Not available" : "Meeting"} - booked by ${b.employeeName || "someone"}${b.purpose ? `: ${b.purpose}` : ""}\n${b.roomName ? `Room: ${b.roomName}` : "No room yet - open it to add one"}`;

/**
 * Calendar for booking conference rooms, laid out like the Microsoft Teams calendar: a Day, Week or Month view (switch at the top right), no
 * column per room. A booking is a block (red, grey once finished) saying what it is, when, in which room and by whom. To book, click or
 * drag over a free time in the Day / Week view (or use New): the booking window then offers only the rooms that are free for that time.
 * It only draws: data and every action come in as props.
 *
 *   bookings   [{ id, date "yyyy-MM-dd", start, end (minutes), roomCode, purpose, roomName, employeeName, status }] -- everything in the view's range
 *   view       "day" | "week" | "month"
 *   onOpen     (booking, element) -> show the booking card anchored to the clicked block
 *   onCreate   (dateStr, startMin, endMin) -> a free time was clicked / dragged
 *   onNew      the toolbar's "New" button
 */
export function TeamsCalendar({
  bookings, loading, anchor, onAnchor, view, onView, timeFormat, onTimeFormat,
  onOpen, onCreate, onNew, newDisabled, emptyMessage,
}) {
  const fmtTime = (m) => (timeFormat === "12" ? minutesTo12hLabel(m) : minutesToLabel(m));
  const step = (dir) => onAnchor(stepAnchor(view, anchor, dir));
  const unit = VIEWS[view].toLowerCase();
  const goToDay = (d) => { onAnchor(startOfDay(d)); onView("day"); };
  const days = useMemo(() => {
    const a = startOfDay(anchor);
    return view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(a), i)) : [a];
  }, [view, anchor]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-4 px-1 text-[11px] flex-wrap text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: PAST_BG, borderColor: PAST }}/>Past</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: BOOKED_BG, borderColor: BOOKED }}/>Booked</span>
      </div>
    <div className="flex bg-card rounded-lg border border-border shadow-sm overflow-hidden min-h-[560px] h-[calc(100vh-236px)] max-h-[860px]" style={{ fontFamily: '"Segoe UI", var(--font-sans)' }}>
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Toolbar, in the order the Teams calendar uses. */}
        <div className="flex items-center flex-wrap gap-1 px-3 py-2 min-h-[52px] border-b border-border">
          <button type="button" onClick={() => onAnchor(startOfDay(new Date()))}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-semibold rounded-md bg-transparent border-none cursor-pointer text-foreground hover:bg-muted">
            <CalendarDays size={16}/> Today
          </button>
          <button type="button" aria-label={`Previous ${unit}`} onClick={() => step(-1)} className="p-1.5 rounded-md bg-transparent border-none cursor-pointer text-foreground hover:bg-muted">
            <ChevronLeft size={18}/>
          </button>
          <button type="button" aria-label={`Next ${unit}`} onClick={() => step(1)} className="p-1.5 rounded-md bg-transparent border-none cursor-pointer text-foreground hover:bg-muted">
            <ChevronRight size={18}/>
          </button>

          {/* What is on screen, then the standard date field to jump to any day (type or pick), no mini calendar. */}
          <span className="ml-1 text-sm font-semibold text-foreground whitespace-nowrap">{rangeLabel(view, anchor)}</span>
          <div className="w-[160px] ml-2">
            <DatePickerCalendar value={toDateStr(anchor)} onChange={(iso) => iso && onAnchor(startOfDay(fromDateStr(iso)))} ariaLabel="Go to date"/>
          </div>

          <div className="flex-1"/>

          {/* Day / Week / Month, like the Teams view switch. */}
          <Dropdown align="right" trigger={({ toggle }) => (
            <button type="button" onClick={toggle} aria-label="Calendar view"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 max-md:py-0 max-md:h-[32px] text-sm font-semibold rounded-md border border-border bg-transparent cursor-pointer text-foreground hover:bg-muted">
              {VIEWS[view]} <ChevronDown size={14}/>
            </button>
          )}>
            {(close) => Object.entries(VIEWS).map(([key, label]) => (
              <MenuItem key={key} checked={view === key} onClick={() => { onView(key); close(); }}>{label}</MenuItem>
            ))}
          </Dropdown>

          <Dropdown align="right" trigger={({ toggle }) => (
            <button type="button" onClick={toggle} title="More options" className="p-1.5 max-md:p-0 max-md:w-[32px] max-md:h-[32px] max-md:flex max-md:items-center max-md:justify-center rounded-md bg-transparent border-none cursor-pointer text-foreground hover:bg-muted">
              <MoreHorizontal size={18}/>
            </button>
          )}>
            {(close) => (
              <>
                <MenuHeader>Time format</MenuHeader>
                <MenuItem checked={timeFormat === "24"} onClick={() => { onTimeFormat("24"); close(); }}>24-hour (15:00)</MenuItem>
                <MenuItem checked={timeFormat === "12"} onClick={() => { onTimeFormat("12"); close(); }}>12-hour (3 PM)</MenuItem>
              </>
            )}
          </Dropdown>

          <span className="hidden sm:block w-px h-6 bg-border mx-1"/>
          <button type="button" onClick={onNew} disabled={newDisabled} title={newDisabled ? "Select a location first" : "Create a new booking"}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 max-md:py-0 max-md:h-[32px] max-md:min-w-[32px] text-sm font-semibold rounded-md border-none text-white cursor-pointer bg-[#5B5FC7] hover:enabled:bg-[#4F52B2] disabled:opacity-50 disabled:cursor-not-allowed">
            <CalendarPlus size={16}/> <span className="hidden sm:inline">New</span>
          </button>
          {/* Phone: the Filters icon is the last item of the toolbar. */}
        </div>

        {loading ? <Spinner message="Loading bookings…"/> : emptyMessage ? (
          <p className="text-sm text-muted-foreground text-center py-20">{emptyMessage}</p>
        ) : view === "month" ? (
          <MonthGrid anchor={startOfDay(anchor)} bookings={bookings} fmtTime={fmtTime} onOpen={onOpen} onDay={goToDay}/>
        ) : (
          <TimeGrid days={days} bookings={bookings} hourPx={SCALES["30"].hourPx} timeFormat={timeFormat}
            fmtTime={fmtTime} onOpen={onOpen} onCreate={onCreate} onDay={goToDay} compact={view === "week"}/>
        )}
      </div>
    </div>
    </div>
  );
}

// The Day view (one column) and the Week view (seven, Sunday first), the hours down the side (the whole day, opening at 8 AM). Click or drag over a free
// time to book it; a booking block opens its card. Times that have already passed are shaded and cannot be booked. Which ROOM is booked is
// chosen in the booking window, which lists only the rooms free for the time picked here.
function TimeGrid({ days, bookings, hourPx, timeFormat, fmtTime, onOpen, onCreate, onDay, compact }) {
  const [now, setNow] = useState(() => new Date());
  const [drag, setDrag] = useState(null); // { date, a, b } minutes while selecting
  const dragRef = useRef(null);
  const START = SLOT_START_MIN;
  const END = SLOT_END_MIN;
  const HOURS = (END - START) / 60;
  const y = (min) => ((min - START) / 60) * hourPx;
  const scrollRef = useRef(null);
  // The day runs 00:00 to 24:00; the view opens at 8 AM and the rest is a scroll away.
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, y(8 * 60) - 8); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const todayStr = toDateStr(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const byDate = useMemo(() => {
    const map = {};
    days.forEach((d) => {
      const ds = toDateStr(d);
      map[ds] = layoutDay(bookings.filter((b) => b.date === ds && b.end > START && b.start < END));
    });
    return map;
  }, [days, bookings, START, END]);
  const cols = `${GUTTER}px repeat(${days.length}, minmax(0, 1fr))`;
  const minuteAt = (e, el) => START + Math.max(0, Math.min(END - START - 30, Math.floor((((e.clientY - el.getBoundingClientRect().top) / hourPx) * 60) / 30) * 30));
  const pastUntilFor = (ds) => (ds < todayStr ? 24 * 60 : ds === todayStr ? nowMin : 0);

  const startDrag = (e, ds) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    const el = e.currentTarget;
    const pastUntil = pastUntilFor(ds);
    const a = minuteAt(e, el);
    if (a + 30 <= pastUntil) return; // already over
    dragRef.current = { date: ds, a, b: a };
    setDrag({ date: ds, a, b: a });
    const move = (ev) => { dragRef.current = { ...dragRef.current, b: minuteAt(ev, el) }; setDrag({ ...dragRef.current }); };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d) return;
      const start = Math.min(d.a, d.b);
      const end = Math.max(d.a, d.b) + 30;
      if (end > pastUntil) onCreate(ds, start, end);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-auto relative select-none">
      {/* Day headers: weekday and date, today highlighted -- click one to open that day. */}
      <div className="sticky top-0 z-[5] grid border-b border-border bg-card" style={{ gridTemplateColumns: cols }}>
        <div/>
        {days.map((d) => {
          const ds = toDateStr(d);
          const today = ds === todayStr;
          return (
            <button key={ds} type="button" onClick={() => onDay(d)} title="Open this day"
              className="flex flex-col items-center justify-center gap-0.5 py-2 min-w-0 border-l border-border bg-transparent border-t-0 border-r-0 border-b-0 cursor-pointer hover:bg-muted">
              <span className={cn("text-[11px] font-semibold", today ? "text-[#5B5FC7]" : "text-muted-foreground")}>{WEEKDAYS[d.getDay()]}</span>
              <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold", today ? "bg-[#5B5FC7] text-white" : "text-foreground")}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="grid relative" style={{ gridTemplateColumns: cols, height: HOURS * hourPx }}>
        <div className="relative">
          {Array.from({ length: HOURS }, (_, i) => START / 60 + i).map((h) => (
            <span key={h} className="absolute right-2 mt-1 text-xs leading-4 whitespace-nowrap text-muted-foreground" style={{ top: y(h * 60) }}>{hourLabel(h, timeFormat)}</span>
          ))}
        </div>

        {days.map((d) => {
          const ds = toDateStr(d);
          const isToday = ds === todayStr;
          const pastHeight = Math.max(0, Math.min(pastUntilFor(ds), END) - START) / 60 * hourPx;
          return (
            <div key={ds} className="relative border-l border-border cursor-pointer" onPointerDown={(e) => startDrag(e, ds)}>
              {pastHeight > 0 && <div className="absolute inset-x-0 top-0 bg-muted/70 pointer-events-none" style={{ height: pastHeight }}/>}
              {Array.from({ length: HOURS + 1 }, (_, i) => (
                <div key={i} className="pointer-events-none">
                  <div className="absolute inset-x-0 border-t border-border" style={{ top: i * hourPx }}/>
                  {i < HOURS && <div className="absolute inset-x-0 border-t border-dashed border-border/60" style={{ top: i * hourPx + hourPx / 2 }}/>}
                </div>
              ))}

              {drag && drag.date === ds && (
                <div className="absolute inset-x-0.5 rounded bg-[#5B5FC7]/25 border border-[#5B5FC7] pointer-events-none z-[2]"
                  style={{ top: y(Math.min(drag.a, drag.b)), height: ((Math.abs(drag.b - drag.a) + 30) / 60) * hourPx }}/>
              )}

              {byDate[ds].map(({ item: b, col, cols: n }) => {
                const finished = isPastRange(b.date, b.end);
                const { fg: color, bg } = palette(b, finished);
                const top = y(Math.max(b.start, START));
                const height = Math.max((Math.min(b.end, END) - Math.max(b.start, START)) / 60 * hourPx - 2, 34);
                return (
                  <button key={b.id} type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => onOpen(b, e.currentTarget)}
                    title={bookingTip(b, fmtTime)}
                    className="absolute z-[3] box-border overflow-hidden text-left rounded px-1.5 py-[2px] text-[11px] leading-[14px] cursor-pointer border-0 border-l-4 border-solid font-[inherit] hover:brightness-95"
                    style={{ top, height, left: `calc(${(col / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, borderLeftColor: color, backgroundColor: bg, color, boxShadow: "0 0 0 1px var(--card)" }}>
                    <span className="block font-semibold truncate">{b.purpose || b.roomName || "Meeting"}</span>
                    <span className="block truncate">{fmtTime(b.start)} – {fmtTime(b.end)}</span>
                    {height >= 50 && b.roomName && <span className="block truncate opacity-90">{b.roomName}</span>}
                    {!compact && height >= 64 && b.employeeName && <span className="block truncate opacity-80">{b.employeeName}</span>}
                  </button>
                );
              })}

              {isToday && nowMin >= START && nowMin <= END && (
                <div className="absolute inset-x-0 h-[2px] z-[4] pointer-events-none bg-[#5B5FC7]" style={{ top: y(nowMin) - 1 }}/>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The Month view: six whole weeks, Sunday first. A day lists its first few bookings (time and purpose); the rest collapse into "+n more".
// Clicking a day (its number, an empty part of the cell or "+n more") opens that day; clicking a booking opens its card.
const MONTH_CHIPS = 3;
function MonthGrid({ anchor, bookings, fmtTime, onOpen, onDay }) {
  const todayStr = toDateStr(new Date());
  const first = monthGridStart(anchor);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(first, i)), [first.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const byDate = useMemo(() => {
    const map = {};
    bookings.forEach((b) => { (map[b.date] ||= []).push(b); });
    Object.values(map).forEach((list) => list.sort((a, b) => a.start - b.start || a.end - b.end));
    return map;
  }, [bookings]);

  return (
    <div className="flex-1 min-h-0 overflow-auto flex flex-col">
      <div className="grid grid-cols-7 border-b border-border bg-card sticky top-0 z-[5]">
        {WEEKDAYS.map((w) => <div key={w} className="py-2 text-center text-[11px] font-semibold text-muted-foreground">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 flex-1 min-h-[480px]" style={{ gridTemplateRows: "repeat(6, minmax(92px, 1fr))" }}>
        {cells.map((d) => {
          const ds = toDateStr(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = ds === todayStr;
          const list = byDate[ds] || [];
          const shown = list.slice(0, MONTH_CHIPS);
          return (
            <div key={ds} onClick={() => onDay(d)} title="Open this day"
              className={cn("border-l border-b border-border p-1 min-w-0 cursor-pointer hover:bg-muted/50 flex flex-col gap-0.5", !inMonth && "bg-muted/30")}>
              <div className="flex justify-end">
                <span className={cn("inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-full text-xs font-semibold",
                  isToday ? "bg-[#5B5FC7] text-white" : inMonth ? "text-foreground" : "text-muted-foreground")}>
                  {d.getDate() === 1 ? `${d.toLocaleDateString("en-US", { month: "short" })} ${d.getDate()}` : d.getDate()}
                </span>
              </div>
              {shown.map((b) => {
                const finished = isPastRange(b.date, b.end);
                const { fg: color, bg } = palette(b, finished);
                return (
                  <button key={b.id} type="button" onClick={(e) => { e.stopPropagation(); onOpen(b, e.currentTarget); }} title={bookingTip(b, fmtTime)}
                    className="w-full text-left truncate rounded px-1 py-[1px] text-[11px] leading-[16px] cursor-pointer border-0 border-l-[3px] border-solid font-[inherit] hover:brightness-95"
                    style={{ borderLeftColor: color, backgroundColor: bg, color }}>
                    <span className="font-semibold">{fmtTime(b.start)}</span> {b.purpose || b.roomName || "Meeting"}
                  </button>
                );
              })}
              {list.length > MONTH_CHIPS && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onDay(d); }}
                  className="text-left px-1 text-[11px] font-semibold text-[#5B5FC7] bg-transparent border-none cursor-pointer hover:underline">
                  +{list.length - MONTH_CHIPS} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}