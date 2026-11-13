export function validatePolicyForm(form) {
  const errors = {};
  if (!form.policyName || !form.policyName.trim()) errors.policyName = "Policy name is required";
  if (!form.policyType) errors.policyType = "Policy type is required";
  if (!form.folder || !form.folder.trim()) errors.folder = "Policy Category is required";
  return errors;
}
