import { useQueries, useQuery } from "@tanstack/react-query";
import { getLiveLeaveBalance, getLeaveBalanceHistorySummary, getLeaveBalanceHistoryDatewise } from "../services/leaveBalanceHistory.service";

// enabled: a window that shows the balance passes "is it open", so the balance is fetched fresh every time the window opens (not once when the page loaded).
export function useLiveLeaveBalanceQuery(leaveYear, enabled = true) {
  return useQuery({
    queryKey: ["liveLeaveBalance", leaveYear],
    queryFn: () => getLiveLeaveBalance(leaveYear),
    enabled,
    initialData: [],
  });
}

// Employee Leave Balance page (spv1_LeaveBalanceHistory) — year is optional here (the SP defaults
// to the current year and returns a rolling 4-year window when omitted).
export function useLeaveBalanceHistorySummaryQuery(year) {
  return useQuery({
    queryKey: ["leaveBalanceHistorySummary", year ?? null],
    queryFn: () => getLeaveBalanceHistorySummary(year),
    initialData: [],
  });
}

// Datewise drill-down for one selected year — only fetched once a year is actually picked from
// the summary grid (enabled: !!year), matching the legacy page's own "select a row to load detail"
// flow instead of eagerly fetching every year's dates up front.
export function useLeaveBalanceHistoryDatewiseQuery(year) {
  return useQuery({
    queryKey: ["leaveBalanceHistoryDatewise", year],
    queryFn: () => getLeaveBalanceHistoryDatewise(year),
    enabled: !!year,
    initialData: [],
  });
}

// "My Reportees' Leave Balance" modal — LeaveBalanceController takes one empNo per call (Manager+,
// re-verified as a real reportee server-side), so this fans out one call per reportee in parallel
// rather than inventing a bulk endpoint.
const SKIP = "skip";
export function useReporteeLeaveBalances(reporteeEmpNos, leaveYear, enabled = true) {
  const results = useQueries({
    queries: reporteeEmpNos.map(empNo => ({
      queryKey: ["liveLeaveBalance", leaveYear, empNo],
      // The server's definite "no" (403 = not this manager's to see, 404 = no such / inactive employee) marks the person to be left out of the list; any other failure
      // (network, server error) becomes null = "not available" for that person. Neither is an error for the whole list.
      queryFn: () => getLiveLeaveBalance(leaveYear, empNo, true).catch((err) => ([403, 404].includes(err?.response?.status) ? SKIP : null)),
      enabled: enabled && !!empNo,
      retry: false,
      initialData: [],
    })),
  });
  // isLoading = this reportee's balance is still being fetched (initialData keeps react-query's own isLoading false).
  return reporteeEmpNos.map((empNo, i) => {
    const data = results[i]?.data;
    return { empNo, balances: Array.isArray(data) ? data : [], unavailable: data === null, skip: data === SKIP, isLoading: !!results[i]?.isFetching };
  });
}
