import { titleCase } from "@/shared/utils/text";

// consolidated.emp_no and empmast.empno may not share the same underlying column width/padding —
// trimming here means an empno compared/looked-up across two different real endpoints (e.g.
// Attendance's log vs. this profile listing) always matches by value, not by incidental padding.
const trimEmpNo = (v) => (typeof v === "string" ? v.trim() : v);

// Maps AMSBackendAPI's EmployeeProfileResponse shape (spv1_GetEmployeeProfile, listing mode) onto
// the shape this app's components already expect (see employees.mock.js's genEmployees) — no
// mock fallback, this is the real Employees listing. Title Case applied to categorical
// fields only (designation/department/status/location/grade/manager) — name/email/address/plant
// stay verbatim (names are proper nouns already correctly cased by HR, address is free text).
export function toEmployeeRow(e) {
  return {
    id: trimEmpNo(e.empNo), empCode: trimEmpNo(e.empNo), name: e.empName,
    designation: titleCase(e.designation), department: titleCase(e.departmentCode),
    email: e.email?.toLowerCase(), mobile: e.mobile,
    manager: e.managerName || e.managerEmpNo || "",
    status: titleCase(e.status), location: titleCase(e.location),
    plant: e.plant, grade: e.grade, address: e.address,
    joinDate: e.dateOfJoining,
    // Raw codes straight from empmast (dept / loc / plant) -- what the Edit form's dropdowns, the
    // filters and the update call work on; the fields above are only for display.
    departmentCode: (e.departmentCode ?? "").trim(),
    locationCode: (e.locationCode ?? "").trim(),
    plantCode: (e.plant ?? "").trim(),
    // The manager's Employee ID (Approver_Master.Appr1) -- what the Edit form's Manager field holds.
    managerEmpNo: (e.managerEmpNo ?? "").trim(),
  };
}

// "CODE - Description"; only the code when the description is blank or the same as the code; null when both blank.
export function codeDesc(code, desc) {
  const c = (code ?? "").trim();
  const d = (desc ?? "").trim();
  if (!c) return d || null;
  return d && d.toLowerCase() !== c.toLowerCase() ? `${c} - ${d}` : c;
}

// The single profile with display fields added. Lowercased e-mail here, centrally; plant/location/grade
// as "Code - Description" for the View and My Profile cards (just the code when there is no description).
export function toProfile(data) {
  return {
    ...data,
    email: data.email?.toLowerCase(),
    plantDisplay: codeDesc(data.plant, data.plantDescription),
    locationDisplay: codeDesc(data.locationCode, data.locationDescription ?? data.location),
    gradeDisplay: codeDesc(data.grade, data.gradeDescription),
  };
}

// A colleague found in the directory search, shaped like an employee row.
export function toDirectoryResult(data) {
  return {
    id: trimEmpNo(data.empNo ?? data.EmpNo),
    empCode: trimEmpNo(data.empNo ?? data.EmpNo),
    name: data.empName ?? data.EmpName,
    designation: titleCase(data.designation ?? data.Designation),
    // The card shows "Code - Description" for department (resolved by the page from the department list),
    // location and plant (descriptions come with the profile).
    departmentCode: (data.departmentCode ?? data.dept ?? "").trim(),
    department: titleCase(data.departmentCode ?? data.dept ?? data.department ?? data.Dept),
    manager: data.manager ?? data.managerName ?? data.Manager ?? "",
    plant: codeDesc(data.plant ?? data.Plant, data.plantDescription) ?? data.plant ?? data.Plant,
    location: codeDesc(data.locationCode, data.locationDescription ?? data.location) ?? titleCase(data.location ?? data.Location),
    // no grade: another employee's grade is not shown in the colleague search
    address: data.address,
    email: (data.email ?? data.Email)?.toLowerCase(),
    mobile: data.phone ?? data.mobile ?? data.Phone,
  };
}
