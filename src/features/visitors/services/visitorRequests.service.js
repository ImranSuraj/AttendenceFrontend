import * as controller from "../controllers/visitorRequests.controller";
import { searchEmployees, getDepartmentOptions } from "@/features/employees";

// Visitor management -- real backend (VisitorRequestsController, dbo.spv1_ManageVisitorRequest):
//   POST /api/visitors/requests        Visitor form Submit (the server also e-mails the employee being visited)
//   POST /api/visitors/requests/list   Visitor Requests table (the server scopes it: Receptionist / ITAdmin see all,
//                                      everybody else only the requests addressed to them)
//   POST /api/visitors/requests/decide Accept / Reject (no e-mail)
//   POST /api/visitors/requests/update Fill in the details of a Scheduled request (made from a conference booking)
//
// A request, as the pages use it: { id, date "yyyy-MM-dd", time "HH:mm", visitorName, contactNumber, visitorEmail,
//   company, purpose, noOfVisitors, hostEmpNo, hostName, hostEmail, hostDepartment, status: Pending|Accepted|Rejected,
//   decidedOn, decidedBy, decidedByName }

function toRequest(r) {
  return {
    id: r.requestId,
    date: r.createdDate,
    time: r.createdTime,
    visitorName: r.visitorName,
    contactNumber: r.contactNumber,
    visitorEmail: r.visitorEmail,
    company: r.company,
    purpose: r.purpose,
    noOfVisitors: r.noOfVisitors,
    hostEmpNo: (r.hostEmpNo ?? "").trim(),
    hostName: r.hostName,
    hostEmail: r.hostEmail ?? "",
    hostDepartment: r.hostDepartment ?? "",
    status: r.status,
    decidedOn: r.decidedOn ? r.decidedOn.slice(0, 10) : "",
    decidedBy: (r.decidedBy ?? "").trim(),
    decidedByName: r.decidedByName ?? "",
    meetingType: r.meetingType ?? "Walk In",   // "Walk In" (Visitor form) | "Scheduled" (made from a conference booking)
  };
}

export async function submitVisitorRequest(form) {
  const data = await controller.submit({
    visitorName: form.visitorName.trim(),
    contactNumber: form.contactNumber.trim(),
    visitorEmail: form.visitorEmail.trim(),
    company: form.company.trim(),
    purpose: form.purpose.trim(),
    noOfVisitors: Number(form.noOfVisitors),
    hostEmpNo: form.host.id,
  });
  return toRequest(data);
}

// No filters are sent: the table filters (dates / status / search) run in the page over the rows the server allows.
export async function getVisitorRequests() {
  const data = await controller.list();
  return (data ?? []).map(toRequest);
}

// Fills in the missing details of a Scheduled request (the one made from a conference booking): host, Receptionist or ITAdmin.
export async function updateVisitorRequest({ id, form }) {
  const data = await controller.update(id, {
    requestId: id,
    visitorName: form.visitorName.trim(),
    contactNumber: form.contactNumber.trim(),
    visitorEmail: form.visitorEmail.trim(),
    company: form.company.trim(),
    purpose: form.purpose.trim(),
    noOfVisitors: Number(form.noOfVisitors),
  });
  return toRequest(data);
}

export async function decideVisitorRequest({ id, decision }) {
  const data = await controller.decide(id, { decision });
  return toRequest(data);
}

// ---- "Whom you want to meet": live employee search -----------------------------------------------------------
// Option text is "EmployeeName - Department" with the department's DESCRIPTION only (never its code).
export async function getDepartmentNames() {
  const options = await getDepartmentOptions();
  const map = new Map();
  options.forEach(o => {
    const code = String(o.value ?? "").trim();
    const label = String(o.label ?? "");
    const name = label.startsWith(`${code} - `) ? label.slice(code.length + 3).trim() : "";
    map.set(code.toUpperCase(), name);
  });
  return map;
}

export async function searchHosts(query, departmentNames, plant) {
  const rows = await searchEmployees(query, plant);
  return rows.map(e => {
    const department = departmentNames?.get(String(e.departmentCode ?? "").trim().toUpperCase()) || "";
    return {
      id: e.id, name: e.name, email: e.email || "", department,
      label: department ? `${e.name} - ${department}` : e.name,
    };
  });
}
