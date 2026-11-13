import { useQuery } from "@tanstack/react-query";
import { getConsolidatedPlants, getConsolidatedReport, getForm25Report } from "../services/consolidatedAttendance.service";

export function useConsolidatedPlantsQuery() {
  return useQuery({ queryKey: ["admin", "plants", "consolidated"], queryFn: getConsolidatedPlants });
}

// The report (Consolidated or Form 25) loads by itself once the filters are complete (ready).
export function useAttendanceReportQuery({ kind, form25, from, to, plant, ready }) {
  return useQuery({
    queryKey: ["admin", "attendance", kind, from, to, plant], enabled: ready,
    queryFn: () => (form25 ? getForm25Report : getConsolidatedReport)({ from, to, plant }),
  });
}