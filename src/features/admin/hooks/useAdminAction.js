import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// A mutation that toasts the server's own message and refreshes the listed data.
export function useAdminAction(fn, invalidateKeys) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      toast.success(res?.message || "Saved.");
      invalidateKeys.forEach(k => queryClient.invalidateQueries({ queryKey: k }));
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Could not save the change."),
  });
}