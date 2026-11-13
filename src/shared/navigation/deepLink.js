// Deep link from an e-mail, e.g. {site}/?module=leave&scope=team&requestNo=123 (a request in the approval queue / in My Requests with scope=mine) or
// {site}/?module=visitorRequests&requestId=1000 (a visitor request), opens that request in the app. The link is read ONCE at start-up and held in
// sessionStorage, because the person may still have to sign in (Teams SSO / Employee ID) before the app can act on it; the address bar is then cleaned so a
// refresh or a shared URL does not replay it. Only a known page, scope and a numeric request number are accepted -- anything else is ignored.
const KEY = "ec-deeplink";
const SCOPES = new Set(["team", "mine"]);
// module -> what the link must carry for it to be accepted (anything else is ignored)
const VALID = {
  leave: (p) => SCOPES.has(p.get("scope") ?? "") && /^\d{1,12}$/.test(p.get("requestNo") ?? ""),
  visitorRequests: (p) => /^\d{1,12}$/.test(p.get("requestId") ?? ""),
  servicedesk: (p) => /^[A-Za-z0-9-]{1,20}$/.test(p.get("ticketNo") ?? ""),
};

// A Teams notification opens the app with the same "module=...&requestId=..." text as its sub-page id (app.getContext().page.subPageId).
export function captureTeamsDeepLink(subPageId) {
  try {
    if (!subPageId) return;
    const p = new URLSearchParams(String(subPageId));
    const module = p.get("module");
    if (module && Object.hasOwn(VALID, module) && VALID[module](p)) {
      sessionStorage.setItem(KEY, JSON.stringify({ module, scope: p.get("scope"), requestNo: p.get("requestNo"), requestId: p.get("requestId"), ticketNo: p.get("ticketNo") }));
    }
  } catch { /* storage unavailable -- the app just opens on the start page */ }
}

export function captureDeepLink() {
  try {
    const p = new URLSearchParams(window.location.search);
    const module = p.get("module");
    if (!module) return;
    if (Object.hasOwn(VALID, module) && VALID[module](p)) {
      sessionStorage.setItem(KEY, JSON.stringify({ module, scope: p.get("scope"), requestNo: p.get("requestNo"), requestId: p.get("requestId"), ticketNo: p.get("ticketNo") }));
    }
    ["module", "scope", "requestNo", "requestId", "ticketNo"].forEach(k => p.delete(k));
    const rest = p.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
  } catch { /* storage or history unavailable -- the link simply opens the normal start page */ }
}

export function peekDeepLink() {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? "null"); } catch { return null; }
}

export function clearDeepLink() {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
// The list a mail link lands on normally starts on the current month, which would hide the request the link is about. A page opened from an e-mail uses this
// wider range instead -- 3 months back from today to the end of next year; every other visit keeps the page's own default.
export function emailLinkRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  const pad = (n) => String(n).padStart(2, "0");
  return {
    fromDate: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    toDate: `${now.getFullYear() + 1}-12-31`,
  };
}
