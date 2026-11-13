import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/shared/components/DataTable";
import { Modal, FormField, inputCls } from "@/shared/components/Modal";
import { Btn } from "@/shared/components/Btn";
import { Spinner } from "@/shared/components/Spinner";
import { useApproverMappingsQuery, useApproverMappingSave } from "../hooks/useApproverMappings";

// Admin > Approver Mapping (HR Admin): who approves the leave, on duty and forgot-to-swipe requests of each employee, and where the employee swipes (D / A).
// The checks are the legacy page's: employee numbers digits only, the two location flags letters only; the server checks them again.
const EMPTY = { employeeNo: "", approver1: "", approver2: "", locationSwipe: "D", locationApproval: "D" };
const digits = /^\d+$/;
const letters = /^[A-Za-z]+$/;

function validate(f, isNew) {
  if (isNew && !digits.test(f.employeeNo.trim())) return "Employee number only allows numbers";
  if (!digits.test(f.approver1.trim())) return "Level1 Approver only allows numbers";
  if (!digits.test(f.approver2.trim())) return "Level2 Approver only allows numbers";
  if (!letters.test(f.locationSwipe.trim())) return "Location Swipe only allows strings";
  if (!letters.test(f.locationApproval.trim())) return "Location Approval only allows strings";
  return "";
}

export default function ApproverMappingPage() {
  const { data: rows = [], isLoading } = useApproverMappingsQuery();
  const [form, setForm] = useState(null);       // null = closed
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState("");

  const save = useApproverMappingSave(isNew, (message) => { toast.success(message); setForm(null); });

  const open = (row) => {
    setError("");
    setIsNew(!row);
    setForm(row ? { employeeNo: row.employeeNo, approver1: row.approver1 ?? "", approver2: row.approver2 ?? "", locationSwipe: row.locationSwipe ?? "D", locationApproval: row.locationApproval ?? "D" } : { ...EMPTY });
  };
  const submit = () => {
    const problem = validate(form, isNew);
    if (problem) { setError(problem); return; }
    setError("");
    save.mutate(form);
  };
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  // number and name shown together: "3661 - Name"
  const join = (no, name) => (no ? (name ? `${no} - ${name}` : no) : "");
  const tableRows = useMemo(() => rows.map(r => ({ ...r, employee: join(r.employeeNo, r.employeeName), level1: join(r.approver1, r.approver1Name), level2: join(r.approver2, r.approver2Name) })), [rows]);
  const cols = [
    { key: "employee", label: "Employee" }, { key: "level1", label: "Level1 Approver" }, { key: "level2", label: "Level2 Approver" },
    { key: "locationSwipe", label: "Location Swipe" }, { key: "locationApproval", label: "Location Approval" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Btn className="max-md:h-7 max-md:px-2.5 max-md:text-xs" variant="primary" size="sm" onClick={() => open(null)}><Plus size={14} /> Add mapping</Btn>
      </div>

      {isLoading ? <Spinner message="Loading mappings…" /> : (
        <DataTable title="Approver mappings" columns={cols} data={tableRows} exportFileName="Approver_Mapping"
          actions={(row) => <Btn className="max-md:h-7 max-md:px-2.5 max-md:text-xs" variant="ghost" size="xs" aria-label="Edit" title="Edit" onClick={() => open(row)}><Pencil size={13} /></Btn>} />
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={isNew ? "Add approver mapping" : `Edit approver mapping - ${form?.employeeNo ?? ""}`}
        footer={<><Btn className="max-md:h-7 max-md:px-2.5 max-md:text-xs" variant="primary" size="sm" onClick={submit} loading={save.isPending}>Save</Btn><Btn className="max-md:h-7 max-md:px-2.5 max-md:text-xs" variant="secondary" size="sm" onClick={() => setForm(null)}>Cancel</Btn></>}>
        {form && (
          <>
            {isNew && <FormField label="Employee (employee number)" required><input value={form.employeeNo} onChange={set("employeeNo")} maxLength={50} inputMode="numeric" className={inputCls} /></FormField>}
            <FormField label="Level1 Approver (employee number)" required><input value={form.approver1} onChange={set("approver1")} maxLength={50} inputMode="numeric" className={inputCls} /></FormField>
            <FormField label="Level2 Approver (employee number)" required><input value={form.approver2} onChange={set("approver2")} maxLength={50} inputMode="numeric" className={inputCls} /></FormField>
            <FormField label="Location Swipe" required>
              <select value={form.locationSwipe} onChange={set("locationSwipe")} className={inputCls}><option value="D">D</option><option value="A">A</option></select>
            </FormField>
            <FormField label="Location Approval" required>
              <select value={form.locationApproval} onChange={set("locationApproval")} className={inputCls}><option value="D">D</option><option value="A">A</option></select>
            </FormField>
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          </>
        )}
      </Modal>
    </div>
  );
}
