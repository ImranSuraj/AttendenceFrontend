// The "Reset my password" link in the e-mail opens the portal as {site}/?resetToken={guid}. The token is read ONCE when the page loads and then removed from the
// address bar, so it does not stay in the browser history, a refresh, or a copied address. It is kept for the tab only (sessionStorage) so a refresh of the
// reset form does not lose it. Only a real GUID is accepted.
const KEY = "ec-reset-token";
const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function capture() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("resetToken");
    if (token === null) return;
    if (GUID.test(token)) sessionStorage.setItem(KEY, token);
    params.delete("resetToken");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
  } catch { /* storage or history unavailable: the link just opens the sign-in page */ }
}
capture();

export function getResetLinkToken() {
  try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; }
}

export function clearResetLinkToken() {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
