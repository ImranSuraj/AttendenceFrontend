import { useState } from "react";
import { toast } from "sonner";
import { Download, ShieldCheck } from "lucide-react";
import { Btn } from "@/shared/components/Btn";
import { Modal, FormField } from "@/shared/components/Modal";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { downloadDeclarationPdfFor } from "../services/itDeclaration.service";
import { useAllDeclarationsQuery, useTaxDeclarationAdminMutations } from "../hooks/useItDeclarationQuery";
import { useEmployees } from "@/features/employees";
import { useHasExactRole } from "@/shared/access/access.store";

// HRAdmin-only actions for Income Tax Declaration, gated by useHasRole("HRAdmin") at the call
// site (IncomeTaxDeclarationTab.jsx) — mirrors Employees's own admin-button pattern
// (a small modal, not a whole extra page). The employee picker searches the FULL company
// directory (useEmployees()), not just admin/list's declarations — admin/list only contains
// employees who have already submitted, which is often empty/sparse, making the search box look
// broken when there's nothing in it to find. Declaration status for whichever employee is picked
// is then looked up client-side from admin/list; employees.service.js already keys `id`/`empCode`
// to the real empno, matching admin/list's `employeeId` exactly, so no extra ID mapping is needed.
// The real backend has no per-employee status lookup — only a full admin/list and a grant-only
// edit-permission action (mirroring the legacy SetPermission WebMethod exactly, which only ever
// unlocks, never re-locks). Export All is a server-built CSV with every column (admin/export).
export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [exporting, setExporting] = useState(false);
  const canExport = useHasExactRole("HRAdmin"); // Export All is HRAdmin only (ITAdmin does not get it)
  const [downloadingFor, setDownloadingFor] = useState(null);
  const employees = useEmployees();
  const { data: declarations } = useAllDeclarationsQuery();
  const { grantEditPermission, isSettingPermission, exportAll } = useTaxDeclarationAdminMutations();

  const selected = declarations.find(d => d.employeeId === employeeId);

  const handleExportAll = () => {
    setExporting(true);
    exportAll(undefined, {
      onSuccess: () => toast.success("Declarations exported"),
      onSettled: () => setExporting(false),
    });
  };

  const handleGrant = () => {
    if (!employeeId) return;
    grantEditPermission(employeeId, { onSuccess: () => toast.success("Edit permission granted") });
  };

  const handleDownload = async (empId) => {
    setDownloadingFor(empId);
    try {
      await downloadDeclarationPdfFor(empId);
      toast.success("Declaration PDF downloaded");
    } catch {
      // Central error handler already toasted the failure.
    }
    setDownloadingFor(null);
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {canExport && (
          <Btn variant="secondary" size="sm" className="text-xs" onClick={handleExportAll} loading={exporting}>
            <Download size={13} /> Export Declarations
          </Btn>
        )}
        <Btn variant="secondary" size="sm" className="text-xs" onClick={() => setOpen(true)}>
          <ShieldCheck size={13} /> Manage Edit Permissions
        </Btn>
      </div>

      {/* min-h ensures room for the SearchableSelect's dropdown to render before an employee is
          picked and the status block below adds its own height — otherwise Modal's overflow-y-auto
          body clips the popup against too-short content. */}
      <Modal open={open} onClose={() => setOpen(false)} title="Manage Declaration Edit Permission" maxWidth="max-w-lg">
        <div className="min-h-[200px] flex flex-col gap-4">
        <FormField label="Employee">
          <SearchableSelect
            options={employees.map(e => ({ value: e.id, label: `${e.name} (${e.empCode || e.id})` }))}
            value={employeeId}
            onChange={setEmployeeId}
            placeholder="Search employee..."
          />
        </FormField>

        {employeeId && (
          <div className="flex flex-col gap-3">
            {selected ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Declaration Status</span>
                  <StatusBadge status="Submitted" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Currently Editable</span>
                  <span className="font-medium text-foreground">{selected.canEdit ? "Yes" : "No — locked"}</span>
                </div>
                <div className="flex gap-2 justify-end">
                  <Btn variant="secondary" size="sm" className="text-xs" onClick={() => handleDownload(employeeId)} loading={downloadingFor === employeeId}>
                    <Download size={13} /> Download
                  </Btn>
                  {!selected.canEdit && (
                    <Btn variant="primary" size="sm" onClick={handleGrant} loading={isSettingPermission}>
                      Grant Edit Access
                    </Btn>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">This employee has not submitted a declaration yet.</p>
            )}
          </div>
        )}
        </div>
      </Modal>
    </>
  );
}
