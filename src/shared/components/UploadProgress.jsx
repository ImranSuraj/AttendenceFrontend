import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

// The upload animation of Upload Documents (spinning icon + progress bar + "Uploading... N%") for any upload. A fetch upload reports no byte progress, so, as in the
// Holiday Calendar upload, the bar climbs to 90% while `active` is true and jumps to 100% when it turns false (the real response arrived), then disappears.
export function UploadProgress({ active, label = "Uploading", value }) {   // value = a real percentage when the caller knows it (otherwise the bar is animated)
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active && value != null) { wasActive.current = true; setVisible(true); return undefined; }
    if (active) {
      wasActive.current = true;
      setVisible(true);
      setProgress(5);
      const timer = setInterval(() => setProgress(p => Math.min(90, p + Math.floor(Math.random() * 12) + 4)), 250);
      return () => clearInterval(timer);
    }
    if (wasActive.current) {
      wasActive.current = false;
      setProgress(100);
      const hide = setTimeout(() => setVisible(false), 600);
      return () => clearTimeout(hide);
    }
  }, [active, value == null]);

  if (!visible) return null;
  const shown = active && value != null ? value : progress;
  return (
    <div className="flex flex-col items-center gap-2 py-3 w-full" role="status" aria-live="polite">
      <RefreshCw size={24} className={active ? "text-primary animate-spin" : "text-primary"} />
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div className="bg-primary h-2 transition-all duration-200" style={{ width: `${shown}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{label}… {shown}%</p>
    </div>
  );
}