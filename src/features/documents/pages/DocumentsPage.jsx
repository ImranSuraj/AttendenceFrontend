import { useState } from "react";
import { Download, FolderOpen, ReceiptText, FileDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { Btn } from "@/shared/components/Btn";
import { FormField, inputCls } from "@/shared/components/Modal";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { downloadEmployeeDocument } from "../services/documentDownload.service";
import IncomeTaxDeclarationTab from "../components/IncomeTaxDeclarationTab";
import { downloadDeclarationPdf } from "../services/itDeclaration.service";

const DOC_TABS = [
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "taxdeclaration", label: "Income Tax Declaration", icon: ReceiptText },
];

// Same 4 real document types the legacy StreamDownload.ashx page offers — every employee can
// download their own of any of these, no per-type permission gating (that only applies to the
// separate HR bulk-upload feature, via a completely different real permission table).
const DOC_TYPES = ["Payslip", "Letters", "Mediclaim", "Form16", "ITDeclaration"];
// Display-only rename — the underlying value ("Letters") stays as-is, since it's the real docType
// sent to the backend (matches DocumentDownloadService's FolderNameMap key and the needsLetterYear check).
const DOC_TYPE_LABELS = { Letters: "Increment Letter", ITDeclaration: "IT Declaration" };
const FORM16_PARTS = ["Form16 PartA", "Form16 PartB"];
const CURRENT_YEAR = new Date().getFullYear();
const MIN_FORM16_YEAR = CURRENT_YEAR - 14;
// Increment letters are issued every April — the month is fixed, only the year is user-picked.
const INCREMENT_LETTER_MONTH = "04";
// Shared year-select option list (descending, most recent first) — reused by Payslip, Letters,
// and Form16's year pickers so all three date-picking flows stay consistent.
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - MIN_FORM16_YEAR + 1 }, (_, i) => String(CURRENT_YEAR - i));
const MONTH_OPTIONS = [
  { value: "01", label: "January" }, { value: "02", label: "February" }, { value: "03", label: "March" },
  { value: "04", label: "April" }, { value: "05", label: "May" }, { value: "06", label: "June" },
  { value: "07", label: "July" }, { value: "08", label: "August" }, { value: "09", label: "September" },
  { value: "10", label: "October" }, { value: "11", label: "November" }, { value: "12", label: "December" },
];

