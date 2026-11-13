import { useMutation } from "@tanstack/react-query";

// An upload: failures are shown as a toast by the global MutationCache.
export function useUploadMutation(uploadFn) {
  return useMutation({ mutationFn: uploadFn });
}