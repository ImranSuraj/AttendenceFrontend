import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApplyDates, applyLeaveRequest } from "../services/leaveRequests.service";
import { getLiveLeaveRequests, manageRequest, editRequest } from "../services/leaveRequestList.service";
import { applyOnDutyRequest } from "@/features/on-duty/services/onDutyRequests.service";
import { applyForgotToSwipeRequest } from "@/features/forgot-to-swipe/services/forgotToSwipeRequests.service";

const queryKey = (scope, fromDate, toDate) => ["liveLeaveRequests", scope, fromDate, toDate];
const PAST_TENSE = { APPROVE: "approved", REJECT: "rejected", CANCEL: "cancelled" };

// scope: "mine" | "pending". fromDate/toDate only matter for "mine" (see liveLeave.service.js).
export function useLiveLeaveRequestsQuery(scope, fromDate, toDate) {
  return useQuery({
    queryKey: queryKey(scope, fromDate, toDate),
    queryFn: () => getLiveLeaveRequests(scope, fromDate, toDate),
    initialData: [],
  });
}

// The dates screen of Apply: asked again whenever the leave type or a date changes, and only once both dates are chosen (enabled). No initialData: undefined = not asked yet.
export function useApplyDatesQuery(leaveType, fromDate, toDate, enabled = true) {
  return useQuery({
    queryKey: ["applyDates", leaveType, fromDate, toDate],
    queryFn: () => getApplyDates({ leaveType, fromDate, toDate }),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useLiveLeaveMutations() {
  const queryClient = useQueryClient();
  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ["liveLeaveRequests"] });

  const applyLeave = useMutation({
    mutationFn: applyLeaveRequest,
    onSuccess: (data) => { toast.success(`Leave request ${data.requestNo} submitted`); invalidateAll(); },
  });

  const applyOnDuty = useMutation({
    mutationFn: applyOnDutyRequest,
    onSuccess: (data) => { toast.success(`On-Duty request ${data.requestNo} submitted`); invalidateAll(); },
  });

  const applyForgotToSwipe = useMutation({
    mutationFn: applyForgotToSwipeRequest,
    onSuccess: (data) => { toast.success(`Forgot-to-Swipe request ${data.requestNo} submitted`); invalidateAll(); },
  });

  const manage = useMutation({
    mutationFn: manageRequest,
    onSuccess: (_data, variables) => { toast.success(`Request ${variables.requestNo} ${PAST_TENSE[variables.action] ?? "updated"}`); invalidateAll(); },
  });

  const edit = useMutation({
    mutationFn: editRequest,
    onSuccess: (_data, variables) => { toast.success(`Request ${variables.requestNo} updated`); invalidateAll(); },
  });

  return { applyLeave, applyOnDuty, applyForgotToSwipe, manage, edit };
}
