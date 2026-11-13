import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listLoginAccounts, registerLoginAccount } from "../services/registerAccounts.service";

export const LOGIN_ACCOUNTS_KEY = ["access", "loginAccounts"];

// Every account is loaded once (up to 500); the table's own search, sorting, export and paging work on them.
export function useLoginAccountsQuery() {
  return useQuery({ queryKey: LOGIN_ACCOUNTS_KEY, queryFn: () => listLoginAccounts(), staleTime: 0 });
}

// Registers an employee for password sign-in. onRegistered runs after the success toast; onFailed gets the message to show.
export function useRegisterLoginAccount({ onRegistered, onFailed }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerLoginAccount,
    onSuccess: (res) => {
      toast.success(res?.message || "Login account created.");
      onRegistered();
      queryClient.invalidateQueries({ queryKey: LOGIN_ACCOUNTS_KEY });
    },
    onError: (err) => onFailed(err?.response?.data?.message ?? "Could not create the login account."),
  });
}