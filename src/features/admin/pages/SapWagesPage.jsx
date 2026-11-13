import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/shared/components/DataTable";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { Spinner } from "@/shared/components/Spinner";
import { inputCls } from "@/shared/components/Modal";
import { cardCls, Field } from "../components/adminKit";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";
import { dmy, firstOfMonthIso, todayIso } from "../services/adminDates";
import { getCanteenDeductions, getShiftWeeklyOff } from "../services/sapWages.service";
import { useSapPlantsQuery, useSapCategoriesQuery, useSapReportQuery } from "../hooks/useSapWages";

// Admin > SAP Wages (Plant HR): the two wage files for SAP of one plant and one category between two dates.
//   Shift Plus Weekly Off Allowance        wage type 2096: the shift allowance + the weekly off allowance per employee
//   Canteen Deduction Lunch + Breakfast    wage type 3016: the lunch + breakfast deduction per employee
const REPORTS = {
  shift: {
    label: "Shift Plus Weekly Off Allowance", file: "Shift_WeeklyOff_Allowance", load: getShiftWeeklyOff,
    cols: [["empId", "Emp Id"], ["fromDate", "From Date", r => dmy(r.fromDate)], ["toDate", "To Date", r => dmy(r.toDate)], ["wageType", "Wage Type"],
      ["shiftAmount", "Shift Amount"], ["weekOffAmount", "Week Off Amount"], ["totalAllowance", "Total Allowance"]],
  },
  canteen: {
    label: "Canteen Deduction Lunch + Breakfast", file: "Canteen_Deductions_Lunch_Breakfast", load: getCanteenDeductions,
    cols: [["empId", "Emp Id"], ["fromDate", "From Date", r => dmy(r.fromDate)], ["toDate", "To Date", r => dmy(r.toDate)], ["wageType", "Wage Type"],
      ["lunchAmount", "Lunch Amount"], ["breakfastAmount", "Breakfast Amount"], ["totalDed", "Total Deduction"]],
  },
};

export default function SapWagesPage() {
  const [type, setType] = useState("");
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [plant, setPlant] = useState("");
  const [category, setCategory] = useState("");
  const REPORT_SET = Object.keys(REPORTS);  const { data: plants = [], isLoading: plantsLoading } = useSapPlantsQuery();
  const { data: categories = [], isLoading: categoriesLoading } = useSapCategoriesQuery();

  const plantOptions = useMemo(() => plants.map(p => ({ value: p.plant, label: p.description ? `${p.plant} - ${p.description}` : p.plant })), [plants]);
  const categoryOptions = useMemo(() => categories.map(c => ({ value: c.category, label: c.description ? `${c.category} - ${c.description}` : c.category })), [categories]);

  // The report loads by itself as soon as the report type, both dates, the plant and the category are all filled in (and again whenever one of them changes).
  const ready = !!type && !!from && !!to && from <= to && !!plant && !!category;
  const { data: result, isFetching } = useSapReportQuery({ type, from, to, plant, category, ready, load: REPORTS[type]?.load });
  useEffect(() => { if (result?.message) toast.info(result.message); }, [result]);
  useEffect(() => { if (from && to && from > to) toast.error("The start date must not be after the end date."); }, [from, to]);

  const report = ready && result ? REPORTS[type] : null;
  const columns = report?.cols.map(([key, label, render]) => ({ key, label, ...(render ? { render } : null) }));

  return (
    <div className="flex flex-col gap-4">
      <div className={`${cardCls} flex flex-wrap items-end gap-3 max-md:gap-2`}>
        <Field label="Report type" className="min-w-[260px]">
          <select value={type} onChange={e => setType(e.target.value)} className={`${inputCls} h-8 max-md:h-9`}>
            <option value="">Select Report</option>
            {Object.entries(REPORTS).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="From"><DatePickerCalendar value={from} onChange={setFrom} max={to || undefined} /></Field>
        <Field label="To"><DatePickerCalendar value={to} onChange={setTo} min={from || undefined} /></Field>
        <Field label="Plant" className="min-w-[220px]">
          <SearchableSelect value={plant} onChange={setPlant} options={plantOptions} placeholder={plantsLoading ? "Loading plants…" : "Select plant..."} />
        </Field>
        <Field label="Category" className="min-w-[220px]">
          <SearchableSelect value={category} onChange={setCategory} options={categoryOptions} placeholder={categoriesLoading ? "Loading categories…" : "Select category..."} />
        </Field>
      </div>
      {ready && isFetching ? <Spinner message="Preparing the wages…" /> : report && (
        <DataTable title={report.label} columns={columns} data={result.rows} exportFileName={report.file} />
      )}
    </div>
  );
}