export default function DocumentsPage() {
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [payslipYear, setPayslipYear] = useState("");
  const [payslipMonth, setPayslipMonth] = useState("");
  const [letterYear, setLetterYear] = useState("");
  const [form16Type, setForm16Type] = useState("");
  const [form16Year, setForm16Year] = useState("");
  const [docTab, setDocTab] = useState("documents");
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [progressMessage, setProgressMessage] = useState("");

  const needsPayslipDate = docType === "Payslip";
  const needsLetterYear = docType === "Letters";
  const needsForm16 = docType === "Form16";
  // The exact "yyyy-MM" string documentDownload.service.js's downloadEmployeeDocument expects.
  const month = needsPayslipDate
    ? (payslipYear && payslipMonth ? `${payslipYear}-${payslipMonth}` : "")
    : needsLetterYear
    ? (letterYear ? `${letterYear}-${INCREMENT_LETTER_MONTH}` : "")
    : "";

  const startDownload = async () => {
    if (needsPayslipDate && (!payslipYear || !payslipMonth)) { toast.error("Please select a valid date."); return; }
    if (needsLetterYear && !letterYear) { toast.error("Please select a valid date."); return; }
    if (needsForm16 && !form16Type) { toast.error("Please select Form 16 part."); return; }
    if (needsForm16 && !form16Year) { toast.error("Please select a valid year."); return; }

    setDownloading(true);
    // IT Declaration: the employee's own submitted declaration as a PDF (its own download route, not the document-folder download below).
    if (docType === "ITDeclaration") {
      try {
        await downloadDeclarationPdf();
        toast.success("IT Declaration downloaded successfully");
      } catch {
        // Central handler already toasted the failure.
      }
      setDownloading(false);
      return;
    }
    setProgress(0);
    setProgressMessage("Downloading please wait...");
    try {
      await downloadEmployeeDocument(
        { docType, month: (needsPayslipDate || needsLetterYear) ? month : undefined, form16Type: needsForm16 ? form16Type : undefined, form16Year: needsForm16 ? Number(form16Year) : undefined },
        ({ receivedBytes, percent }) => {
          const mb = (receivedBytes / 1048576).toFixed(2);
          setProgressMessage(`Downloading... ${mb} MB received`);
          setProgress(percent ?? Math.min(90, Math.round((receivedBytes / 1048576) * 5)));
        }
      );
      setProgress(100);
      setProgressMessage("Download complete!");
      toast.success("Document downloaded successfully");
      setTimeout(() => { setDownloading(false); setProgress(null); }, 600);
    } catch {
      // Central handler already toasted the failure.
      setDownloading(false);
      setProgress(null);
    }
  };

  return (
    <div className="documents-page flex flex-col gap-4">
      <div className={cn("flex gap-1 flex-wrap teams-tablist w-fit", "animate-fade-in-up")} style={{ animationDelay: "60ms" }}>
        {DOC_TABS.map(t => (
          <button key={t.id} onClick={() => setDocTab(t.id)}
            className={cn("flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors border-none cursor-pointer bg-transparent text-muted-foreground hover:text-foreground", docTab===t.id && "bg-card shadow text-foreground")}>
            <t.icon size={14}/> {t.label}
          </button>
        ))}
      </div>

      {docTab === "taxdeclaration" && <IncomeTaxDeclarationTab />}

      {docTab === "documents" && (
        <div className={cn("bg-card rounded-lg border border-border shadow-sm p-6 max-w-2xl animate-fade-in-up", "hover-lift")} style={{ animationDelay: "120ms" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-full bg-secondary text-primary flex items-center justify-center shrink-0">
              <FileDown size={16}/>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Download a Document</h3>
              <p className="text-xs text-muted-foreground">Select the document type and date to download it.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {DOC_TYPES.map(t => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-foreground cursor-pointer">
                <input type="radio" name="docType" value={t} checked={docType === t}
                  onChange={() => setDocType(t)} disabled={downloading}/>
                {DOC_TYPE_LABELS[t] || t}
              </label>
            ))}
          </div>

          {needsPayslipDate && (
            <div className="flex flex-wrap max-md:flex-nowrap gap-4 max-md:gap-2 mt-5">
              <FormField label="Year" className="min-w-[160px] max-md:min-w-0 max-md:flex-1">
                <SearchableSelect value={payslipYear} onChange={setPayslipYear} options={YEAR_OPTIONS} placeholder="Select Year" disabled={downloading}/>
              </FormField>
              <FormField label="Month" className="min-w-[160px] max-md:min-w-0 max-md:flex-1">
                <SearchableSelect value={payslipMonth} onChange={setPayslipMonth} options={MONTH_OPTIONS} placeholder="Select Month" disabled={downloading}/>
              </FormField>
            </div>
          )}

          {needsLetterYear && (
            <FormField label="Year" className="mt-5 min-w-[160px] max-w-xs">
              <SearchableSelect value={letterYear} onChange={setLetterYear} options={YEAR_OPTIONS} placeholder="Select Year" disabled={downloading}/>
            </FormField>
          )}

          {needsForm16 && (
            <div className="flex flex-wrap max-md:flex-nowrap gap-4 max-md:gap-2 mt-5">
              <FormField label="Form 16 Part" className="min-w-[180px] max-md:min-w-0 max-md:flex-1">
                <select value={form16Type} onChange={e => setForm16Type(e.target.value)} className={inputCls} disabled={downloading}>
                  <option value="">-- Select Part --</option>
                  {FORM16_PARTS.map(p => <option key={p} value={p}>{p === "Form16 PartA" ? "Form16 Part A" : "Form16 Part B"}</option>)}
                </select>
              </FormField>
              <FormField label="Financial Year" className="min-w-[180px] max-md:min-w-0 max-md:flex-1">
                <SearchableSelect value={form16Year} onChange={setForm16Year} options={YEAR_OPTIONS} placeholder="Select Year" disabled={downloading}/>
                {form16Year && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {form16Type === "Form16 PartA" ? `FY ${Number(form16Year) - 1}-${form16Year}` : `FY ${form16Year}`}
                  </p>
                )}
              </FormField>
            </div>
          )}

          <Btn variant="primary" size="sm" onClick={startDownload} loading={downloading} className="mt-6">
            <Download size={14}/> Download Document
          </Btn>

          {downloading && (
            <div className="flex flex-col gap-1.5 mt-4">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-2 transition-all duration-300 ease-out" style={{ width: `${progress ?? 0}%` }}/>
              </div>
              <p className="text-xs text-muted-foreground text-center">{progressMessage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
