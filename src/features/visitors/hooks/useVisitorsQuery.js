import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotificationStore } from "@/features/notifications";
import { getVisitorRequests, submitVisitorRequest, updateVisitorRequest, decideVisitorRequest, getDepartmentNames } from "../services/visitorRequests.service";

export const VISITOR_REQUESTS_QUERY_KEY = ["visitors", "requests"];

// The server decides which requests the signed-in user may see (Receptionist / ITAdmin: all; others: their own).
export function useVisitorRequestsQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: VISITOR_REQUESTS_QUERY_KEY,
    queryFn: getVisitorRequests,
    enabled,
    refetchOnWindowFocus: true, // a request submitted in another tab / window shows up when this one is focused
  });
}

export function useVisitorMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: VISITOR_REQUESTS_QUERY_KEY });
  const submit = useMutation({ mutationFn: submitVisitorRequest, onSuccess: invalidate });
  // Accepting / rejecting refreshes the sidebar count at once, which also stops the visitor-request beep (it only runs while a request is waiting).
  const decide = useMutation({ mutationFn: decideVisitorRequest, onSuccess: () => { invalidate(); useNotificationStore.getState().loadCounts(); } });
  const update = useMutation({ mutationFn: updateVisitorRequest, onSuccess: invalidate });
  return { submit, decide, update };
}

export function useDepartmentNamesQuery() {
  return useQuery({ queryKey: ["visitors", "departmentNames"], queryFn: getDepartmentNames });
}
