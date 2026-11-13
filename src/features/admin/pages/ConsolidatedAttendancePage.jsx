import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/shared/components/DataTable";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { Spinner } from "@/shared/components/Spinner";
import { cardCls, Field, TabStrip } from "../components/adminKit";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";
import { dmy, firstOfMonthIso, todayIso } from "../services/adminDates";
import { useConsolidatedPlantsQuery, useAttendanceReportQuery } from "../hooks/useConsolidatedAttendance";

// Admin > Consolidated Attendance (HR Admin, Plant HR, and people who were given the page): two reports of the same dates and plant.
//   Consolidated Report  the days of each attendance status per employee, for one plant or every plant the person may see
//   Form 25 Report       the muster of the workers of ONE plant: a letter per day (D01..D31) and the totals
const TABS = [{ key: "consolidated", label: "Consolidated Report" }, { key: "form25", label: "Form 25 Report" }];

const CONSOLIDATED_COLS = [
  ["employeeNo", "Emp No"], ["employeeName", "Name"], ["department", "Dept"], ["present", "Present"], ["od", "OD"], ["paidHoliday", "Paid Holiday"], ["cl", "CL"], ["sl", "SL"],
  ["pl", "PL"], ["cOff", "C-Off"], ["accidentLeave", "Accident Leave"], ["esi", "ESI"], ["medicalLeave", "Medical Leave"], ["paidDays", "Total Paid Days"],
  ["absent", "Absent"], ["lop", "LOP"], ["others", "Others"], ["weeklyOff", "Weekly Off"], ["totalDays", "Total Days"],
].map(([key, label]) => ({ key, label }));

const DAYS = Array.from({ length: 31 }, (_, i) => `d${String(i + 1).padStart(2, "0")}`);
const FORM25_COLS = [
  ["employeeNo", "Emp No"], ["employeeName", "Name"], ["plant", "Plant"], ["dept", "Dept"], ["section", "Section"], ["category", "Catg"],
  ["dateOfBirth", "DOB", r => dmy(r.dateOfBirth)], ["dateOfJoining", "DOJ", r => dmy(r.dateOfJoining)], ["fatherName", "Father Name"], ["designation", "Designation"], ["weeklyOff", "Weekly Off"],
  ...DAYS.map(d => [d, d.toUpperCase()]),
  ["present", "Present"], ["absent", "Absent"], ["esi", "ESI"], ["ld", "LD"], ["hDay", "Holiday"], ["lateMinutes", "Late Min"], ["lop", "LOP"], ["wp", "WP"],
].map(([key, label, render]) => ({ key, label, ...(render ? { render } : null) }));

function ReportTab({ kind }) {
  const form25 = kind === "form25";
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [plant, setPlant] = useState(form25 ? "" : "ALL");
  const { data: plants = [], isLoading } = useConsolidatedPlantsQuery();

  const options = useMemo(() => [
    ...(form25 ? [] : [{ value: "ALL", label: "All" }]),
    ...plants.map(p => ({ value: p.plant, label: p.description ? `${p.plant} - ${p.description}` : p.plant })),
  ], [plants, form25]);

  // The report loads by itself as soon as both dates and the plant are filled in (and again whenever one of them changes).
  const ready = !!from && !!to && from <= to && !!plant;
  const { data: report, isFetching } = useAttendanceReportQuery({ kind, form25, from, to, plant, ready });
  const rows = ready ? report?.rows : null;
  useEffect(() => { if (report?.message) toast.info(report.message); }, [report]);
  useEffect(() => { if (from && to && from > to) toast.error("The start date must not be after the end date."); }, [from, to]);

  return (
    <div className="flex flex-col gap-4">
      <div className={`${cardCls} flex flex-wrap items-end gap-3 max-md:gap-2`}>
        <Field label="From Date"><DatePickerCalendar value={from} onChange={setFrom} max={to || undefined} /></Field>
        <Field label="To Date"><DatePickerCalendar value={to} onChange={setTo} min={from || undefined} /></Field>
        <Field label="Plant" className="min-w-[220px]">
          <SearchableSelect value={plant} onChange={setPlant} options={options} placeholder={isLoading ? "Loading plants…" : "Select plant..."} />
        </Field>
      </div>
      {ready && isFetching ? <Spinner message="Preparing the report…" /> : rows && (
        <DataTable title={form25 ? "Form 25" : "Consolidated Report"} columns={form25 ? FORM25_COLS : CONSOLIDATED_COLS} data={rows}
          exportFileName={form25 ? `Form25_${plant}_${from}_${to}` : `Consolidated_${plant}_${from}_${to}`} />
      )}
    </div>
  );
}

export default function ConsolidatedAttendancePage() {
  const [tab, setTab] = useState("consolidated");
  return (
    <div className="flex flex-col gap-4">
      <TabStrip tabs={TABS} active={tab} onChange={setTab} />
      {/* each tab keeps its own dates and result, so it is mounted by key */}
      <ReportTab key={tab} kind={tab} />
    </div>
  );
}
