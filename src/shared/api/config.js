// Where the ASP.NET Core API lives. THE ONE PLACE TO CHANGE (the same file as the phone app's shared/api/config.js).
//   Development (npm run dev): the page calls the API on its OWN address (/api and /hubs) and the dev server forwards those paths to DEV_BACKEND_URL
//     (vite.config.js reads it from here), so the browser never makes a cross-origin call and the server needs no CORS entry.
//   Production (a built site): PRODUCTION_BACKEND_URL. Leave it "" when the API serves the built site itself (same address, at the root or under a path such as
//     /employee-connect/); otherwise the full https address of the backend, e.g. "https://<server>/employee-connect" (the app adds /api).
// Either can be overridden per build with VITE_API_BASE_URL (that value already includes /api).
export const DEV_BACKEND_URL = "https://localhost:7292";   // the backend's https profile; for its http profile use "http://localhost:5230"
export const PRODUCTION_BACKEND_URL = "";                  // "" = the same site as the page

const isDev = !!import.meta.env?.DEV;
export const BACKEND_URL = isDev ? DEV_BACKEND_URL : PRODUCTION_BACKEND_URL;
// The "api" folder next to the page: /api at a site root, /employee-connect/api under that path.
const SAME_SITE_API = typeof document !== "undefined" ? new URL("api", document.baseURI).pathname.replace(/\/$/, "") : "/api";
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || (isDev ? "/api" : BACKEND_URL ? `${BACKEND_URL.replace(/\/$/, "")}/api` : SAME_SITE_API)).replace(/\/$/, "");
export const HUB_URL = API_BASE_URL.replace(/\/api$/, "") + "/hubs/notifications";
export const BACKEND_CONFIGURED = !!API_BASE_URL;