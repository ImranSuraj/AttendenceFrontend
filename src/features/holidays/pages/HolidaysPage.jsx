import { useState, useMemo, useEffect } from "react";
import { List, CalendarDays, UploadCloud, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { downloadExcelFile } from "@/shared/utils/downloadExcelFile";
import { DataTable } from "@/shared/components/DataTable";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { Spinner } from "@/shared/components/Spinner";
import { Btn } from "@/shared/components/Btn";
import { useHasRole, useHasExactRole } from "@/shared/access/access.store";
import { titleCase } from "../services/holidayCalendar.service";
import { useHolidaysQuery, useHolidayLocationsQuery, useHolidaysMutations } from "../hooks/useHolidaysQuery";
import { useCurrentUser } from "@/features/employees";
import { HolidayCalendarGrid } from "../components/HolidayCalendarGrid";
import { BulkUploadHolidaysModal } from "../components/BulkUploadHolidaysModal";

// Real system-clock current year, never derived from fetched data or hardcoded — the Year toggle
// is always "current year" / "current year - 1", whatever year it actually is.
const CURRENT_YEAR = new Date().getFullYear();

// Locations are stored in capitals ("CRPO | BANGALORE CORPORATE OFFICE"); they are shown as "CRPO | Bangalore Corporate Office" (the code stays as it is).
const displayLocation = (location) => {
  const text = String(location ?? "");
  const bar = text.indexOf("|");
  return bar < 0 ? titleCase(text) : `${text.slice(0, bar).trim()} | ${titleCase(text.slice(bar + 1).trim())}`;
};

export default function HolidaysPage() {
  // The Location dropdown lists the locations that actually have holiday rows (spv1_HolidayCalendar's own
  // GET_LOCATIONS, e.g. "BLRF | BANGALORE FACTORY").
  const { data: locations, isLoading: locationsLoading } = useHolidayLocationsQuery();
  const CURRENT_USER = useCurrentUser();
  const { bulkUpload } = useHolidaysMutations();
  const isHrAdmin = useHasExactRole("HRAdmin"); // Bulk Upload: the HRAdmin role itself (ITAdmin does not count)
  const canExport = useHasExactRole("HRAdmin"); // the Excel export is HRAdmin only (ITAdmin does not get it)
  const [view, setView] = useState("calendar"); // opens on the calendar view; the Table button switches
  const [location, setLocation] = useState("");
  // Starts on the employee's own location once the profile and the list have loaded -- until the user
  // picks something themselves (then their choice, including "All", is never overridden).
  const [locationPicked, setLocationPicked] = useState(false);
  useEffect(() => {
    if (locationPicked) return;
    // The employee's LOCATION (empmast.loc_desc, e.g. "Corporate Offic" -- the column is shortened) is matched
    // against the NAME part of each holiday location ("CRPO | BANGALORE CORPORATE OFFICE" -> "BANGALORE
    // CORPORATE OFFICE"). Plant is NOT used: an employee's plant can differ from where they sit (e.g. plant BLRF
    // = Bangalore Factory, location = Corporate Office). When several holiday locations contain the name, the
    // one that has a code ("CRPO | ...") is preferred over a bare legacy name ("CORPORATE OFFICE").
    const norm = (s) => String(s ?? "").trim().toUpperCase();
    const nameOf = (l) => { const s = String(l); return norm(s.includes("|") ? s.split("|").slice(1).join("|") : s); };
    const own = norm(CURRENT_USER.location);
    if (!own) return;
    const candidates = locations.filter(l => nameOf(l).includes(own));
    const match = candidates.find(l => String(l).includes("|")) || candidates[0];
    if (match) setLocation(match);
  }, [CURRENT_USER.location, locations, locationPicked]);
  const [yearMode, setYearMode] = useState("current");
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const selectedYear = yearMode === "current" ? CURRENT_YEAR : CURRENT_YEAR - 1;

  const { data: HOLIDAY_DATA, isLoading } = useHolidaysQuery(selectedYear, location);

  const [calMonth, setCalMonth] = useState(() => new Date(CURRENT_YEAR, new Date().getMonth(), 1));
  useEffect(() => {
    setCalMonth(new Date(selectedYear, selectedYear === CURRENT_YEAR ? new Date().getMonth() : 0, 1));
  }, [selectedYear]);

  // "All" is a real selectable option (value "" -- the backend's own NULL/blank = every-location
  // convention), always first, and the default the page loads with.
  const locationOptions = useMemo(() => [{ value: "", label: "All" }, ...locations.map(l => ({ value: l, label: displayLocation(l) }))], [locations]);

  const cols = [
    { key: "location", label: "Location", render: h => displayLocation(h.location) },
    { key: "name", label: "Holiday Name", render: h => <span className="font-medium">{h.name}</span> },
    { key: "date", label: "Date" },
    { key: "day", label: "Day" },
  ];

  // Excel export of the holidays currently listed (selected location + year). Lives next to the Year
  // toggle, so the table's own built-in Excel button is hidden below.
  const exportExcel = () => {
    downloadExcelFile(
      `HolidayCalendar_${selectedYear}.xls`,
      cols.map(c => c.label),
      HOLIDAY_DATA.map(h => cols.map(c => String(h[c.key] ?? ""))),
    );
    toast.success("Excel exported");
  };

  return (
    <div className="holidays-page flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2 animate-fade-in-up" style={{ animationDelay: "0ms" }}>
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <div className="flex gap-1 teams-tablist w-fit">
            <button onClick={() => setView("table")} className={cn("flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors cursor-pointer border-none", view==="table" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
              <List size={13}/> Table
            </button>
            <button onClick={() => setView("calendar")} className={cn("flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors cursor-pointer border-none", view==="calendar" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
              <CalendarDays size={13}/> Calendar
            </button>
          </div>
          {isHrAdmin && (
            <Btn variant="secondary" size="sm" onClick={() => setShowBulkUpload(true)}>
              <UploadCloud size={14}/> Bulk Upload
            </Btn>
          )}
        </div>
      </div>

      <div className="relative z-10 bg-card rounded-lg border border-border p-4 max-md:p-2 flex flex-wrap max-md:flex-nowrap gap-3 max-md:gap-2 items-end max-md:items-center animate-fade-in-up" style={{ animationDelay: "30ms" }}>
        <div className="flex flex-col gap-1 min-w-[220px] max-md:min-w-0 max-md:flex-1">
          <label className="text-xs font-semibold text-muted-foreground max-md:hidden">Location</label>
          <SearchableSelect
            value={location}
            onChange={(v) => { setLocationPicked(true); setLocation(v); }}
            options={locationOptions}
            placeholder={locationsLoading ? "Loading locations…" : "Select location..."}
          />
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <label className="text-xs font-semibold text-muted-foreground max-md:hidden">Year</label>
          <div className="flex teams-tablist gap-1 w-fit">
            <button onClick={() => setYearMode("previous")}
              className={cn("py-1.5 px-4 max-md:px-3 text-sm font-medium rounded-md transition-colors border-none cursor-pointer", yearMode==="previous" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
              {CURRENT_YEAR - 1}
            </button>
            <button onClick={() => setYearMode("current")}
              className={cn("py-1.5 px-4 max-md:px-3 text-sm font-medium rounded-md transition-colors border-none cursor-pointer", yearMode==="current" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
              {CURRENT_YEAR}
            </button>
          </div>
        </div>
        {/* Same look as the table's own Excel button (outlined, transparent), pushed to the end of the row. */}
        {canExport && <button onClick={exportExcel} disabled={!HOLIDAY_DATA.length} title="Export Excel"
          aria-label="Export to Excel" className="ml-auto max-md:ml-0 shrink-0 flex items-center justify-center gap-1.5 py-1.5 px-3 max-md:h-[32px] max-md:w-[32px] max-md:px-0 text-xs font-medium border border-border rounded-md bg-transparent cursor-pointer transition-colors hover:enabled:bg-muted disabled:opacity-50 disabled:cursor-not-allowed">
          <FileSpreadsheet size={13} className="max-md:w-5 max-md:h-5"/> <span className="max-md:hidden">Excel</span>
        </button>}
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        {isLoading ? (
          <div className="bg-card rounded-lg border border-border"><Spinner message="Loading holiday calendar…"/></div>
        ) : view === "table" ? (
          <DataTable columns={cols} data={HOLIDAY_DATA} hideSearch hideExport/>
        ) : (
          <HolidayCalendarGrid holidays={HOLIDAY_DATA} month={calMonth} onMonthChange={setCalMonth}/>
        )}
      </div>

      <BulkUploadHolidaysModal open={showBulkUpload} onClose={() => setShowBulkUpload(false)} bulkUpload={bulkUpload}/>
    </div>
  );
}
