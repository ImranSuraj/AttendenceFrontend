import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./shared/api/queryClient";
import { ErrorBoundary } from "./shared/errors/ErrorBoundary";
import Root from "./app/Root.jsx";
import "./styles/index.css";
import { captureDeepLink } from "./shared/navigation/deepLink";
import { initTeamsHost } from "./shared/utils/teams";
import { keepFocusedFieldVisible, trackVisibleViewport } from "./shared/utils/mobileViewport";

keepFocusedFieldVisible();
trackVisibleViewport();
initTeamsHost(); // confirms with the Teams SDK whether we are inside Teams (and on which client); sets <html data-host>
captureDeepLink(); // an e-mail link (?module=leave&scope=team&requestNo=N) is remembered before anything renders; App opens it after sign-in

// Installable app (PWA): the service worker is registered only on the built site over HTTPS, and never inside Microsoft Teams (the Teams tab stays exactly as it was).
// A relative path keeps it working under /employee-connect/ on IIS.
if ("serviceWorker" in navigator && import.meta.env.PROD && window.isSecureContext && window.self === window.top && !/\bTeams(?:Mobile)?[/-]/i.test(navigator.userAgent || "")) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => { /* not installable here -- the site works as before */ }); });
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </ErrorBoundary>
);
