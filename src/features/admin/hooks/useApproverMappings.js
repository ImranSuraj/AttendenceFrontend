import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addApproverMapping, listApproverMappings, updateApproverMapping } from "../services/approverMappings.service";

const KEY = ["admin", "approver-mappings"];

export function useApproverMappingsQuery() {
  return useQuery({ queryKey: KEY, queryFn: listApproverMappings });
}

// Adds (isNew) or changes one mapping, then refreshes the list. onSaved gets the server's message.
export function useApproverMappingSave(isNew, onSaved) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (f) => (isNew ? addApproverMapping : updateApproverMapping)({
      employeeNo: f.employeeNo.trim(), approver1: f.approver1.trim(), approver2: f.approver2.trim(), locationSwipe: f.locationSwipe.trim(), locationApproval: f.locationApproval.trim(),
    }),
    onSuccess: (message) => { onSaved(message); queryClient.invalidateQueries({ queryKey: KEY }); },
  });
}