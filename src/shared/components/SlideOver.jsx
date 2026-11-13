import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../utils/cn";

// Right-side slide-in panel — same visual language as Modal (border/shadow/rounded corners,
// header/body/footer structure) but a fixed-position shell that slides in from the viewport's
// right edge instead of appearing centered. Used by Conference Room Booking for both the booking
// details view and the booking create/edit form (see ConferencePage.jsx) — anywhere else in the
// app that wants a "drawer" instead of a centered dialog should reuse this rather than duplicating
// the transition/backdrop logic.
//
// Unlike Modal (a plain `if (!open) return null`), this stays mounted for one extra transition
// tick after `open` flips false so the translate-x-full slide-out is actually visible instead of
// the panel just vanishing instantly.
export function SlideOver({ open, onClose, title, subtitle, children, footer, widthClass = "max-w-md", bodyClass = "p-6 gap-4", closeOnOutside = true }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    // closeOnOutside={false}: only the X button / the panel's own buttons close it (no Escape, no backdrop click).
    if (!mounted || !closeOnOutside) return;
    function onKeyDown(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onClose, closeOnOutside]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div
        className={cn("absolute inset-0 bg-[color:var(--colorBackgroundOverlay)] transition-opacity duration-200", visible ? "opacity-100" : "opacity-0")}
        onClick={closeOnOutside ? onClose : undefined}
      />
      <div
        className={cn(
          "relative h-full w-full bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-200 ease-out",
          visible ? "translate-x-0" : "translate-x-full",
          widthClass
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 px-6 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3 className="font-semibold text-xl text-foreground truncate">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg border-0 bg-transparent cursor-pointer transition-colors hover:bg-muted shrink-0">
            <X size={18}/>
          </button>
        </div>
        <div className={`${bodyClass} flex flex-col overflow-y-auto flex-1 min-h-0`}>{children}</div>
        {footer && <div className="flex justify-end gap-2 p-4 px-6 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
