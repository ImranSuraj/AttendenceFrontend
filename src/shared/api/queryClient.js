import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { handleError } from "../errors/errorHandler";

// One shared QueryClient for the whole app. Every feature's query/mutation
// hooks (`use<Feature>Query.js`) use this — errors from ANY query or mutation
// anywhere in the app funnel through the same central handler, so individual
// components never need their own try/catch around a query/mutation failure.
//
// Caching is disabled everywhere (development and production): data is always asked for again when a page opens, when the window regains focus and when the
// connection returns, and nothing is kept after the last page using it closes -- so a screen never shows old data.

// error.__toasted is set by api.js's response interceptor once it has already shown the toast for
// this exact error — every query/mutation in this app goes through that axios instance, so without
// this guard the same failure was toasted twice (once here, once there).
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => { if (!error?.__toasted) handleError(error, query?.queryKey?.join("/") || "query"); },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => { if (!error?.__toasted) handleError(error, mutation?.options?.mutationKey?.join("/") || "mutation"); },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      // Zero everywhere: most queries start from a placeholder initialData, and with a staleTime above zero react-query treats that placeholder
      // as fresh data and never asks the server on first open (the page stayed empty in a production build).
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: "always",
      refetchOnMount: "always",
      refetchOnReconnect: "always",
    },
    mutations: {
      retry: 0,
    },
  },
});
