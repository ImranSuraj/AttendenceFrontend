import { create } from "zustand";
import { captureTeamsDeepLink } from "../navigation/deepLink";

// A quick guess made before anything renders. Teams loads a tab in an iframe (desktop, web and usually mobile), or -- on a phone -- in a webview that
// either names Teams in its user agent or has the Teams native bridge (window.nativeInterface) injected. A guess can be wrong, so initTeamsHost() below
// confirms it with the Teams SDK; the guess only avoids a flash of the wrong layout and decides whether Teams sign-in is tried straight away.
export function isInTeams() {
  try {
    if (typeof window === "undefined") return false;
    return window.self !== window.top || /\bTeams(?:Mobile)?[/-]/i.test(window.navigator.userAgent || "") || typeof window.nativeInterface !== "undefined";
  } catch {
    // Reading window.top can throw across origins -- which also means we are framed.
    return true;
  }
}

// Where the app is running. clientType is what the Teams SDK reports ("android", "ios", "web", "desktop", ...) once it has answered.
export const useHostStore = create(() => ({ inTeams: isInTeams(), confirmed: false, clientType: null }));

// The Teams SDK is started once and shared: the host check and the Teams sign-in both wait on this same promise (starting it twice at once is not safe).
let sdkReady = null;
export function ensureTeamsSdk() {
  if (!sdkReady) {
    sdkReady = import("@microsoft/teams-js").then(async ({ app }) => { await app.initialize(); return app; });
    sdkReady.catch(() => { sdkReady = null; }); // a failed start (not in Teams) may be tried again later
  }
  return sdkReady;
}

// Asks the Teams SDK where we are and marks <html data-host="teams" data-client="android"> so styles can follow it. The SDK answers only inside Teams, so
// a successful answer also corrects a wrong "not Teams" guess (a phone webview that matched none of the guesses).
export async function initTeamsHost() {
  const apply = (inTeams, clientType) => {
    useHostStore.setState({ inTeams, confirmed: true, clientType });
    const root = document.documentElement;
    if (inTeams) { root.dataset.host = "teams"; if (clientType) root.dataset.client = clientType; }
    else { delete root.dataset.host; delete root.dataset.client; }
  };
  if (useHostStore.getState().inTeams) document.documentElement.dataset.host = "teams";
  try {
    const app = await Promise.race([ensureTeamsSdk(), new Promise((_, reject) => setTimeout(() => reject(new Error("no Teams host")), 4000))]);
    const context = await app.getContext();
    apply(true, context?.app?.host?.clientType ?? null);
    captureTeamsDeepLink(context?.page?.subPageId); // opened from a Teams notification: open the request it is about
  } catch {
    // Not answered: a page that is neither framed nor named Teams is marked as not in Teams; the guess is kept otherwise.
    if (window.self === window.top && !/\bTeams(?:Mobile)?[/-]/i.test(window.navigator.userAgent || "") && typeof window.nativeInterface === "undefined") apply(false, null);
  }
}

// True inside the Teams phone / tablet apps, whose web view cannot save a file made in the page (see blobDownload.js) and may block window.open.
export function isTeamsMobile() {
  const { inTeams, clientType } = useHostStore.getState();
  if (!inTeams) return false;
  if (clientType) return ["android", "ios", "ipados"].includes(clientType);
  return /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent || ""); // the SDK has not answered yet: go by the device
}

// Opens a web address outside the app: through Teams (the phone's own browser) when inside Teams, otherwise in a new tab.
export async function openExternalLink(url) {
  if (useHostStore.getState().inTeams) {
    try { const app = await ensureTeamsSdk(); await app.openLink(url); return; } catch { /* Teams would not open it: fall through to a plain new tab */ }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
