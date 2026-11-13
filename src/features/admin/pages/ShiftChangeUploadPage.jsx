import { useState } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/shared/components/DataTable";
import { Spinner } from "@/shared/components/Spinner";
import { cardCls, Field, UploadBox } from "../components/adminKit";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";
import { yesterdayIso } from "../services/adminDates";
import { uploadShiftChange } from "../services/shiftChanges.service";
import { useShiftsQuery } from "../hooks/useShiftChanges";
import { useUploadMutation } from "../hooks/useUploadMutation";

// Admin > Shift Change Upload (Plant HR): one past day, many employees - the shift of each employee for that day is changed from an .xlsx file.
// ALL OR NOTHING: when any row is wrong nothing is saved and the rows that were wrong are listed. Same rules as the legacy page; the server applies them.
export default function ShiftChangeUploadPage() {
  const [date, setDate] = useState(yesterdayIso());
  const [result, setResult] = useState(null);
  const { data: shifts = [], isLoading } = useShiftsQuery();
  const upload = useUploadMutation(uploadShiftChange);

  const submit = async (file) => {
    if (!date) { toast.error("Please Enter Valid Date."); throw new Error("no date"); }
    if (date >= new Date().toLocaleDateString("en-CA")) { toast.error("Today and Future Date Not Possible to Upload"); throw new Error("bad date"); }
    const outcome = await upload.mutateAsync({ date, file });
    setResult(outcome);
    if (outcome.saved) toast.success(outcome.message);
  };

  const shiftCols = [
    { key: "shiftCode", label: "Shift" }, { key: "description", label: "Description" },
    { key: "inTime", label: "In Time" }, { key: "outTime", label: "Out Time" },
  ];
  const rejectedCols = [{ key: "reference", label: "Employee / Shift" }, { key: "description", label: "Problem" }];

  return (
    <div className="flex flex-col gap-4">

      <div className={`${cardCls} flex flex-col gap-4`}>
        <UploadBox ext=".xlsx" name="Shift Change" templateName="Shift_Change_Template" columns={["EmpNo", "ShiftCode"]} busy={upload.isPending} onUpload={submit}
          lead={<Field label="Date of the shift change" className="w-48 min-w-0"><DatePickerCalendar value={date} onChange={setDate} max={yesterdayIso()} /></Field>}
          note="Only the template format is accepted. You can change shifts only for employees belonging to your assigned plants." />
      </div>

      {result && (result.saved ? (
        <div className={`${cardCls} flex items-center gap-2 text-sm`}><CheckCircle size={18} className="text-green-600" /> {result.message}</div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={`${cardCls} flex items-center gap-2 text-sm text-destructive`}><AlertCircle size={18} /> {result.message}</div>
          <DataTable title="Rows that need correcting" columns={rejectedCols} data={result.rejected} hideSearch noPagination exportFileName="Shift_Change_Errors" />
        </div>
      ))}

      {isLoading ? <Spinner message="Loading shifts…" /> : <DataTable title="Shift codes" columns={shiftCols} data={shifts} noPagination hideExport exportFileName="Shifts" />}
    </div>
  );
}
