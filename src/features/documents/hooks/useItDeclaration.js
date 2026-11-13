import { useMyDeclarationQuery, useTaxDeclarationMutations } from "./useItDeclarationQuery";

// Feature-facing hook consumed by IncomeTaxDeclarationTab.jsx — returns the current employee's
// { exists, canEdit, documentName, declaration } shape from the real backend (see
// taxdeclaration.service.js's getMyDeclaration). `canEdit` is false once a declaration has been
// submitted and the employee has already used their one edit, until HRAdmin grants it again via
// the admin panel (AdminPanel.jsx / useTaxDeclarationAdminMutations).
export function useMyDeclaration() {
  const { data } = useMyDeclarationQuery();
  return data;
}

export function useTaxDeclarationActions() {
  const { submit, isSubmitting } = useTaxDeclarationMutations();
  return { submit, isSubmitting };
}
