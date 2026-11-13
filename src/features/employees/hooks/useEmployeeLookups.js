import { useQuery } from "@tanstack/react-query";
import { getEmployeeProfile, searchEmployeeDirectory, getDepartmentOptions, getLocationOptions } from "../services/employeeProfile.service";

// One employee's full profile (View card, My Profile card, the signed-in user).
export function useEmployeeProfileQuery(empNo, enabled) {
  return useQuery({
    queryKey: ["employeeProfile", empNo],
    queryFn: () => getEmployeeProfile(empNo),
    enabled,
    retry: false,
  });
}

// Find a Colleague: runs once a search has been submitted.
export function useDirectorySearchQuery(query, enabled) {
  return useQuery({
    queryKey: ["employeeDirectorySearch", query],
    queryFn: () => searchEmployeeDirectory(query),
    enabled,
    retry: false,
  });
}

export function useDepartmentOptionsQuery() {
  return useQuery({ queryKey: ["departmentOptions"], queryFn: getDepartmentOptions });
}

export function useLocationOptionsQuery(departmentCode) {
  return useQuery({ queryKey: ["locationOptions", departmentCode], queryFn: () => getLocationOptions(departmentCode) });
}