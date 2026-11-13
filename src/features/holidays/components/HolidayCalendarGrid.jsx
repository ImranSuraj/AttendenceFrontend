import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { TeamsMonthGrid, toIso } from "@/shared/components/TeamsCalendarParts";

const DANGER = "var(--colorStatusDangerBackground3)";

// Holiday calendar in the Teams "Month" layout: the toolbar Teams puts above its calendar (Today, previous/next,
// the month), then the month grid with each holiday as a coloured event chip.
export function HolidayCalendarGrid({ holidays, month: monthProp, onMonthChange }) {
  const [internalMonth, setInternalMonth] = useState(new Date(2025, 9, 1));
  // Touch screens have no hover: tapping a holiday shows its name as a tooltip above it (keeps inside the screen); any tap / scroll elsewhere hides it.
  const [picked, setPicked] = useState(null);
  const showTip = (e, name) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const half = 110;
    // Anchored at the exact point tapped (the chip's centre only for a keyboard press, which has no point).
    const x = e.clientX || r.left + r.width / 2;
    const y = e.clientY || r.top;
    const left = Math.min(Math.max(x, half + 8), window.innerWidth - half - 8);
    setPicked({ name, left, top: Math.max(y - 12, 40) });
  };
  useEffect(() => {
    if (!picked) return;
    const hide = () => setPicked(null);
    window.addEventListener("click", hide);
    window.addEventListener("scroll", hide, true);
    return () => { window.removeEventListener("click", hide); window.removeEventListener("scroll", hide, true); };
  }, [picked]);
  const calMonth = monthProp || internalMonth;
  const setCalMonth = onMonthChange || setInternalMonth;

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const byDate = new Map();
  holidays.forEach((h) => { byDate.set(h.date, [...(byDate.get(h.date) || []), h]); });

  const goToday = () => { const n = new Date(); setCalMonth(new Date(n.getFullYear(), n.getMonth(), 1)); };

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden" style={{ fontFamily: "var(--font-sans)" }}>
      <div className="flex items-center gap-1 px-3 py-2 min-h-[52px] border-b border-border">
        <button type="button" onClick={goToday}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-semibold rounded-md border-0 bg-transparent cursor-pointer text-foreground hover:bg-[var(--colorSubtleBackgroundHover)] active:bg-[var(--colorSubtleBackgroundPressed)]">
          <CalendarDays size={16}/> Today
        </button>
        <button type="button" aria-label="Previous month" onClick={() => setCalMonth(new Date(year, month - 1, 1))}
          className="p-1.5 rounded-md border-0 bg-transparent cursor-pointer text-foreground hover:bg-[var(--colorSubtleBackgroundHover)]"><ChevronLeft size={18}/></button>
        <button type="button" aria-label="Next month" onClick={() => setCalMonth(new Date(year, month + 1, 1))}
          className="p-1.5 rounded-md border-0 bg-transparent cursor-pointer text-foreground hover:bg-[var(--colorSubtleBackgroundHover)]"><ChevronRight size={18}/></button>
        <span className="ml-1 text-sm font-semibold text-foreground">{calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
      </div>

      <TeamsMonthGrid
        year={year} month={month} className="rounded-none border-0" minCellHeight={92}
        renderDay={(date, { inMonth, iso }) => (byDate.get(iso) || []).map((h) => (
          <div key={h.name} title={h.name} role="button" tabIndex={0}
            onClick={(e) => showTip(e, h.name)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") showTip(e, h.name); }}
            className="px-1.5 py-0.5 rounded text-xs leading-4 font-semibold text-foreground line-clamp-2 border-l-[3px] border-solid cursor-pointer"
            style={{ borderLeftColor: DANGER, backgroundColor: `color-mix(in srgb, ${DANGER} 14%, var(--card))`, opacity: inMonth ? 1 : 0.7 }}>
            {h.name}
          </div>
        ))}
      />

      {/* Touch screens have no hover: tapping a holiday shows its full name here. */}
      {/* Rendered in document.body: a parent with a transform / animation would otherwise make "fixed" relative to itself and shift the tooltip off the tapped cell. */}
      {picked && createPortal(
        <div role="tooltip" className="md:hidden fixed z-[1000] max-w-[220px] px-2.5 py-1.5 rounded-md text-xs font-semibold shadow-lg pointer-events-none"
          style={{ left: picked.left, top: picked.top, transform: "translate(-50%, -100%)", background: "var(--foreground)", color: "var(--background)" }}>
          {picked.name}
        </div>, document.body)}

      <div className="flex gap-4 px-4 py-2 border-t border-border text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-l-4" style={{ borderColor: DANGER, backgroundColor: `color-mix(in srgb, ${DANGER} 14%, var(--card))` }}/>Holiday</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--colorBrandBackground)" }}/>Today</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-border bg-muted/60"/>Weekend</span>
      </div>
    </div>
  );
}