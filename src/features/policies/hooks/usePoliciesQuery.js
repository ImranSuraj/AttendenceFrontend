import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPolicies, addPolicy, updatePolicy } from "../services/policy.service";

export const POLICIES_QUERY_KEY = ["policies"];

// Real backend list now (dbo.PolicyMaster via spv1_ManagePolicy's GET operation) -- no more
// seeded-mock initialData, since showing fake demo rows before the real fetch resolves would
// misrepresent actual DB state.
export function usePoliciesQuery() {
  return useQuery({
    queryKey: POLICIES_QUERY_KEY,
    queryFn: getPolicies,
    initialData: [],
  });
}

export function usePolicyMutations() {
  const queryClient = useQueryClient();

  const withOptimisticUpdate = (updater) => ({
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: POLICIES_QUERY_KEY });
      const previous = queryClient.getQueryData(POLICIES_QUERY_KEY);
      queryClient.setQueryData(POLICIES_QUERY_KEY, (old = []) => updater(old, payload));
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(POLICIES_QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: POLICIES_QUERY_KEY }),
  });

  // No optimistic prepend here -- Add can create anywhere from 0 to MAX_FILE_COUNT rows (one per
  // attached file), so there's no single "the new row" to fake client-side; just invalidate and
  // let the real rows arrive from the refetch.
  const addMutation = useMutation({
    mutationFn: (policy) => addPolicy(policy),
    onSettled: () => queryClient.invalidateQueries({ queryKey: POLICIES_QUERY_KEY }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }) => updatePolicy(id, patch),
    ...withOptimisticUpdate((old, { id, patch }) => old.map(p => (p.id === id ? { ...p, ...patch } : p))),
  });

  return {
    add: addMutation.mutate,
    update: (id, patch) => updateMutation.mutate({ id, patch }),
  };
}
