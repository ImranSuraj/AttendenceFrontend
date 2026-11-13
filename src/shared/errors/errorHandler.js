import { toast } from "sonner";

// Central place every error in the app funnels through — the axios response
// interceptor (api.js), TanStack Query's global QueryCache/MutationCache
// onError, and the ErrorBoundary's componentDidCatch all call this instead of
// each call site rolling its own try/catch + toast.
export function handleError(error, context) {
  const message = normalizeErrorMessage(error);
  console.error(context ? `[${context}]` : "[error]", error);
  toast.error(message, { id: `err:${message}` }); // the same text replaces itself instead of stacking (retries and page re-opens would otherwise repeat it)
  return message;
}

export function normalizeErrorMessage(error) {
  const message = baseErrorMessage(error);
  // An unexpected server error carries the id the server's error log shows for it: quoted to support, it finds the exact entry.
  const reference = error?.response?.status >= 500 ? error?.response?.data?.traceId : null;
  return reference ? `${message} (Reference: ${reference})` : message;
}

function baseErrorMessage(error) {
  if (error?.response?.data?.message) return error.response.data.message;
  // No message from the API itself: say what the HTTP status means instead of axios's bare
  // "Request failed with status code 404".
  const status = error?.response?.status;
  if (status === 404) return "This action isn't available on the server right now. Please try again later or contact support.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do this.";
  if (status >= 500) return "The server ran into a problem. Please try again in a moment.";
  if (error?.code === "ERR_NETWORK") return "Can't reach the server. Check your connection and try again.";
  if (error?.message) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong. Please try again.";
}
