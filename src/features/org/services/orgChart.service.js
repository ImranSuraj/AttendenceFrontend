// Real AMSBackendAPI integration for the Organization Chart — replaces the old org.mock.js
// (hardcoded ORG_TREE flat company tree) entirely.
//
// Assumed contract (parallel backend work, AMS.Api/Features/Org — reconcile once confirmed):
//   POST /org/chart   body: { empNo }  (empNo optional — omitted/null lets the backend default
//                                       to the caller's own identity via the X-Employee-No header
//                                       api.js's getAuthHeaders() already attaches to every
//                                       request; passed explicitly here anyway, same convention as
//                                       attendance.service.js's getAttendanceLog, so the target
//                                       employee is unambiguous even if the header default ever
//                                       changes)
//   -> { data: OrgNode }
//   OrgNode = { id, name, designation, department, email, children: OrgNode[], managerUnresolved }
// A single tree rooted at the top of the company: every ancestor on the straight-line chain down
// to the target employee has exactly one child, and the target employee's own node carries their
// real full multi-level subtree as `children`. Field names already match what OrgNodeCard.jsx
// renders 1:1 (id/name/designation/department/email/children), so toOrgNode() below is a thin
// recursive pass-through/defensive-normalize — the one spot to adjust if the real backend's actual
// field names differ from this guess.
//
// `managerUnresolved` (bool) — true only on the node where the ancestor walk had to stop early
// because that employee's Appr1/manager was NULL or blank in the source data, before reaching the
// real CEO root (empno 3603). Absent/false on every other node.
import * as controller from "../controllers/orgChart.controller";

function toOrgNode(n) {
  if (!n) return null;
  return {
    id: n.id ?? n.empNo,
    name: n.name ?? n.empName,
    designation: n.designation,
    department: n.department,
    email: n.email?.toLowerCase(),
    managerUnresolved: !!n.managerUnresolved,
    children: Array.isArray(n.children) ? n.children.map(toOrgNode) : [],
  };
}

export async function getOrgTree(empNo) {
  const data = await controller.chart({ empNo: empNo || undefined });
  return toOrgNode(data);
}
