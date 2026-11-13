import { useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "../utils/cn";

// A searchable, scrollable dropdown used in place of a plain <select> when the
// option list is long. `options` accepts either a string[] or a
// {value,label}[] array. Controlled like a native select via value/onChange.
//
// The option-list popup is rendered through a portal into document.body and
// positioned with `position: fixed` from the trigger button's bounding rect,
// rather than being an `absolute` child of this component's own wrapper. That
// makes it immune to being clipped by any scrolling ancestor (e.g. a Modal's
// overflow-y-auto body) — the popup's own max-height is instead capped to the
// actual available viewport space above/below the trigger, so a long option
// list is always reachable by scrolling the popup itself, and never requires
// (or gets prematurely closed by) scrolling an ancestor container.
export function SearchableSelect({ value, onChange, options, placeholder = "Select...", disabled, className, icon, popupMinWidth }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState(null);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const normalized = useMemo(
    () => options.map(o => (typeof o === "string" ? { value: o, label: o } : o)),
    [options]
  );

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const gap = 4;
    const edgeMargin = 8;
    const spaceBelow = viewportH - rect.bottom - gap - edgeMargin;
    const spaceAbove = rect.top - gap - edgeMargin;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(320, (openUp ? spaceAbove : spaceBelow)));
    setPos({
      left: rect.left,
      // popupMinWidth (optional) lets the list open wider than a narrow trigger so long labels fit,
      // without running off the right edge of the screen.
      width: Math.min(Math.max(rect.width, popupMinWidth || 0), window.innerWidth - rect.left - 8),
      top: openUp ? undefined : rect.bottom + gap,
      bottom: openUp ? viewportH - rect.top + gap : undefined,
      maxHeight,
    });
  }, [popupMinWidth]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      updatePosition();
    }
    // capture:true so this still fires for scroll events on any scrollable
    // ancestor (e.g. a Modal body), since scroll doesn't bubble but capturing
    // listeners on window still run for it.
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    function onDocClick(e) {
      const insideWrapper = wrapperRef.current && wrapperRef.current.contains(e.target);
      const insidePopup = popupRef.current && popupRef.current.contains(e.target);
      if (!insideWrapper && !insidePopup) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query) return normalized;
    const q = query.toLowerCase();
    return normalized.filter(o => o.label.toLowerCase().includes(q));
  }, [normalized, query]);

  const selected = normalized.find(o => o.value === value);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "teams-field w-full flex items-center justify-between py-[5px] px-3 text-sm text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0 flex items-center">{icon}</span>}
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown size={16} className="text-muted-foreground shrink-0 ml-2" />
      </button>
      {open && !disabled && pos && createPortal(
        <div
          ref={popupRef}
          style={{
            position: "fixed",
            left: pos.left,
            width: pos.width,
            top: pos.top,
            bottom: pos.bottom,
            maxHeight: pos.maxHeight,
          }}
          className="teams-popover z-[70] bg-card border border-border rounded-md shadow-xl flex flex-col"
        >
          <div className="flex items-center gap-2 mt-1 py-2 md:py-1.5 px-3 md:px-2 border-b border-border shrink-0">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 text-sm bg-transparent outline-none min-w-0"
              style={{ borderRadius: 0 }}   // square corners: the global input rule rounds them, which made the blue focus line curve at both ends
            />
          </div>
          <div className="overflow-y-auto pb-1.5 flex-1 min-h-0">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">No matches</p>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
                  className={cn(
                    "w-full text-left px-3 py-2 md:py-1.5 text-sm font-normal bg-transparent border-none cursor-pointer hover:bg-[var(--colorNeutralBackground1Hover)] active:bg-[var(--colorNeutralBackground1Pressed)]",
                    o.value === value && "bg-[var(--colorSubtleBackgroundSelected)]"
                  )}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
