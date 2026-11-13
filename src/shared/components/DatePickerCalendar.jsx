import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { formatDate, localIsoDate, toDate, toIsoDate } from "@/shared/utils/date";
import { TeamsMiniMonth, todayIso } from "./TeamsCalendarParts";

// Date field with the Teams date picker: a Fluent-style field that opens the Teams mini calendar (month title
// with up/down arrows, S M T W T F S, circular days, today in brand colour, "Go to today"). Replaces the
// browser's built-in <input type="date"> everywhere in the app, so every date is picked the same way.
//   value / onChange(iso)   "yyyy-MM-dd"        min / max   inclusive limits        disabled   greys the field out
// Callers hand over dates in whatever shape their data has: "yyyy-MM-dd", "yyyy-MM-ddTHH:mm:ss", "dd/MM/yyyy" or
// "dd.MM.yyyy". The calendar needs a clean "yyyy-MM-dd"; anything unreadable becomes "" (no selection) so the
// month grid can never turn into "Invalid Date" / NaN.
const normalizeIso = (v) => {
  if (!v) return "";
  const d = toDate(typeof v === "string" ? toIsoDate(v.trim()) : v);
  return d ? localIsoDate(d) : "";
};

// disableSundays: Sundays are shown but cannot be picked (used for leave dates). Saturdays and holidays stay selectable.
const isSundayIso = (iso) => new Date(`${iso}T00:00:00`).getDay() === 0;

export function DatePickerCalendar({ value, onChange, placeholder = "Select date", className, min, max, disabled, ariaLabel, onBlur, disableSundays = false }) {
  const iso = normalizeIso(value);
  const minIso = normalizeIso(min) || undefined;
  const maxIso = normalizeIso(max) || undefined;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = iso ? new Date(`${iso}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const gap = 4;
    const spaceBelow = viewportH - rect.bottom - gap - 8;
    const openUp = spaceBelow < 320 && rect.top > spaceBelow;
    // Phones: the calendar is a bottom sheet over a dimmed page, not a small pop-up beside the field.
    if (window.innerWidth < 768) { setPos({ sheet: true }); return; }
    const left = Math.min(rect.left, window.innerWidth - 264);
    setPos({
      left: Math.max(8, left),
      top: openUp ? undefined : rect.bottom + gap,
      bottom: openUp ? viewportH - rect.top + gap : undefined,
    });
  }, []);

  useLayoutEffect(() => { if (open) updatePosition(); }, [open, updatePosition]);

  // Opening shows the month of the chosen date (or the current month), not whichever month was browsed last.
  useEffect(() => {
    if (!open) return;
    const base = iso ? new Date(`${iso}T00:00:00`) : new Date();
    setVisibleMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    function onScrollOrResize() { updatePosition(); }
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    function onKeyDown(e) { if (e.key === "Escape") setOpen(false); }
    function onDocClick(e) {
      const insideWrapper = wrapperRef.current && wrapperRef.current.contains(e.target);
      const insidePopup = popupRef.current && popupRef.current.contains(e.target);
      if (!insideWrapper && !insidePopup) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const goToday = () => {
    const t = todayIso();
    if ((minIso && t < minIso) || (maxIso && t > maxIso)) { setVisibleMonth(new Date()); return; }
    onChange(t);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onBlur={onBlur}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(o => !o)}
        className={cn("teams-field w-full flex items-center justify-between gap-2 py-[5px] px-3 text-sm text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed", className)}
      >
        <span className={cn("truncate", !iso && "text-muted-foreground")}>{iso ? formatDate(iso) : (value ? formatDate(value) : placeholder)}</span>
        <CalendarDays size={16} className="text-muted-foreground shrink-0" />
      </button>

      {open && pos && createPortal(
        <>
        {pos.sheet && <div className="fixed inset-0 z-[69] bg-[color:var(--colorBackgroundOverlay)]"/>}
        <div
          ref={popupRef}
          role="dialog"
          aria-label="Choose a date"
          style={pos.sheet ? { position: "fixed", left: 8, right: 8, bottom: "calc(8px + env(safe-area-inset-bottom))" } : { position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom }}
          className="teams-popover z-[70] bg-card border border-border rounded-lg shadow-xl p-3"
        >
          <TeamsMiniMonth
            value={iso} month={visibleMonth} onMonthChange={setVisibleMonth} min={minIso} max={maxIso} disableDay={disableSundays ? isSundayIso : undefined}
            onPick={(iso) => { onChange(iso); setOpen(false); }}
          />
          <div className="mt-2 pt-2 border-t border-border">
            <button type="button" onClick={goToday}
              className="text-base md:text-sm font-semibold border-0 bg-transparent cursor-pointer px-2 py-2 md:px-1 md:py-0.5 rounded text-[var(--colorBrandForegroundLink)] hover:underline">
              Go to today
            </button>
          </div>
        </div>
        </>,
        document.body
      )}
    </div>
  );
}
