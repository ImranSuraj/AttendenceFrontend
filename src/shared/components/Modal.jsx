import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../utils/cn";

// A centred dialog on every screen size: it takes the caller's maxWidth, shrinks to fit a narrow screen (with a gap at the edges) and scrolls inside if it is tall.
export function Modal({ open, onClose, title, children, footer, maxWidth = "max-w-md", closeOnOverlayClick = true, tall = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-[color:var(--colorBackgroundOverlay)] z-50 flex items-center justify-center p-4 ec-overlay" onClick={closeOnOverlayClick ? onClose : undefined}>
      <div
        className={cn("bg-card rounded-xl shadow-2xl w-full flex flex-col ec-sheet", tall ? "max-h-[calc(100vh-2rem)]" : "max-h-[85vh]", "animate-pop-in", maxWidth)}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-4 pr-2 md:px-6 md:pr-6 border-b border-border shrink-0">
          <h3 className="font-semibold text-lg md:text-xl">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="flex items-center justify-center w-[32px] h-[32px] md:w-auto md:h-auto md:p-1 rounded-lg border-0 bg-transparent cursor-pointer transition-colors hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 md:p-6 flex flex-col gap-4 overflow-y-auto min-h-0 max-md:[&>*]:shrink-0">{children}</div>
        {footer && <div className="flex justify-end gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-4 md:px-6 border-t border-border shrink-0 max-md:[&>*]:flex-1">{footer}</div>}
      </div>
    </div>
  );
}

// The same dialog, drawn straight into <body>. Use it where the dialog is rendered inside something that animates or scrolls (a table, a filter row): a transformed ancestor
// would otherwise stand in for the screen and the dialog would not sit at the screen's bottom.
export function PortalModal(props) {
  return createPortal(<Modal {...props}/>, document.body);
}

// `required` adds a red asterisk after the label (the field must be filled in).
export function FormField({ label, children, className, required, error }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-xs md:text-sm font-semibold">
        {label}{required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}

// Fluent text field: 32px tall, 4px corners; the focus line comes from the global form-control rule in theme.css.
// Phones: 44px tall with 16px text (anything smaller makes iOS zoom the page on focus); md and up keep the 32px Fluent field.
export const inputCls = "border border-border rounded-md py-[5px] px-3 text-sm bg-input-background focus:outline-none";
