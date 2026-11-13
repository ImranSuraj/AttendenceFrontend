import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMasterData, getTickets, createTicket, updateTicketStatus, uploadIdCardImage,
  uploadTicketAttachments, exportTickets,
} from "../services/hrTickets.service";

// TanStack Query owns both the ticket list and the master-dropdown data (server-state); the create/
// update-status mutations invalidate every scope's cached list rather than optimistically patching
// it, since "mine" and HRAdmin's "all" scopes are separate cache entries (see hrTicketsQueryKey)
// that a single mutation can't safely predict the shape of. Exactly 2-tier scoping — no manager/
// reportee tier for this feature.
export const HR_MASTER_DATA_QUERY_KEY = ["hr-tickets", "master-data"];
export const hrTicketsQueryKey = (scopeKey) => ["hr-tickets", "list", scopeKey];

const EMPTY_MASTER_DATA = {
  categories: [], subCategories: [], priorities: [], floors: [], bloodGroups: [], lunchTypes: [],
  repairItems: [], stationaryCategories: [], stationarySubCategories: [], stationaryItemDescriptions: [],
  stationaryItemQty: [],
};

export function useHRMasterDataQuery() {
  return useQuery({
    queryKey: HR_MASTER_DATA_QUERY_KEY,
    queryFn: getMasterData,
    initialData: EMPTY_MASTER_DATA,
  });
}

// `scope` = { allEmployees?: boolean } — "mine" (default, no scope, the caller's own tickets) vs
// HRAdmin's "all" (every employee's tickets). `scopeKey` is a small stable string so each scope
// gets its own cache entry (My Tickets and Assigned Tickets never overwrite each other's cached data).
export function useServiceDeskQuery(scope, scopeKey) {
  return useQuery({
    queryKey: hrTicketsQueryKey(scopeKey),
    queryFn: () => getTickets(scope),
    initialData: [],
  });
}

export function useServiceDeskMutations() {
  const queryClient = useQueryClient();
  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ["hr-tickets", "list"] });

  const createMutation = useMutation({ mutationFn: createTicket, onSettled: invalidateAll });
  const updateStatusMutation = useMutation({ mutationFn: updateTicketStatus, onSettled: invalidateAll });
  const uploadImageMutation = useMutation({ mutationFn: uploadIdCardImage });
  const uploadAttachmentsMutation = useMutation({ mutationFn: uploadTicketAttachments });
  const exportMutation = useMutation({ mutationFn: exportTickets });

  return {
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateStatus: updateStatusMutation.mutate,
    isUpdatingStatus: updateStatusMutation.isPending,
    uploadImage: uploadImageMutation.mutateAsync,
    isUploadingImage: uploadImageMutation.isPending,
    uploadAttachments: uploadAttachmentsMutation.mutateAsync,
    isUploadingAttachments: uploadAttachmentsMutation.isPending,
    exportTickets: exportMutation.mutateAsync,
    isExporting: exportMutation.isPending,
  };
}
