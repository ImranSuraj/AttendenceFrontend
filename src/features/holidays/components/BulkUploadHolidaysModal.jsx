import { useState, useEffect, useRef } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Modal, FormField } from "@/shared/components/Modal";
import { Btn } from "@/shared/components/Btn";
import { UploadProgress } from "@/shared/components/UploadProgress";
import { checkUploadHeader } from "@/shared/utils/uploadHeader";

// HRAdmin-only Bulk Upload for the Holiday Calendar (see HolidaysPage.jsx) — a real backend call
// (holidays.service.js's bulkUploadHolidays, via useHolidaysMutations()'s `bulkUpload` mutation),
// with the progress bar UI ported from Employees's Bulk Import Employees modal.
//
// The CSV itself is small, so genuine byte-level upload progress would jump ~instantly to 100%
// (not worth wiring up) — progress here is animated up to 90% while the real request is in
// flight, then completes to 100% only once the real response actually arrives, same as the
// reasoning documented in documentDownload.service.js for its own progress bar.
export function BulkUploadHolidaysModal({ open, onClose, bulkUpload }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const uploading = bulkUpload.isPending;
  const done = bulkUpload.isSuccess;
  const failed = bulkUpload.isError;

  useEffect(() => {
    if (open) {
      setFile(null);
      setFileError("");
      setProgress(0);
      bulkUpload.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!uploading) return;
    setProgress(5);
    const interval = setInterval(() => {
      setProgress(p => Math.min(90, p + Math.floor(Math.random() * 12) + 4));
    }, 250);
    return () => clearInterval(interval);
  }, [uploading]);

  const onFileSelected = async (f) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv") { setFileError("Please select a .csv file"); setFile(null); return; }
    // the header row (names, count) is checked before anything is sent; the server checks again
    const problem = checkUploadHeader(new Uint8Array(await f.arrayBuffer()), ".csv", { name: "Holiday Calendar", columns: ["Location", "HolidayName", "Date"], optional: ["Day"], anyOrder: true });
    if (problem) { setFileError(problem); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
    setFileError("");
    setFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const close = () => {
    onClose();
    setFile(null);
    setFileError("");
    setProgress(0);
    bulkUpload.reset();
  };

  const submit = () => {
    if (!file) { toast.error("Please select a CSV file to upload"); return; }
    setProgress(0);
    bulkUpload.mutate(file, { onSuccess: () => setProgress(100) });
  };

  return (
    <Modal open={open} onClose={close} title="Bulk Upload Holiday Calendar" maxWidth="max-w-md"
      footer={done ? (
        <Btn variant="primary" size="sm" onClick={close}>Done</Btn>
      ) : (
        <>
          <Btn variant="primary" size="sm" onClick={submit} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Btn>
          <Btn variant="secondary" size="sm" onClick={close}>Cancel</Btn>
        </>
      )}>
      {done ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle size={40} className="text-green-600" />
          <p className="text-sm font-medium text-foreground">Holiday calendar updated successfully</p>
        </div>
      ) : uploading ? (
        <div className="py-8"><UploadProgress active value={progress} /></div>
      ) : (
        <>
          <FormField label="Select CSV File">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={e => onFileSelected(e.target.files?.[0])}
              className="border border-border rounded-md py-2 px-3 text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </FormField>
          {fileError && (
            <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={13} /> {fileError}</p>
          )}
          {file && !fileError && (
            <p className="text-sm text-foreground">Selected: <span className="font-medium">{file.name}</span></p>
          )}
          {failed && (
            <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={13} /> The previous upload failed — select a file and try again.</p>
          )}
          <p className="text-xs text-destructive" role="note">Expected columns for <strong>Holiday Calendar</strong> (the first row of the file, in any order): <span className="font-mono font-semibold">Location, HolidayName, Date, Day (optional)</span>.</p>
              <p className="text-xs text-muted-foreground">Date as dd/MM/yyyy. Each row updates the matching Location+Date holiday if it already exists, or adds it as new.</p>
        </>
      )}
    </Modal>
  );
}
