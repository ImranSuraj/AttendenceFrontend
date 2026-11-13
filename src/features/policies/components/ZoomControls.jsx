import { ZoomIn, ZoomOut } from "lucide-react";

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.25;

// Zoom out / percentage (click to reset to 100%) / zoom in. Shared by the PDF and image viewers.
export function ZoomControls({ zoom, onZoom }) {
  const clamp = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
  const btn = "p-1.5 rounded-md border border-border bg-card cursor-pointer transition-colors hover:enabled:bg-muted disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" title="Zoom out" className={btn} disabled={zoom <= ZOOM_MIN} onClick={() => onZoom(clamp(zoom - ZOOM_STEP))}>
        <ZoomOut size={14}/>
      </button>
      <button type="button" title="Reset to 100%" onClick={() => onZoom(1)}
        className="min-w-[52px] py-1 px-2 text-xs font-medium rounded-md border border-border bg-card cursor-pointer hover:bg-muted">
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" title="Zoom in" className={btn} disabled={zoom >= ZOOM_MAX} onClick={() => onZoom(clamp(zoom + ZOOM_STEP))}>
        <ZoomIn size={14}/>
      </button>
    </div>
  );
}
