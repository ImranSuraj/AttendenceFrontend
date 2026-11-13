// What the rest of the app may import from the Employees feature (everything else inside it is private).
export { default as EmployeesPage } from "./pages/EmployeesPage";
export {
  useEmployees, useCurrentEmployeeNo, useCurrentUser, useMyPlantCode, useCurrentUserLoading,
  useLiveMyReportees, useLiveMyReporteesState,
} from "./hooks/useEmployees";
export { useDepartmentOptionsQuery } from "./hooks/useEmployeeLookups";
export { searchEmployees, getDepartmentOptions } from "./services/employeeProfile.service";