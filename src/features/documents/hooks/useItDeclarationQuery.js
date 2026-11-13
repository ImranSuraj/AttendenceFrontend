import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMyDeclaration,
  submitDeclaration,
  getAllDeclarations,
  setEditPermission,
  exportAllDeclarations,
  getITDeclarationLookup,
} from "../services/itDeclaration.service";

// Real backend-backed data layer — TanStack Query owns the server-state (current employee's own
// declaration + HRAdmin's per-employee status lookups), no more mock TAX_DECLARATIONS list.
// `initialData` is an empty shell (not mock data) matching the useHolidaysQuery.js convention for
// migrated features — avoids a loading flash while still letting isLoading drive a real spinner.
export const MY_TAX_DECLARATION_QUERY_KEY = ["taxDeclaration", "my"];
const EMPTY_MY_DECLARATION = { exists: false, canEdit: true, documentName: "", declaration: null };

export function useMyDeclarationQuery() {
  return useQuery({
    queryKey: MY_TAX_DECLARATION_QUERY_KEY,
    queryFn: getMyDeclaration,
    initialData: EMPTY_MY_DECLARATION,
  });
}

// A dropdown list of the form, read from the database. enabled=false skips the call (e.g. the NPS fields are hidden).
export function useITDeclarationLookup(operation, regime, enabled = true) {
  return useQuery({
    queryKey: ["taxDeclaration", "lookup", operation, regime || null],
    queryFn: () => getITDeclarationLookup(operation, regime),
    enabled,
  });
}

export function useTaxDeclarationMutations() {
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: (form) => submitDeclaration(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_TAX_DECLARATION_QUERY_KEY }),
    // No onError toast here — TanStack Query's global MutationCache (queryClient.js) already
    // funnels any mutation failure through the central error handler.
  });

  return { submit: submit.mutate, isSubmitting: submit.isPending };
}

// ---- HRAdmin only: full-list lookup (no per-employee status endpoint exists server-side) +
// grant-only edit-permission -----------------------------------------------------------------

export const ALL_TAX_DECLARATIONS_QUERY_KEY = ["taxDeclaration", "all"];

export function useAllDeclarationsQuery() {
  return useQuery({
    queryKey: ALL_TAX_DECLARATIONS_QUERY_KEY,
    queryFn: getAllDeclarations,
    initialData: [],
  });
}

export function useTaxDeclarationAdminMutations() {
  const queryClient = useQueryClient();

  const setPermission = useMutation({
    mutationFn: (employeeCode) => setEditPermission(employeeCode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ALL_TAX_DECLARATIONS_QUERY_KEY }),
  });

  const exportAll = useMutation({
    mutationFn: () => exportAllDeclarations(),
  });

  return {
    grantEditPermission: setPermission.mutate,
    isSettingPermission: setPermission.isPending,
    exportAll: exportAll.mutate,
    isExporting: exportAll.isPending,
  };
}
