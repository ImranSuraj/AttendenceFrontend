import { cn } from "../utils/cn";

// Three-dot "typing indicator" style loading state — an alternative to Spinner's spin icon for
// full-page/section loads where a softer, less mechanical animation reads better (see
// animations.css's dotBounce keyframe; respects prefers-reduced-motion the same way every other
// animation in this app does).
export function DotsLoader({ message = "Loading…", className = "" }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-10 text-center", className)}>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-2.5 h-2.5 rounded-full bg-primary dot-bounce" style={{ animationDelay: `${i * 0.15}s` }}/>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
