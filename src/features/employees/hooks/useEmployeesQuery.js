import { useQuery } from "@tanstack/react-query";
import { getEmployees } from "../services/employeeProfile.service";

// Reference pattern for this app's "hybrid" data layer: TanStack Query owns
// the server-state, while any purely local/UI state (filters, selected tab,
// open modal) stays in plain useState/zustand in the page components
// themselves. Optimistic updates use queryClient.setQueryData with an
// onError rollback.
export const EMPLOYEES_QUERY_KEY = ["employees"];

// Real AMSBackendAPI listing (spv1_GetEmployeeProfile) — no mock initialData/fallback; a real
// loading state shows briefly instead of ever substituting mock rows.
export function useEmployeesQuery() {
  return useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: () => getEmployees(),
    initialData: [],
  });
}
