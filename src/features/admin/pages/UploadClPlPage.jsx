import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/shared/components/DataTable";
import { cardCls, RowStatus, TabStrip, UploadBox } from "../components/adminKit";
import { uploadCl, uploadPl } from "../services/leaveBalances.service";
import { useUploadMutation } from "../hooks/useUploadMutation";

// Admin > Upload CL/PL (HR Admin): the casual (CL) and privilege (PL) leave balances from a CSV, one tab each. Every row gets a status: Saved (a new employee + year),
// Updated (it was there) or Error (for example a year that is not 4 digits - that row is not saved, the others are).
const TABS = [{ key: "cl", label: "Upload Casual Leave (CL)" }, { key: "pl", label: "Upload Privilege Leave (PL)" }];

const CL = {
  columns: ["EmpNo", "CLEligible", "CLAvailed", "MDLEligible", "MDLAvailed", "ApprYear", "CLEncash"], file: "CL_Upload_Template", send: uploadCl, name: "CL_Uploaded",
  cols: [["rowNo", "Row"], ["employeeNo", "Emp No"], ["clEligible", "CL Eligible"], ["clAvailed", "CL Availed"], ["mdlEligible", "MDL Eligible"], ["mdlAvailed", "MDL Availed"], ["apprYear", "Appr Year"], ["clEncash", "CL Encash"]],
};
const PL = {
  columns: ["EmpNo", "PrevYrBal", "PrevyrEarned", "PrevyrAvailed", "CurryrEncash", "CurryrAdvElgbl", "CurryrAvailed", "CurryrAbsent", "CurrYear"], file: "PL_Upload_Template", send: uploadPl, name: "PL_Uploaded",
  cols: [["rowNo", "Row"], ["employeeNo", "Emp No"], ["prevYearBalance", "Prev Yr Bal"], ["prevYearEarned", "Prev Yr Earned"], ["prevYearAvailed", "Prev Yr Availed"], ["currYearEncash", "Curr Yr Encash"],
    ["currYearAdvance", "Curr Yr Adv Eligible"], ["currYearAvailed", "Curr Yr Availed"], ["currYearAbsent", "Curr Yr Absent"], ["currYear", "Curr Year"]],
};

function UploadTab({ kind }) {
  const cfg = kind === "cl" ? CL : PL;
  const [result, setResult] = useState(null);
  const upload = useUploadMutation(cfg.send);

  const submit = async (file) => {
    const outcome = await upload.mutateAsync(file);
    setResult(outcome);
    toast[outcome.errors ? "warning" : "success"](`${outcome.inserted} saved, ${outcome.updated} updated, ${outcome.errors} with an error`);
  };

  const columns = [
    ...cfg.cols.map(([key, label]) => ({ key, label })),
    { key: "status", label: "Status", render: r => <RowStatus status={r.status} /> },
    { key: "remarks", label: "Remarks" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className={cardCls}>
        <UploadBox ext=".csv" name={kind === "cl" ? "Casual Leave (CL) Upload" : "Privilege Leave (PL) Upload"} columns={cfg.columns} templateName={cfg.file} busy={upload.isPending} onUpload={submit}
          note="Only the template format is accepted. Each row must contain one employee and one applicable year. New employee-year records will be inserted, while existing records will be updated." />
      </div>
      {result && (
        <>
          <div className={`${cardCls} text-sm`}>
            <span className="font-semibold">{result.inserted}</span> saved · <span className="font-semibold">{result.updated}</span> updated · <span className="font-semibold">{result.errors}</span> with an error
          </div>
          <DataTable title="Result of the upload" columns={columns} data={result.rows} exportFileName={cfg.name} />
        </>
      )}
    </div>
  );
}

export default function UploadClPlPage() {
  const [tab, setTab] = useState("cl");
  return (
    <div className="flex flex-col gap-4">
      <TabStrip tabs={TABS} active={tab} onChange={setTab} />
      <UploadTab key={tab} kind={tab} />
    </div>
  );
}
