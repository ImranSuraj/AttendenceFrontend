import { useRef, useState } from "react";
import { UploadCloud, AlertCircle, Download, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { Btn } from "@/shared/components/Btn";
import { inputCls } from "@/shared/components/Modal";
import { downloadTextFile } from "@/shared/utils/downloadTextFile";
import { checkUploadHeader } from "@/shared/utils/uploadHeader";
import { UploadProgress } from "@/shared/components/UploadProgress";
import { downloadXlsxTemplate } from "@/shared/utils/downloadXlsxTemplate";

// Small pieces the Admin pages share: the card look, a labelled field, the tab strip, and the upload box (file picker + the template it must follow).
export const cardCls = "bg-card rounded-lg border border-border p-4 max-md:p-2.5";
export const dateCls = cn(inputCls, "h-8 max-md:h-9");

export function Field({ label, children, className }) {
  return (
    <div className={cn("flex flex-col gap-1 min-w-[160px] max-md:min-w-0 max-md:flex-1 max-md:basis-[calc(50%-0.375rem)]", className)}>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// The strip of tabs of a page with two parts (Consolidated Report / Form 25, CL / PL): tabs = [{ key, label }].
export function TabStrip({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 teams-tablist w-fit self-start">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn("flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors cursor-pointer border-none",
            active === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// The coloured status of an uploaded row.
export function RowStatus({ status }) {
  const tone = status === "SUCCESS" ? "bg-green-100 text-green-800" : status === "UPDATED" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800";
  return <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", tone)}>{status === "SUCCESS" ? "Saved" : status === "UPDATED" ? "Updated" : "Error"}</span>;
}

// Upload box, the same look as Upload Documents: a "Choose file" button (not a bare browser input), the chosen file with a remove button, an Upload button, a button that downloads
// the empty template (made in the browser, .csv or .xlsx) and a red note with the columns the file must have. The extension and the first row are checked before anything is sent
// (the server checks again). onUpload(file) returns a promise; the box clears itself once it succeeds.
export function UploadBox({ ext, columns, note, busy, onUpload, templateName, name, optional, anyOrder, lead }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const allColumns = [...columns, ...(optional ?? [])];

  const clear = () => { setFile(null); if (inputRef.current) inputRef.current.value = ""; };
  const choose = async (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(ext)) { setError(`Please select a ${ext} file`); clear(); return; }
    const problem = checkUploadHeader(new Uint8Array(await f.arrayBuffer()), ext, { name: name ?? templateName ?? "upload", columns, optional, anyOrder });
    if (problem) { setError(problem); clear(); return; }
    setError(""); setFile(f);
  };
  const submit = async () => {
    if (!file) { toast.error("Please select the file"); return; }
    try { await onUpload(file); clear(); } catch { /* the failure was already shown by the central error handler */ }
  };
  const downloadTemplate = () => {
    const fileName = `${templateName ?? (name ?? "Upload").replace(/\s+/g, "_") + "_Template"}${ext}`;
    if (ext === ".xlsx") downloadXlsxTemplate(fileName, allColumns);
    else downloadTextFile(fileName, `${allColumns.join(",")}\r\n`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        {lead}
        <Field label={`Select ${ext} file`} className="w-48 min-w-0">
          <input ref={inputRef} type="file" accept={ext} onChange={e => choose(e.target.files?.[0])} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md border border-dashed border-border bg-transparent text-foreground cursor-pointer transition-colors hover:bg-muted">
            <Paperclip size={14} /> Choose file
          </button>
        </Field>
        <Btn className="max-md:h-7 max-md:px-2.5 max-md:text-xs" variant="primary" size="sm" onClick={submit} loading={busy} disabled={!file}><UploadCloud size={14} /> Upload</Btn>
        <Btn className="max-md:h-7 max-md:px-2.5 max-md:text-xs" variant="secondary" size="sm" onClick={downloadTemplate}><Download size={14} /> Download template</Btn>
      </div>
      <UploadProgress active={!!busy} />
      {file && (
        <div className="flex items-center justify-between gap-2 max-w-md border border-border rounded-md px-3 py-1.5">
          <p className="text-sm text-foreground truncate">{file.name}</p>
          <button type="button" onClick={clear} title="Remove" className="p-1.5 rounded-sm text-red-500 bg-transparent border-none cursor-pointer transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"><Trash2 size={14} /></button>
        </div>
      )}
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={13} /> {error}</p>}
      {note && <p className="text-xs text-destructive" role="note">{note}</p>}
    </div>
  );
}