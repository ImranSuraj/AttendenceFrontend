import { useState } from "react";
import { X } from "lucide-react";
import { phoneKind, storeUrl, openAppUrl } from "./appLinks";

const KEY = "ec-install-banner-dismissed";
const dismissed = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

// A slim bar on top of the website in a phone's browser (never inside Teams or the installed PWA): Install app (Play Store / App Store) and Open app.
export default function InstallAppBanner() {
  const [hidden, setHidden] = useState(dismissed);
  const kind = phoneKind();
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;
  if (!kind || hidden || standalone) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setHidden(true); };
  const btn = "h-8 px-3 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap";
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border">
      <span className="flex-1 min-w-0 text-xs text-foreground">Get the Employee Connect app</span>
      <a href={openAppUrl()} className={`${btn} inline-flex items-center border border-border text-foreground no-underline`}>Open app</a>
      <a href={storeUrl(kind)} className={`${btn} inline-flex items-center bg-primary text-primary-foreground no-underline`}>Install app</a>
      <button type="button" onClick={close} aria-label="Dismiss" className="bg-transparent border-none p-1 text-muted-foreground cursor-pointer"><X size={16} /></button>
    </div>
  );
}