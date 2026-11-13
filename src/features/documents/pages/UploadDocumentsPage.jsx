import { useState, useEffect, useMemo, useRef } from "react";

import { UploadCloud, Trash2, RefreshCw, CheckCircle, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { Btn } from "@/shared/components/Btn";
import { FormField } from "@/shared/components/Modal";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { UploadProgress } from "@/shared/components/UploadProgress";
import { uploadDocumentsBatch } from "../services/documentUpload.service";
import { useUploadAccessQuery } from "../hooks/useUploadAccess";

// Same real per-file filename rules the backend also enforces (server-side is authoritative;
// this is just immediate feedback) — ported exactly from the legacy SftpBatchUpload.ashx's
// client-side validateFile.
const VALID_MONTHS_UPPER = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const VALID_MONTHS_MIXED = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function validateBulkDocFileName(file, program) {
  if (!file.name.toLowerCase().endsWith(".pdf")) return "Only PDF files are allowed.";
  const base = file.name.replace(/\.pdf$/i, "");
  let isValid = false, monthOk = false;
  if (program === "PayslipUpload") {
    const m = /^(\d+)_([A-Z]{3}\d{2})$/.exec(base);
    isValid = !!m;
    if (isValid) monthOk = VALID_MONTHS_UPPER.includes(m[2].slice(0,3));
  } else if (program === "EmployeeDocumentUpload") {
    const m = /^LETTERS_(\d+)_DOC_([A-Z][a-z]{2}\d{2})$/.exec(base);
    isValid = !!m;
    if (isValid) monthOk = VALID_MONTHS_MIXED.includes(m[2].slice(0,3));
  } else if (["form16partA","form16partB","Mediclaim_card"].includes(program)) {
    isValid = /^\d{1,5}$/.test(base);
    monthOk = true;
  }
  if (!isValid) return "Invalid file name format.";
  return monthOk ? null : "Invalid month or year in file name.";
}

// The expected file name of each upload type (the same rules validateBulkDocFileName checks). Examples use this month and year.
const MON = VALID_MONTHS_UPPER[new Date().getMonth()];
const MON_MIXED = VALID_MONTHS_MIXED[new Date().getMonth()];
const YY = String(new Date().getFullYear()).slice(-2);
const UPLOAD_PROGRAM_OPTIONS = [
  { flag: "canPayslip", value: "PayslipUpload", label: "Payslip", format: "EmployeeNo_MMMYY.pdf", example: `3661_${MON}${YY}.pdf`, note: "month in capitals" },
  { flag: "canEmployeeDoc", value: "EmployeeDocumentUpload", label: "Increment Letter", format: "LETTERS_EmployeeNo_DOC_MmmYY.pdf", example: `LETTERS_3661_DOC_${MON_MIXED}${YY}.pdf`, note: "month like Jan, Feb" },
  { flag: "canMediclaim", value: "Mediclaim_card", label: "Mediclaim e-Card", format: "EmployeeNo.pdf", example: "3661.pdf", note: "employee number only" },
  { flag: "canForm16A", value: "form16partA", label: "Form 16 Part A", format: "EmployeeNo.pdf", example: "3661.pdf", note: "employee number only" },
  { flag: "canForm16B", value: "form16partB", label: "Form 16 Part B", format: "EmployeeNo.pdf", example: "3661.pdf", note: "employee number only" },
];

export default function UploadDocumentsPage() {
  const { data: uploadAccess, isLoading: accessLoading } = useUploadAccessQuery();
  const uploadPrograms = useMemo(
    () => uploadAccess ? UPLOAD_PROGRAM_OPTIONS.filter(p => uploadAccess[p.flag]) : [],
    [uploadAccess]
  );

  const [bulkProgram, setBulkProgram] = useState("");
  const [bulkYear, setBulkYear] = useState("");
  const [bulkRows, setBulkRows] = useState([]); // [{ file, error }]
  const [bulkChipStatus, setBulkChipStatus] = useState({}); // fileName -> "done" | "failed"
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkDone, setBulkDone] = useState(false);
  const [bulkResults, setBulkResults] = useState({ success: [], failed: [] });
  const bulkFileInputRef = useRef(null);

  // Default to the first program the caller is actually allowed to upload, once real access
  // permissions load (matches the legacy GetPanelAccess's own default-selection behavior).
  useEffect(() => {
    if (uploadPrograms.length > 0 && !bulkProgram) setBulkProgram(uploadPrograms[0].value);
  }, [uploadPrograms]); // eslint-disable-line react-hooks/exhaustive-deps

  // File validity depends on which program is selected — re-check already-staged files if the
  // user switches program after adding some.
  useEffect(() => {
    setBulkRows(prev => prev.map(r => ({ ...r, error: validateBulkDocFileName(r.file, bulkProgram) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkProgram]);

  const needsYear = bulkProgram === "form16partA" || bulkProgram === "form16partB";
  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 15 }, (_, i) => String(y - i));
  }, []);

  const onBulkFilesSelected = (files) => {
    if (!files || files.length === 0) return;
    const newRows = Array.from(files).map(f => ({ file: f, error: validateBulkDocFileName(f, bulkProgram) }));
    setBulkRows(prev => [...prev, ...newRows]);
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
  };

  const removeBulkRow = (idx) => {
    setBulkRows(prev => prev.filter((_,i) => i!==idx));
  };

  const resetForm = () => {
    setBulkRows([]);
    setBulkChipStatus({});
    setBulkUploading(false);
    setBulkProgress(0);
    setBulkDone(false);
    setBulkResults({ success: [], failed: [] });
  };

  const submitBulkUpload = async () => {
    const validRows = bulkRows.filter(r => !r.error);
    if (validRows.length === 0) { toast.error("Please add at least one valid file"); return; }
    if (bulkRows.some(r => r.error)) { toast.error("Remove or fix files with errors before uploading"); return; }
    if (needsYear && !bulkYear) { toast.error("Please select a financial year."); return; }

    setBulkUploading(true);
    setBulkProgress(0);
    setBulkChipStatus({});
    const results = { success: [], failed: [] };

    try {
      await uploadDocumentsBatch(
        { program: bulkProgram, selectedYear: bulkYear, files: validRows.map(r => r.file) },
        (evt) => {
          if (evt.type === "progress") {
            setBulkProgress(Math.round((evt.done / evt.total) * 100));
            setBulkChipStatus(prev => ({ ...prev, [evt.file]: evt.success ? "done" : "failed" }));
            if (evt.success) results.success.push(evt.file);
            else results.failed.push(`${evt.file}${evt.message ? " — " + evt.message : ""}`);
          } else if (evt.type === "error") {
            toast.error(evt.message || "Upload failed");
          }
        }
      );
    } catch (err) {
      toast.error(err.message || "Upload failed");
    }

    setBulkResults(results);
    setBulkUploading(false);
    setBulkDone(true);
    if (results.success.length) toast.success(`${results.success.length} document(s) uploaded successfully`);
  };

  return (
    <div className="documents-page flex flex-col gap-4">
      <div className={cn("bg-card rounded-lg border border-border shadow-sm p-6 max-w-4xl animate-fade-in-up", "hover-lift")}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-secondary text-primary flex items-center justify-center shrink-0">
            <UploadCloud size={16}/>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Bulk Document Upload</h3>
            <p className="text-xs text-muted-foreground">Upload employee documents to the document server.</p>
          </div>
        </div>

        {accessLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Checking your upload permissions…</p>
        ) : bulkDone ? (
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle size={40} className={bulkResults.failed.length ? "text-orange-500" : "text-green-600"}/>
              <p className="text-sm font-medium text-foreground">
                {bulkResults.success.length} uploaded, {bulkResults.failed.length} failed
              </p>
            </div>
            {bulkResults.failed.length > 0 && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2 max-h-[120px] overflow-y-auto">
                {bulkResults.failed.map(f => <p key={f}>{f}</p>)}
              </div>
            )}
            <Btn variant="primary" size="sm" onClick={resetForm} className="w-full justify-center mt-2">Upload More</Btn>
          </div>
        ) : bulkUploading ? (
            <div className="py-8"><UploadProgress active value={bulkProgress} /></div>
        ) : uploadPrograms.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">You don't have permission to upload any document type.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {uploadPrograms.map(p => (
                <label key={p.value}
                  className={cn(
                    "flex-1 min-w-[140px] flex items-center justify-center gap-1.5 text-sm text-center py-2 px-3 rounded-md border cursor-pointer transition-colors",
                    bulkProgram === p.value ? "border-primary bg-primary/10 text-foreground font-medium" : "border-border text-muted-foreground hover:bg-muted"
                  )}>
                  <input type="radio" name="bulkProgram" value={p.value} checked={bulkProgram === p.value}
                    onChange={() => { setBulkProgram(p.value); setBulkYear(""); }} className="sr-only"/>
                  {p.label}
                </label>
              ))}
            </div>
            {(() => {
              const sel = UPLOAD_PROGRAM_OPTIONS.find(o => o.value === bulkProgram);
              return sel ? (
                <p className="text-xs text-destructive mt-2" role="note">
                  Expected file name for <strong>{sel.label}</strong>: <span className="font-mono font-semibold">{sel.format}</span> ({sel.note}), e.g. <span className="font-mono font-semibold">{sel.example}</span>.
                </p>
              ) : null;
            })()}
            {/* Financial Year and the file picker sit side by side, both kept narrow. */}
            <div className="flex flex-wrap items-start gap-3 mt-4">
              {needsYear && (
                <FormField label="Financial Year *" className="w-48">
                  <div className={cn("rounded-md", !bulkYear && "ring-1 ring-destructive/60")}>
                    <SearchableSelect value={bulkYear} onChange={setBulkYear} options={yearOptions} placeholder="Select year..."/>
                  </div>
                  {!bulkYear && <p className="text-[11px] text-destructive">Required for Form 16 uploads.</p>}
                </FormField>
              )}
              <FormField label="Select PDF Files" className="w-48">
                {/* Hidden native input + a real button, so it reads as a file picker, not a dropdown. */}
                <input ref={bulkFileInputRef} type="file" multiple accept=".pdf" onChange={e => onBulkFilesSelected(e.target.files)} className="hidden"/>
                <button type="button" onClick={() => bulkFileInputRef.current?.click()}
                  disabled={needsYear && !bulkYear}
                  title={needsYear && !bulkYear ? "Select the financial year first" : undefined}
                  className="flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md border border-dashed border-border bg-transparent text-foreground cursor-pointer transition-colors hover:enabled:bg-muted disabled:opacity-50 disabled:cursor-not-allowed">
                  <Paperclip size={14}/> Choose files
                </button>
              </FormField>
            </div>
            <div className="-mx-2 max-h-[240px] overflow-y-auto divide-y divide-border">
              {bulkRows.map((row, i) => {
                const status = bulkChipStatus[row.file.name];
                return (
                  <div key={i} className="p-2 flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className={cn("text-sm truncate", status === "done" ? "text-green-600" : status === "failed" ? "text-destructive" : "text-foreground")}>
                        {row.file.name}
                      </p>
                      {row.error && <p className="text-[11px] text-destructive">{row.error}</p>}
                    </div>
                    <button onClick={() => removeBulkRow(i)} className="p-1.5 rounded-sm text-red-500 bg-transparent border-none cursor-pointer transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0" title="Remove">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                );
              })}
              {bulkRows.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">Select a document type, then choose one or more PDF files.</p>
              )}
            </div>
            <Btn variant="primary" size="sm" onClick={submitBulkUpload} className="w-full justify-center mt-2">
              <UploadCloud size={14}/> {`Upload All (${bulkRows.filter(r=>!r.error).length})`}
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}
