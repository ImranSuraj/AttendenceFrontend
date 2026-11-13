import { useState } from "react";
import { ZoomControls } from "./ZoomControls";

// An image policy with zoom in / out: at 100% it fits the viewer; zoomed in, it scrolls.
export function ImageViewer({ src, alt }) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className="flex flex-col gap-2">
      <ZoomControls zoom={zoom} onZoom={setZoom}/>
      <div className="h-[calc(100vh-18rem)] overflow-auto rounded-md bg-muted p-3">
        <img src={src} alt={alt} className="block mx-auto max-w-none rounded-md"
          style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? "100%" : "none", height: "auto" }}/>
      </div>
    </div>
  );
}
