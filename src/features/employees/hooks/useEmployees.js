import { useQuery } from "@tanstack/react-query";
import { useEmployeesQuery } from "./useEmployeesQuery";
import { CURRENT_USER } from "../employees.mock";
import { useEmployeeProfileQuery } from "./useEmployeeLookups";
import { getMyReportees } from "../services/employeeProfile.service";
import { titleCase } from "@/shared/utils/text";
import { useAuthStore } from "@/shared/auth/auth.store";

export function useEmployees() {
  return useEmployeesQuery().data;
}

// The signed-in employee's real number (from the session the backend issued at sign-in), trimmed so it matches trimEmpNo()'d values coming
// back from other real endpoints exactly. Distinct from CURRENT_USER.id below, which deliberately stays the mock id for internal mock-data consistency.
export function useCurrentEmployeeNo() {
  return useAuthStore(s => s.empNo)?.trim() || undefined;
}

// CURRENT_USER (employees.mock.js) is still the source of truth for anything the rest of the app
// depends on being internally consistent with the mock dataset — Dashboard's mock attendance/leave
// records are generated keyed by this SAME mock .id (e.g. "EMP002"). Overriding .id to the real
// empno here would break those mock lookups (confirmed: this is exactly what happened when this
// was tried, Dashboard went blank). So .id stays from mock — but empCode/manager/location ARE
// overlaid with real values below: they're pure display fields nowhere used as a mock lookup key
// (grepped: only ever rendered, never compared against another mock record), so showing the real
// AMS1002-style-dummy-free value here is safe. department is ALSO overlaid now (real designation
// next to mock department looked visibly inconsistent, e.g. "Executive - IT · Finance"). joinDate/
// status still intentionally NOT overridden — not asked for, and not display-inconsistent the way
// department/manager/location were.
export function useCurrentUser() {
  const DEMO_EMPLOYEE_NO = useCurrentEmployeeNo();
  const { data: liveProfile } = useEmployeeProfileQuery(DEMO_EMPLOYEE_NO, !!DEMO_EMPLOYEE_NO);

  if (!liveProfile) return CURRENT_USER;

  return {
    ...CURRENT_USER,
    name: liveProfile.empName,
    email: liveProfile.email?.toLowerCase(),
    mobile: liveProfile.mobile,
    designation: titleCase(liveProfile.designation),
    plant: liveProfile.plant,
    grade: liveProfile.grade,
    address: liveProfile.address,
    empCode: liveProfile.empNo,
    manager: titleCase(liveProfile.managerName) || liveProfile.managerEmpNo || "",
    // Raw empno of the manager, for the Apply Leave "Authorized Person" field — resolving via the
    // display name above and a mock/name lookup is unreliable (a real name won't match anything in
    // the mock EMPLOYEES array), so this is the one actually usable for a real backend call.
    managerEmpNo: liveProfile.managerEmpNo?.trim ? liveProfile.managerEmpNo.trim() : liveProfile.managerEmpNo,
    // spv1_GetEmployeeProfile's Location = RTRIM(e.loc_desc), a real human-readable description —
    // no plant-code fallback: a plant code (e.g. "BLRF") isn't a location name and looked wrong
    // when it silently stood in for a blank location.
    location: titleCase(liveProfile.location),
    // The employee's location CODE (empmast.loc) -- e.g. the Holiday Calendar's default location.
    locationCode: (liveProfile.locationCode ?? "").trim(),
    // "Code - Description" versions for display (profile cards); `location`/`plant`/`grade` above stay raw
    // because other screens match on them.
    departmentCode: (liveProfile.departmentCode ?? "").trim(),
    locationDisplay: liveProfile.locationDisplay,
    plantDisplay: liveProfile.plantDisplay,
    gradeDisplay: liveProfile.gradeDisplay,
    department: titleCase(liveProfile.departmentCode),
  };
}

// The signed-in employee's own plant code from the real profile ("" when there is none, e.g. a visitor or contract login) -- never the mock user's plant.
export function useMyPlantCode() {
  const DEMO_EMPLOYEE_NO = useCurrentEmployeeNo();
  const { data } = useEmployeeProfileQuery(DEMO_EMPLOYEE_NO, !!DEMO_EMPLOYEE_NO);
  return (data?.plant ?? "").trim();
}

// Companion to useCurrentUser() for callers that need to know whether the real profile is still
// loading (e.g. HomePage, to show a real loading spinner instead of briefly rendering
// CURRENT_USER's mock fields before the live profile arrives) — same queryKey as useCurrentUser()'s
// own useQuery call, so TanStack Query dedupes this into the SAME request/cache entry rather than
// firing a second network call. Deliberately additive/separate from useCurrentUser() itself rather
// than changing its return shape, since 9 other call sites already destructure its plain object
// return value directly.
export function useCurrentUserLoading() {
  const DEMO_EMPLOYEE_NO = useCurrentEmployeeNo();
  const { isLoading } = useEmployeeProfileQuery(DEMO_EMPLOYEE_NO, !!DEMO_EMPLOYEE_NO);
  return isLoading && !!DEMO_EMPLOYEE_NO;
}

// Real AMSBackendAPI call (spv1_GetEmployeeProfile, @ManagerEmpNo mode) — real reportee identities
// (names/empno), used by every feature that needs "my reportees" now (Attendance, Leave).
export function useLiveMyReportees() {
  return useLiveMyReporteesState().data;
}

// Same list plus `ready` (the list has really been fetched, so an empty list means "no reportees" and not "not loaded yet").
export function useLiveMyReporteesState() {
  const DEMO_EMPLOYEE_NO = useCurrentEmployeeNo();
  const { data, isFetched } = useQuery({
    queryKey: ["myReportees", DEMO_EMPLOYEE_NO],
    queryFn: getMyReportees,
    enabled: !!DEMO_EMPLOYEE_NO,
    retry: false,
    initialData: [],
  });
  return { data, ready: isFetched };
}
