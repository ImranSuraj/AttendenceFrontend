import { useQueries, useQuery } from "@tanstack/react-query";
import { getAttendanceLog, getAttendanceStatsSummary } from "../services/attendanceLog.service";

// Single employee's log (self, or one specific reportee selected from the dropdown).
export function useAttendanceLog(empNo, fromDate, toDate) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["attendanceLog", empNo, fromDate, toDate],
    queryFn: () => getAttendanceLog({ empNo, fromDate, toDate }),
    enabled: !!empNo && !!fromDate && !!toDate,
    initialData: [],
  });
  return { data, isLoading, isError };
}

// spv1_GetAttendanceLog takes exactly one @EmpNo per call — there is no bulk "all my reportees"
// endpoint, so "All Reportees" (no specific reportee picked) fires one query per reportee in
// parallel and merges the results, rather than inventing a bulk backend contract.
export function useAttendanceLogsForEmployees(empNos, fromDate, toDate) {
  const results = useQueries({
    queries: empNos.map(empNo => ({
      queryKey: ["attendanceLog", empNo, fromDate, toDate],
      queryFn: () => getAttendanceLog({ empNo, fromDate, toDate }),
      enabled: !!empNo && !!fromDate && !!toDate,
      initialData: [],
    })),
  });
  const isLoading = results.some(r => r.isLoading);
  const isError = results.some(r => r.isError);
  const data = results.flatMap(r => r.data || []);
  return { data, isLoading, isError };
}

const EMPTY_STATS_SUMMARY = { present: 0, earlyExit: 0, late: 0, absent: 0, onDuty: 0, forgotToSwipe: 0 };
const STATS_SUMMARY_KEYS = Object.keys(EMPTY_STATS_SUMMARY);

// Backs the 6-card Present/Early Exit/Late/Absent/On Duty/Forgot to Swipe stat row on both
// HomePage (self-scoped, single-element empNos) and AttendancePage (self or the whole
// scoped-employees list). dbo.spv1_GetAttendanceStatsSummary takes exactly one @EmpNo per call
// (same as spv1_GetAttendanceLog) — no bulk endpoint exists — so this fires one query per
// employee in parallel (mirroring useAttendanceLogsForEmployees above) and sums the six real
// backend-computed counts client-side. Summing already-correct per-employee totals is not the
// same as the old client-side derivation this replaced (that recomputed statuses from raw log
// rows) — each individual number still comes straight from the stored procedure.
export function useAttendanceStatsSummary(empNos, fromDate, toDate) {
  const results = useQueries({
    queries: (empNos || []).map(empNo => ({
      queryKey: ["attendanceStatsSummary", empNo, fromDate, toDate],
      queryFn: () => getAttendanceStatsSummary({ empNo, fromDate, toDate }),
      enabled: !!empNo && !!fromDate && !!toDate,
      initialData: EMPTY_STATS_SUMMARY,
    })),
  });
  const isLoading = results.some(r => r.isLoading);
  const isError = results.some(r => r.isError);
  const data = STATS_SUMMARY_KEYS.reduce((acc, key) => {
    acc[key] = results.reduce((sum, r) => sum + (r.data?.[key] || 0), 0);
    return acc;
  }, {});
  return { data, isLoading, isError };
}
