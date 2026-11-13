import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/shared/components/Btn";
import { FormField, inputCls } from "@/shared/components/Modal";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";
import { downloadLogs } from "../services/logs.service";
import { validateLogsRange } from "../admin.validators";
import { MAX_DAYS, KINDS } from "../admin.constants";
import { normalizeErrorMessage } from "@/shared/errors/errorHandler";
import { triggerBlobDownload } from "@/shared/utils/blobDownload";
import { lastSevenDaysRange } from "@/shared/utils/date";


// Admin > Logs (ITAdmin only -- the menu item is shown only to that role and the endpoint refuses anyone else): downloads the server's daily log files for a date range as one zip.
export default function LogsSection() {
  const initial = lastSevenDaysRange();
  const [fromDate, setFromDate] = useState(initial.fromDate);
  const [toDate, setToDate] = useState(initial.toDate);
  const [kind, setKind] = useState("all");
  const [busy, setBusy] = useState(false);

  const problem = validateLogsRange(fromDate, toDate);

  const download = async () => {
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    try {
      const result = await downloadLogs({ fromDate, toDate, kind });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      triggerBlobDownload(result.blob, result.fileName);
      toast.success("Logs downloaded");
    } catch (err) {
      toast.error(normalizeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm max-w-2xl">
      <div className="py-4 px-5 border-b border-border font-semibold text-sm">Application logs</div>
      <div className="p-5 flex flex-col gap-4">
        <p className="text-sm text-muted-foreground m-0">
          The server keeps one error file and one warnings file for every day. Choose the days you need (up to {MAX_DAYS} at a time) and download them as a single zip.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="From">
            <DatePickerCalendar value={fromDate} onChange={setFromDate} max={toDate || undefined}/>
          </FormField>
          <FormField label="To">
            <DatePickerCalendar value={toDate} onChange={setToDate} min={fromDate || undefined}/>
          </FormField>
        </div>
        <FormField label="What to include">
          <select className={`${inputCls} w-full`} value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </FormField>
        {problem && <p className="text-[13px] md:text-xs text-destructive m-0" role="alert">{problem}</p>}
        <div>
          <Btn variant="primary" size="sm" onClick={download} loading={busy} disabled={!!problem}>
            <Download size={14}/> Download logs
          </Btn>
        </div>
      </div>
    </div>
  );
}
