import { RefreshCw } from "lucide-react";
import { cn } from "../utils/cn";

// Fluent (Teams) buttons, with the exact state colours from the Teams theme tokens: primary = brand fill,
// secondary = white with a neutral border, ghost = the subtle (transparent) button.
const variantClasses = {
  primary: "bg-[color:var(--colorBrandBackground)] text-[color:var(--colorNeutralForegroundOnBrand)] border-transparent hover:bg-[color:var(--colorBrandBackgroundHover)] active:bg-[color:var(--colorBrandBackgroundPressed)]",
  secondary: "bg-[color:var(--colorNeutralBackground1)] text-[color:var(--colorNeutralForeground1)] border-[color:var(--colorNeutralStroke1)] hover:bg-[color:var(--colorNeutralBackground1Hover)] hover:border-[color:var(--colorNeutralStroke1Hover)] active:bg-[color:var(--colorNeutralBackground1Pressed)] active:border-[color:var(--colorNeutralStroke1Pressed)]",
  ghost: "bg-transparent text-[color:var(--colorNeutralForeground2)] border-transparent hover:bg-[color:var(--colorSubtleBackgroundHover)] hover:text-[color:var(--colorNeutralForeground2Hover)] active:bg-[color:var(--colorSubtleBackgroundPressed)]",
  danger: "bg-destructive text-destructive-foreground border-transparent hover:brightness-90 active:brightness-75",
  // Kept as an alias: the whole app now uses the Teams brand purple as its primary.
  teams: "bg-[color:var(--colorBrandBackground)] text-[color:var(--colorNeutralForegroundOnBrand)] border-transparent hover:bg-[color:var(--colorBrandBackgroundHover)] active:bg-[color:var(--colorBrandBackgroundPressed)]",
};

const sizeClasses = {
  sm: "h-8 max-md:h-[32px] px-3 text-[13px] md:text-sm",   // phone: compact 36px; Fluent medium button (32px) from md up
  xs: "h-[32px] min-w-[32px] px-2.5 text-xs md:h-6 md:min-w-0 md:px-2",   // phone: 36px; Fluent small button (24px) from md up
};

// loading: shows a spinner in place of the button's own icon/content and disables it, so a
// mutation in flight (apply/approve/reject/cancel/save/etc.) visibly tells the user it's
// processing instead of looking unresponsive to a second click.
export function Btn({ children, variant = "primary", size = "sm", onClick, className = "", disabled = false, loading = false, title, style, "aria-label": ariaLabel }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={style}
      aria-label={ariaLabel}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-semibold rounded-md transition-colors border cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {loading ? <RefreshCw size={14} className="animate-spin"/> : null}
      {loading ? null : children}
    </button>
  );
}
