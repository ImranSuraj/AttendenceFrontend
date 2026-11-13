import { useState, useMemo, useEffect, useRef } from "react";

import { Eye, RefreshCw, X, User, Building2, Mail, Phone, MapPin, Calendar, Users, IdCard, Network, Factory, Award, Home, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { inputCls } from "@/shared/components/Modal";
import { Btn } from "@/shared/components/Btn";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { DataTable } from "@/shared/components/DataTable";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { Spinner } from "@/shared/components/Spinner";
import { formatDate } from "@/shared/utils/date";
import { useEmployeesQuery } from "../hooks/useEmployeesQuery";
import { useEmployeeProfileQuery, useDirectorySearchQuery, useDepartmentOptionsQuery, useLocationOptionsQuery } from "../hooks/useEmployeeLookups";
import { searchEmployees } from "../services/employeeProfile.service";
import { titleCase } from "@/shared/utils/text";
import { useHasExactRole } from "@/shared/access/access.store";
import { EmployeeProfileCard } from "../components/EmployeeProfileCard";
import { OrgPage } from "@/features/org";

// departmentCode / locationCode / plant hold CODES (empmast.dept / empmast.loc / empmast.plant); the
// dropdowns show "code - description" but only the code is kept here and sent to the server.
// locationLabel is display-only (the selected location's description, shown even when it is not in the
// department-filtered list).

// Codes compare trimmed and case-insensitively (empmast columns can be space-padded).
const normCode = (s) => String(s ?? "").trim().toUpperCase();

export default function EmployeesPage() {
  // isFetching, not isLoading: the query has an empty initialData, so isLoading is never true and the
  // spinner below would never show while the first load is still in flight.
  const { data: employees, isFetching: employeesLoading } = useEmployeesQuery();
  const isHrAdmin = useHasExactRole("HRAdmin"); // only the HRAdmin role sees every employee; ITAdmin sees its own profile like an employee

  const [view, setView] = useState("details");
  const [deptFilter, setDeptFilter] = useState("");
  const [locFilter, setLocFilter] = useState("");
  const [viewEmp, setViewEmp] = useState(null);
  // Real data from AMSBackendAPI's spv1_GetEmployeeProfile — Plant/Grade/Mobile/Email/Address are
  // fetched here specifically for the View modal (single-profile mode); the table itself already
  // comes from the same real listing endpoint via useEmployeesQuery(), no mock fallback anywhere.
  const { data: liveProfile, isLoading: profileLoading, isError: profileError } = useEmployeeProfileQuery(viewEmp?.id, !!viewEmp);

  // Directory Search (non-HRAdmin only) — looks up ONE other colleague by EmpNo or email via the
  // new searchEmployeeDirectory() service call. `searchedQuery` is only set once the search is
  // actually submitted (validated non-empty first), which both drives the query's `enabled` flag
  // and doubles as the "a search has been run" flag for showing the result card / Clear button.
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState(null);
  const { data: searchResult, isLoading: searchLoading, isError: searchIsError } = useDirectorySearchQuery(searchedQuery, !isHrAdmin && !!searchedQuery);

  // The real backend (spv1_GetEmployeeProfile, listing mode) already enforces this scoping
  // server-side — a non-HRAdmin caller only ever gets their own row back, regardless of what's
  // requested. No client-side re-filter here: doing so against CURRENT_USER.id (this app's mock
  // identity, e.g. "EMP002") would incorrectly exclude the real row the backend legitimately
  // returned for the real demo empno (VITE_DEMO_EMPLOYEE_NO).
  const visibleEmployees = employees;

  // Derived from the real listing, not the mock DEPTS/LOCS constants — the backend returns real
  // department codes/location descriptions, not the mock's generic English names.
  // Departments come from dept_mast (active rows) and are shown as "Code - Description"; the saved
  // value stays the code.
  const { data: departmentOptions = [] } = useDepartmentOptionsQuery();
  // Department -> Location cascade: whenever a department is selected its raw code is sent to the
  // server, which returns just the locations that department exists in (no department = every active
  // location).
  // The dropdown values are CODES (department code, location code), so the department code is simply
  // the selected value.
  const { data: filterLocations = [] } = useLocationOptionsQuery(deptFilter);
  // Changing the department clears the location (it may not exist in the new department).
  const onFilterDept = (v) => { setDeptFilter(v); setLocFilter(""); };

  // "Code - Description" for each department code (same text as the Department dropdown), so the table,
  // its search and its Excel export all show the department the same way.
  const departmentLabel = useMemo(
    () => new Map(departmentOptions.map(o => [normCode(o.value), o.label])),
    [departmentOptions],
  );

  const filtered = useMemo(() => visibleEmployees.filter(e =>
    (!isHrAdmin || !deptFilter || normCode(e.departmentCode) === normCode(deptFilter)) &&
    (!isHrAdmin || !locFilter || normCode(e.locationCode) === normCode(locFilter))
  ).map(e => ({ ...e, department: departmentLabel.get(normCode(e.departmentCode)) || e.departmentCode || e.department })),
  [visibleEmployees, isHrAdmin, deptFilter, locFilter, departmentLabel]);

  // Non-HRAdmin (Employee/Manager): the backend already scopes the listing to just this one
  // record, and there's no reason to wrap a single row in a table — shown instead as a full
  // profile card below (same field set as the HRAdmin "View" modal, read-only, no Edit button
  // since Edit stays an HRAdmin-only action, unchanged).
  const myEmployee = !isHrAdmin ? (filtered[0] ?? null) : null;
  const { data: myLiveProfile, isLoading: myProfileLoading, isError: myProfileError } = useEmployeeProfileQuery(myEmployee?.id, !isHrAdmin && !!myEmployee);

  // Suggestions while typing (Find a Colleague): live, debounced spv1_SearchEmployees typeahead (active
  // employees, partial name / employee number). Picking one runs the normal directory search on that EmpNo.
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const findRef = useRef(null);
  useEffect(() => {
    const q = directoryQuery.trim();
    if (q.length < 2 || q.includes("@")) { setSuggestions([]); setSuggestLoading(false); return undefined; }
    let cancelled = false;
    setSuggestLoading(true);
    const timer = setTimeout(() => {
      searchEmployees(q)
        .then(rows => { if (!cancelled) setSuggestions(rows.slice(0, 8)); })
        .catch(() => { if (!cancelled) setSuggestions([]); })
        .finally(() => { if (!cancelled) setSuggestLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [directoryQuery]);
  useEffect(() => {
    const onDown = (e) => { if (findRef.current && !findRef.current.contains(e.target)) setSuggestOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const submitDirectorySearch = () => {
    const q = directoryQuery.trim();
    if (!q) { toast.error("Enter a Name, Employee Number or Email to search"); return; }
    setSuggestOpen(false);
    setSearchedQuery(q);
  };
  const pickSuggestion = (emp) => {
    setDirectoryQuery(emp.name);
    setSuggestOpen(false);
    setSearchedQuery(emp.id);
  };
  const clearDirectorySearch = () => { setSearchedQuery(null); setDirectoryQuery(""); setSuggestions([]); };

  const cols = [
    { key:"empCode", label:"Emp ID", width:"90px" },
    { key:"name", label:"Employee Name", render: e => (
      <div className="flex items-center gap-2">
        <div className="max-md:hidden w-7 h-7 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-[10px] font-bold shrink-0">
          {e.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
        </div>
        <span className="font-medium">{e.name}</span>
      </div>
    )},
    { key:"designation", label:"Designation" },
    { key:"department", label:"Department" },
    { key:"email", label:"Email", render: e => <span className="text-primary text-xs">{e.email}</span> },
    { key:"mobile", label:"Mobile" },
    { key:"manager", label:"Manager" },
    { key:"location", label:"Location" },
    { key:"status", label:"Status", render: e => <StatusBadge status={e.status}/> },
  ];

  return (
    <div className="employees-page flex flex-col gap-4">
      <div className={cn("flex flex-wrap gap-3 items-center", "animate-fade-in-up")} style={{ animationDelay: "0ms" }}>
        <div className="flex gap-1 teams-tablist w-fit ml-auto">
          <button onClick={() => setView("details")}
            className={cn("flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors cursor-pointer border-none",
              view==="details" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
            <IdCard size={13}/> Employee Details
          </button>
          <button onClick={() => setView("orgchart")}
            className={cn("flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors cursor-pointer border-none",
              view==="orgchart" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
            <Network size={13}/> Organization Chart
          </button>
        </div>
      </div>

      {view === "orgchart" ? <OrgPage/> : <>


      {!isHrAdmin && (
        <div className={cn("relative z-10 bg-card rounded-lg border border-border p-4 flex flex-wrap gap-3 items-end", "hover-lift", "animate-fade-in-up")} style={{ animationDelay: "60ms" }}>
          <div ref={findRef} className="relative flex flex-col gap-1 w-full max-w-xs">
            <label className="text-xs font-semibold text-muted-foreground">Find a Colleague</label>
            <input
              value={directoryQuery}
              onChange={e => { setDirectoryQuery(e.target.value); setSuggestOpen(true); }}
              onFocus={() => setSuggestOpen(true)}
              onKeyDown={e => { if (e.key === "Enter") submitDirectorySearch(); if (e.key === "Escape") setSuggestOpen(false); }}
              placeholder="Search by Name, Employee Number, or Email"
              autoComplete="off"
              className={inputCls}
            />
            {suggestOpen && directoryQuery.trim().length >= 2 && !directoryQuery.includes("@") && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-72 overflow-y-auto bg-card border border-border rounded-lg shadow-lg py-1">
                {suggestLoading && suggestions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
                ) : suggestions.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No matching colleagues</p>
                ) : suggestions.map(emp => (
                  <button key={emp.id} type="button" onClick={() => pickSuggestion(emp)}
                    className="w-full flex flex-col text-left px-3 py-1.5 bg-transparent border-none cursor-pointer hover:bg-muted">
                    <span className="text-sm text-foreground">{emp.name}</span>
                    <span className="text-xs text-muted-foreground">{emp.empCode || emp.id}{emp.designation ? ` · ${emp.designation}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Btn variant="primary" size="sm" onClick={submitDirectorySearch} loading={searchLoading}>
            <Search size={14}/> Search
          </Btn>
          {searchedQuery && (
            <Btn variant="ghost" size="sm" onClick={clearDirectorySearch}>
              <X size={14}/> Clear
            </Btn>
          )}
        </div>
      )}

      {!isHrAdmin && searchedQuery && (
        <div className="animate-fade-in-up" style={{ animationDelay: "90ms" }}>
          {searchLoading ? (
            <div className="bg-card rounded-lg border border-border"><Spinner message="Searching directory…"/></div>
          ) : searchIsError || !searchResult ? (
            <div className="bg-card rounded-lg border border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">No matching employee found for &quot;{searchedQuery}&quot;.</p>
            </div>
          ) : (
            <EmployeeProfileCard employee={{
              ...searchResult,
              address: undefined, // a colleague's home address is not shown (the card omits the row when undefined)
              department: departmentLabel.get(normCode(searchResult.departmentCode)) || searchResult.departmentCode || searchResult.department,
            }} />
          )}
        </div>
      )}

      <div className={cn("animate-fade-in-up")} style={{ animationDelay: "120ms" }}>
      {employeesLoading && employees.length === 0 ? (
        <div className="bg-card rounded-lg border border-border"><Spinner message="Loading Employees…"/></div>
      ) : isHrAdmin ? (
      <DataTable
        columns={cols}
        data={filtered}
        exportFileName="Employee_Directory"
        // Department / Location / Reset sit in the table's own toolbar, so the search box and the Excel
        // button (always at the right end of that toolbar) end up on the same row, after the filters.
        titleExtra={
          <>
            <div className="w-[200px]">
              <SearchableSelect
                value={deptFilter}
                onChange={onFilterDept}
                options={[{ value: "", label: "All Departments" }, ...departmentOptions]}
                placeholder="All Departments"
                popupMinWidth={300}
              />
            </div>
            <div className="w-[170px]">
              <SearchableSelect
                value={locFilter}
                onChange={setLocFilter}
                options={[{ value: "", label: "All Locations" }, ...filterLocations]}
                placeholder="All Locations"
              />
            </div>
            <Btn variant="ghost" size="sm" onClick={() => { setDeptFilter(""); setLocFilter(""); }}>
              <RefreshCw size={13}/> Reset
            </Btn>
          </>
        }
        actions={(row) => (
          <>
            <button onClick={() => setViewEmp(row)}
              className="p-1.5 rounded-md transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary text-primary" title="View">
              <Eye size={14}/>
            </button>
          </>
        )}
      />
      ) : myEmployee ? (
        <EmployeeProfileCard
          employee={{
            name: myEmployee.name, designation: myEmployee.designation, status: myEmployee.status,
            empCode: myEmployee.empCode, department: myEmployee.department,
            email: myProfileLoading ? "Loading…" : myProfileError ? "Unavailable" : (myLiveProfile?.email ?? "—"),
            mobile: myProfileLoading ? "Loading…" : myProfileError ? "Unavailable" : (myLiveProfile?.mobile ?? "—"),
            location: myLiveProfile?.locationDisplay ?? myEmployee.location,
            plant: myProfileLoading ? "Loading…" : myProfileError ? "Unavailable" : (myLiveProfile?.plantDisplay ?? "—"),
            manager: myEmployee.manager,
            grade: myProfileLoading ? "Loading…" : myProfileError ? "Unavailable" : (myLiveProfile?.gradeDisplay ?? "—"),
            joinDate: myEmployee.joinDate,
            address: myProfileLoading ? "Loading…" : myProfileError ? "Unavailable" : (myLiveProfile?.address ?? "—"),
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground text-center py-16">No employee record found.</p>
      )}
      </div>

      {viewEmp && (
        <div className="fixed inset-0 bg-[color:var(--colorBackgroundOverlay)] z-50 flex items-center justify-center p-4" onClick={() => setViewEmp(null)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 px-6 border-b border-border">
              <h3 className="font-bold text-lg">Employee Details</h3>
              <button onClick={() => setViewEmp(null)} className="p-1 rounded-sm bg-transparent border-none cursor-pointer transition-colors hover:bg-muted"><X size={18}/></button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="max-md:hidden w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {viewEmp.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
                </div>
                <div>
                  <h4 className="text-lg font-bold">{viewEmp.name}</h4>
                  <p className="text-sm text-primary">{viewEmp.designation}</p>
                  <StatusBadge status={viewEmp.status}/>
                </div>
              </div>
              {(() => {
                // No mock fallback for these 5 — live API data only. Loading/Unavailable are real
                // states, not a silently-substituted mock value.
                const liveField = (value) => profileLoading ? "Loading…" : profileError ? "Unavailable" : (value ?? "—");
                return (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label:"Employee Code", value:viewEmp.empCode, icon:User },
                  { label:"Department", value:viewEmp.department, icon:Building2 },
                  { label:"Email", value:liveField(liveProfile?.email), icon:Mail },
                  { label:"Mobile", value:liveField(liveProfile?.mobile), icon:Phone },
                  { label:"Location", value:liveProfile?.locationDisplay ?? viewEmp.location, icon:MapPin },
                  { label:"Plant", value:liveField(liveProfile?.plantDisplay), icon:Factory },
                  { label:"Manager", value:viewEmp.manager, icon:Users },
                  { label:"Join Date", value:formatDate(viewEmp.joinDate), icon:Calendar },
                ].map(f=>(
                  <div key={f.label} className="flex items-start gap-2">
                    <f.icon size={14} className="text-muted-foreground mt-0.5 shrink-0"/>
                    <div>
                      <p className="text-xs text-muted-foreground">{f.label}</p>
                      <p className="font-medium text-foreground text-sm">{f.value}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-start gap-2 col-span-2">
                  <Home size={14} className="text-muted-foreground mt-0.5 shrink-0"/>
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium text-foreground text-sm">{liveField(liveProfile?.address)}</p>
                  </div>
                </div>
              </div>
                );
              })()}
            </div>
            <div className="flex gap-2 p-4 px-6 border-t border-border">
              <Btn variant="secondary" size="sm" onClick={() => setViewEmp(null)}>Close</Btn>
            </div>
          </div>
        </div>
      )}
      </>}

    </div>
  );
}
