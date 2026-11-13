import { useQuery } from "@tanstack/react-query";
import { getOrgTree } from "../services/orgChart.service";
import { useCurrentEmployeeNo } from "@/features/employees/hooks/useEmployees";

// Read-only — no CRUD in the Org Hierarchy UI, just a tree render. `initialData: null` (not a
// mock tree) avoids a loading flash while still letting OrgPage.jsx show a real Spinner via
// `isLoading` for the actual network round trip, matching the convention already established in
// useHolidaysQuery.js/useAttendanceLogQuery.js.
export const orgQueryKey = (empNo) => ["org", "tree", empNo];

export function useOrgQuery() {
  const empNo = useCurrentEmployeeNo();
  return useQuery({
    queryKey: orgQueryKey(empNo),
    queryFn: () => getOrgTree(empNo),
    initialData: null,
  });
}
