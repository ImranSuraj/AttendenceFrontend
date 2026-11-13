import * as controller from "../controllers/policy.controller";

// UI policyType is always the plural tab label ("HR Policies"/"IT Policies") -- the real
// dbo.PolicyMaster table's CK_PolicyMaster_PolicyType only allows the singular form ('HR Policy'/
// 'IT Policy'), so every real write/read is translated at this boundary, both ways.
function toDbPolicyType(policyType) {
  return policyType === "IT Policies" ? "IT Policy" : "HR Policy";
}
function toUiPolicyType(policyType) {
  return policyType === "IT Policy" ? "IT Policies" : "HR Policies";
}

function toUiPolicy(record) {
  return {
    id: record.policyId,
    policyName: record.policyName,
    policyType: toUiPolicyType(record.policyType),
    folder: record.policyCategory,
    fileName: record.fileName || "",
  };
}

// Real backend call -- GET /api/policies (AMS.Api's PolicyController, any authenticated
// employee -- matches PolicyDocumentController's Download policy, viewing policies isn't
// HRAdmin-only). No policyType filter is passed -- PoliciesPage.jsx already filters client-side
// by its own selected tab, same as it did against the old seeded mock array.
export async function getPolicies() {
  const data = await controller.list();
  return (data || []).map(toUiPolicy);
}

// Real backend call -- POST /api/policies (AMS.Api's PolicyController, HRAdmin-only). A policy
// is exactly one row per file: attaching several files creates several rows (all sharing this same
// name/type/category), so this always sends a fileNames array and returns every row created (an
// array, even for a single file / no file at all).
export async function addPolicy(policy) {
  const data = await controller.add({
    policyName: policy.policyName,
    policyType: toDbPolicyType(policy.policyType),
    policyCategory: policy.folder,
    fileNames: policy.fileNames || [],
  });
  return (data || []).map(toUiPolicy);
}

// Real backend call -- PUT /api/policies/{id} (AMS.Api's PolicyController, HRAdmin-only). id is
// the 5-digit code string (e.g. "00001") -- PolicyMaster.PolicyId is CHAR(5), not an IDENTITY int,
// so it's passed straight through, never parsed as a number.
export async function updatePolicy(id, patch) {
  const data = await controller.update(id, {
    policyId: id,
    policyName: patch.policyName,
    policyType: toDbPolicyType(patch.policyType),
    policyCategory: patch.folder,
  });
  return toUiPolicy(data);
}
