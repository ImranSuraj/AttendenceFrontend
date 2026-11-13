import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, Download } from "lucide-react";
import { DataTable } from "@/shared/components/DataTable";
import { Btn } from "@/shared/components/Btn";
import { Spinner } from "@/shared/components/Spinner";
import { Modal } from "@/shared/components/Modal";
import { useHasExactRole } from "@/shared/access/access.store";
import { downloadTextFile } from "@/shared/utils/downloadTextFile";
import {
  useLeaveBalanceHistorySummaryQuery, useLeaveBalanceHistoryDatewiseQuery,
} from "../hooks/useLeaveBalanceQuery";
import { REQUEST_CODE_TO_SESSION } from "@/features/leave/leave.constants";
import { getLeaveBalanceHistoryDatewise } from "../services/leaveBalanceHistory.service";

// Employee Leave Balance — ported from the legacy RptLeaveCL.aspx screen: a Year/CL/SL summary
// grid, each row with a "Detail" action that opens that year's Casual+Sick Leave datewise
// breakdown in a modal (spv1_LeaveBalanceHistory's SUMMARY then DATEWISE operations). All business
// logic (eligibility/availed/balance math, which dates qualify) lives entirely in that one stored
// procedure — this page only renders what it returns and translates SessionCode into words using
// the same map Leave Requests' own table already uses, not a re-implementation of its logic in JS.
const SUMMARY_COLS = [
  { key: "leaveYear", label: "Year", width: "90px" },
  { key: "casualLeaveEligible", label: "CL/SL Eligible" },
  { key: "casualLeaveAvailed", label: "CL/SL Availed" },
  { key: "casualLeaveBalance", label: "CL/SL Balance" },
  { key: "privilegeLeaveEligible", label: "PL/EL Eligible" },
  { key: "privilegeLeaveAvailed", label: "PL/EL Availed" },
  { key: "privilegeLeaveBalance", label: "PL/EL Balance" },
];

const DATE_COLS = [
  { key: "fromDate", label: "From Date" },
  { key: "toDate", label: "To Date" },
  { key: "sessionCode", label: "Session", render: r => REQUEST_CODE_TO_SESSION[r.sessionCode] ?? r.sessionCode },
  { key: "noOfDays", label: "No. Of Days" },
  { key: "payType", label: "WP/LOP" },
  { key: "reasonDescription", label: "Reason" },
];

const csvCell = (text) => `"${String(text ?? "").replace(/"/g, '""')}"`;
const csvRow = (values) => values.map(csvCell).join(",");

export default function EmployeeLeaveBalancePage({ onNavigate }) {
  const [selectedYear, setSelectedYear] = useState(null); // drives the "Detail" modal
  const [exporting, setExporting] = useState(false);
  const canExport = useHasExactRole("HRAdmin"); // the Excel/CSV export is HRAdmin only (ITAdmin does not get it)

  const { data: summary, isFetching: summaryLoading } = useLeaveBalanceHistorySummaryQuery();
  const { data: datewise, isFetching: datewiseLoading } = useLeaveBalanceHistoryDatewiseQuery(selectedYear);

  // The Summary table's own export button is replaced (hideExport below) by this one — it builds a
  // single combined CSV: the summary rows exactly as shown, followed by every summary year's own
  // Casual/Sick Leave dates (fetched fresh per year, not just whichever year's modal happens to be
  // open), each dated row tagged with its Year since multiple years are combined into one section.
  const exportAll = async () => {
    if (summary.length === 0) { toast.error("Nothing to export."); return; }
    setExporting(true);
    try {
      const perYear = await Promise.all(
        summary.map(row => getLeaveBalanceHistoryDatewise(row.leaveYear).then(rows => ({ year: row.leaveYear, rows })))
      );

      const lines = [
        "Leave Balance Summary",
        csvRow(SUMMARY_COLS.map(c => c.label)),
        ...summary.map(row => csvRow(SUMMARY_COLS.map(c => row[c.key]))),
        "",
        "Casual/Sick Leave Dates (all years)",
        csvRow(["Year", ...DATE_COLS.map(c => c.label)]),
        ...perYear.flatMap(({ year, rows }) => rows.map(r => csvRow([
          year,
          r.fromDate, r.toDate, REQUEST_CODE_TO_SESSION[r.sessionCode] ?? r.sessionCode, r.noOfDays, r.payType, r.reasonDescription,
        ]))),
      ];

      downloadTextFile("Employee_Leave_Balance.csv", lines.join("\r\n"));
      toast.success("CSV exported");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between flex-wrap gap-2 max-md:gap-0">
        <div>
          <button onClick={() => onNavigate("home")}
            className="flex items-center gap-1 h-8 text-[13px] md:text-xs font-medium text-muted-foreground bg-transparent border-none p-0 cursor-pointer hover:text-foreground">
            <ArrowLeft size={13}/> Back to Home
          </button>
        </div>
      </div>

      {summaryLoading && summary.length === 0 ? (
        <Spinner message="Loading leave balance…"/>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Custom title+action row instead of DataTable's own title/filterExtra props — those
              render BEFORE its toolbar's right-aligned search/export group, which put the Export
              button in the middle of the bar rather than at the end. Rendering it here, in a
              plain justify-between row, puts it at the far right where the default CSV button
              normally sits; DataTable itself gets no title/filterExtra so its own toolbar is
              fully suppressed (see DataTable.jsx's own all-hidden guard). */}
          <div className="flex items-center justify-between max-md:justify-end empty:hidden">
            <h3 className="max-md:hidden font-semibold text-foreground">Leave Balance Summary</h3>
            {canExport && (
              <Btn size="xs" variant="secondary" loading={exporting} onClick={exportAll}>
                <Download size={12}/> Export
              </Btn>
            )}
          </div>
          <DataTable
            columns={SUMMARY_COLS}
            data={summary}
            hideExport
            hideSearch
            actions={(row) => (
              <Btn size="xs" variant="secondary" onClick={() => setSelectedYear(row.leaveYear)}>
                <Eye size={12} className="text-blue-600"/> Detail
              </Btn>
            )}
          />
        </div>
      )}

      <Modal
        open={!!selectedYear}
        onClose={() => setSelectedYear(null)}
        title={`Casual/Sick Leave Dates — ${selectedYear ?? ""}`}
        maxWidth="max-w-3xl"
        footer={<Btn variant="secondary" size="sm" onClick={() => setSelectedYear(null)}>Close</Btn>}
      >
        {datewiseLoading && datewise.length === 0 ? (
          <Spinner message="Loading leave dates…"/>
        ) : (
          <div className="shrink-0" /* the dialog body scrolls; without shrink-0 the table was squeezed and its pagination row cut off */>
            <DataTable columns={DATE_COLS} data={datewise} hideSearch hideExport flush noPagination bodyMaxHeight="max(300px, calc(85vh - 235px))"/>
          </div>
        )}
      </Modal>
    </div>
  );
}
