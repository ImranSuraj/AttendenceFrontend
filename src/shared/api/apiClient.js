import axios from "axios";
import { API_BASE_URL } from "./config";
import { handleError } from "../errors/errorHandler";
import { getToken, useAuthStore } from "../auth/auth.store";
import { sanitizeDeep } from "../utils/sanitize";

// Central HTTP client — the ONE place every feature's service.js should
// eventually route real network calls through when a backend exists. Right
// now this app runs entirely on mock data (see each feature's <feature>.mock.js
// + <feature>.service.js), but every service function is already written as
// `async () => { ...resolve mock data with a delay... }` so swapping a
// service function's body to `return api.get('/leaves').then(r => r.data)`
// is a one-line change per function, with auth/error handling already wired
// up here.
// The API address comes from config.js (the one place the URLs are set).
export const resolvedBaseUrl = API_BASE_URL;

// Every call asks the browser and any proxy in between for a fresh answer (never a stored copy), in development and production alike.
const noCacheHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" };

export const api = axios.create({
  baseURL: resolvedBaseUrl,
  timeout: 30000,
  headers: { "Content-Type": "application/json", ...noCacheHeaders },
});

// Who is calling: the session token the backend issued at sign-in (Microsoft Teams SSO, or the temporary Employee ID page), sent as
// "Authorization: Bearer ...". The backend takes the employee number from it and looks the role up in dbo.EmployeeConnectRoles -- nothing
// about identity or role is sent by the browser. Exported so raw fetch() calls that bypass this axios instance (document download /
// upload, which need native streaming progress) attach the very same header.
export function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

api.interceptors.request.use((config) => {
  Object.assign(config.headers, getAuthHeaders());
  return config;
});

// Response interceptor — every failed request funnels through the same
// central error handler (toast + console.error) so individual call sites
// never need their own try/catch just to report a failure. Pass
// `{ skipErrorToast: true }` in a call's config to opt out — for soft,
// non-critical reads that gracefully fall back to mock data instead of
// failing the feature (e.g. a live enhancement over an already-rendered row).
//
// GLOBAL XSS/HTML-injection hardening (VAPT pass): every successful response body is recursively
// stripped of any HTML markup (sanitizeDeep) before it reaches ANY calling code — one choke point
// protecting every feature's service.js, current and future, rather than requiring each of them to
// remember to sanitize their own responses. React's own JSX escaping already prevents this data
// from executing as script when rendered, but this adds a second, independent layer (defense in
// depth) that also protects any future non-JSX use of the same data (e.g. a CSV export, a toast
// message, a window.title assignment) that wouldn't get React's escaping for free.
api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === "object") {
      response.data = sanitizeDeep(response.data);
    }
    return response;
  },
  (error) => {
    // A rejected session (expired / revoked): back to the sign-in page. Sign-in calls themselves are excluded.
    if (error.response?.status === 401 && !String(error.config?.url ?? "").includes("/auth/")) {
      useAuthStore.getState().signOut();
    }
    // Marked here so queryClient.js's QueryCache/MutationCache onError (which sees this same
    // error again once it propagates) doesn't toast it a second time — every error in this app
    // currently originates from this axios instance, so without this flag every failed
    // query/mutation showed its error toast twice.
    // A read the server refuses (403) is not worth a message: the page simply has nothing to show this person (for example an approval list for someone
    // who approves nobody). Refused actions (save, cancel, delete ...) still say so. It is still written to the console.
    const quietRefusal = error.response?.status === 403 && String(error.config?.method).toLowerCase() === "get";
    if (quietRefusal) { console.warn("[api] read refused (403):", error.config?.url); error.__toasted = true; }
    else if (!error.config?.skipErrorToast) { handleError(error, "api"); error.__toasted = true; }
    return Promise.reject(error);
  }
);

export default api;
