import { titleCase } from "@/shared/utils/text";
import * as controller from "../controllers/employeeProfile.controller";
import { toDirectoryResult, toEmployeeRow, toProfile } from "./employeeRows";

// Filters take effect on the server only for an HR admin; anyone else always gets just their own record.
export async function getEmployees({ departmentCode, locationCode } = {}) {
  const rows = await controller.getEmployees({ departmentCode: departmentCode || undefined, locationCode: locationCode || undefined });
  return rows.map(toEmployeeRow);
}

// Department dropdown: value = department code, label = "Code - Description".
export async function getDepartmentOptions() {
  return ((await controller.getDepartments()) ?? []).map((d) => ({
    value: d.code,
    // A blank description shows the code alone, with no dangling " - ".
    label: d.name && d.name.trim() ? `${d.code} - ${d.name.trim()}` : d.code,
  }));
}

// Location dropdown: with a department only the locations it exists in, otherwise every active one.
export async function getLocationOptions(departmentCode) {
  const rows = (await controller.getLocations({ departmentCode: departmentCode || undefined })) ?? [];
  return rows.map((l) => ({ value: l.locationId, label: titleCase(l.locationName) }));
}

// Throws on failure, so the screen shows the real error state.
export async function getEmployeeProfile(empNo) {
  return toProfile(await controller.getProfile(empNo));
}

// "My Reportees" for any manager.
export async function getMyReportees() {
  return (await controller.getReportees()).map(toEmployeeRow);
}

// Active employees by partial name / number (top 20), open to every signed-in employee.
// plant (optional): only employees of that plant code.
export async function searchEmployees(query, plant) {
  return (await controller.search({ query, plant: plant || undefined })).map(toEmployeeRow);
}

// One colleague by employee number or e-mail; null when there is no match.
export async function searchEmployeeDirectory(query) {
  const data = await controller.getDirectory({ query });
  if (!data || !(data.empNo ?? data.EmpNo)) return null;
  return toDirectoryResult(data);
}