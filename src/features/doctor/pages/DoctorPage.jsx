import { useState, useMemo } from "react";
import { Stethoscope, CalendarCheck2, X, Eye, UserCheck, Building2, Calendar, Clock, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { Btn } from "@/shared/components/Btn";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { DataTable } from "@/shared/components/DataTable";
import { Spinner } from "@/shared/components/Spinner";
import { FormField, Modal, inputCls } from "@/shared/components/Modal";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { useHasRole, useHasExactRole } from "@/shared/access/access.store";
import {
  useDoctorBookingContextQuery, useAvailableSlotsQuery, useDoctorQuery, useDoctorQuery_AllForAdmin, useDoctorMutations,
} from "../hooks/useDoctorQuery";
import { minutesToLabel } from "../services/doctorRows";
import { validateAppointmentForm } from "../doctor.validators";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";

const emptyForm = { date: "", start: "" };

export default function DoctorPage() {
  const { data: ctx, isLoading: ctxLoading } = useDoctorBookingContextQuery();
  // isFetching (not isLoading): these queries start from an empty initialData, so isLoading is never true.
  const { data: appointments, isFetching: myApptsFetching } = useDoctorQuery();
  const isHrAdmin = useHasRole("HRAdmin");
  const canExport = useHasExactRole("HRAdmin"); // the Excel export is HRAdmin only (ITAdmin does not get it)
  // HRAdmin sees every employee's appointments (so they can mark them Attended); everyone else only their own.
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Table filters (From/To dates + status). Default range: 1 Jan of the current year .. the latest
  // date offered in the Booking Date dropdown (falls back to today until that list has loaded).
  const [rangeFrom, setRangeFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [pickedTo, setRangeTo] = useState("");
  const maxBookingDate = [...ctx.clinicDates].sort().pop();
  const rangeTo = pickedTo || maxBookingDate || ymd(new Date());
  const [statusFilter, setStatusFilter] = useState("All");
  const { data: allAppointments, isFetching: allApptsFetching } = useDoctorQuery_AllForAdmin(isHrAdmin, rangeFrom, rangeTo);
  const apptsLoading = isHrAdmin ? (allApptsFetching && allAppointments.length === 0) : (myApptsFetching && appointments.length === 0);
  const { add, cancel, markAttended, isAdding, isMarkingAttended } = useDoctorMutations();
  const [viewing, setViewing] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const { data: availableSlots } = useAvailableSlotsQuery(form.date);

  const selectedSlot = availableSlots.find(s => s.start === Number(form.start));

  const myAppointments = useMemo(() =>
    [...(isHrAdmin ? allAppointments : appointments)]
      .filter(a => (!rangeFrom || a.date >= rangeFrom) && (!rangeTo || a.date <= rangeTo))
      .filter(a => statusFilter === "All" || a.status === statusFilter)
      .sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start),
    [appointments, allAppointments, isHrAdmin, rangeFrom, rangeTo, statusFilter]
  );

  const submit = () => {
    const errors = validateAppointmentForm(form);
    if (Object.keys(errors).length) { toast.error(Object.values(errors)[0]); return; }
    add({ date: form.date, start: selectedSlot.start, end: selectedSlot.end }, {
      onSuccess: () => {
        toast.success(`Appointment booked for ${form.date} at ${selectedSlot.label}`);
        setForm(emptyForm);
      },
    });
  };

  const handleCancel = (appt) => {
    cancel(appt, { onSuccess: () => { toast.success("Appointment cancelled"); setViewing(null); } });
  };

  const handleAttended = (appt) => {
    markAttended(appt, { onSuccess: () => { toast.success("Marked as attended"); setViewing(null); } });
  };

  // Employees see only their own rows and HRAdmin sees all, so both roles may Cancel / mark Attended
  // any row they can see -- but only while it is still "Not Attended" (Attended/Cancelled: no buttons).
  const canCancel = (a) => a.status === "Not Attended";
  const canMarkAttended = (a) => a.status === "Not Attended";

  const cols = [
    ...(isHrAdmin ? [{ key:"employeeName", label:"Employee" }] : []),
    { key:"date", label:"Date" },
    { key:"start", label:"Start Time", render: a => minutesToLabel(a.start) },
    { key:"end", label:"End Time", render: a => minutesToLabel(a.end) },
    { key:"status", label:"Status", render: a => <StatusBadge status={a.status}/> },
  ];

  // The Excel export carries every field of a booking, not just the columns shown on screen.
  const exportColumns = [
    { key:"id", label:"Appointment ID" },
    { key:"employeeNumber", label:"Employee No" },
    { key:"employeeName", label:"Employee Name" },
    { key:"department", label:"Department" },
    { key:"age", label:"Age" },
    { key:"gender", label:"Gender" },
    { key:"date", label:"Appointment Date" },
    { key:"start", label:"Start Time", render: a => minutesToLabel(a.start) },
    { key:"end", label:"End Time", render: a => minutesToLabel(a.end) },
    { key:"status", label:"Status" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center flex-wrap gap-x-6 gap-y-2 animate-fade-in-up" style={{ animationDelay: "0ms" }}>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-secondary text-primary flex items-center justify-center shrink-0">
            <Stethoscope size={16}/>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Book Doctor Appointment</h3>
            <p className="text-xs text-muted-foreground">Clinic runs every Friday, 2:30 PM – 5:30 PM.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {ctxLoading ? (
          <div className="bg-card rounded-lg border border-border"><Spinner message="Loading clinic details…"/></div>
        ) : (
          <div className={cn("bg-card rounded-lg border border-border shadow-sm p-6 animate-fade-in-up", "hover-lift")} style={{ animationDelay: "60ms" }}>
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(3,12rem)_auto] gap-3 items-start">
              <FormField label="Booking Date">
                <select value={form.date} onChange={e=>setForm(f=>({...f, date:e.target.value, start:""}))} className={inputCls}>
                  <option value="">-Select-</option>
                  {ctx.clinicDates.map(d => <option key={d} value={d}>{new Date(`${d}T00:00:00`).toLocaleDateString("en-GB")}</option>)}
                </select>
              </FormField>
              <FormField label="Available Slots">
                <SearchableSelect
                  value={form.start}
                  onChange={v => setForm(f => ({ ...f, start: v }))}
                  options={availableSlots.map(s => ({ value: String(s.start), label: s.label }))}
                  placeholder="Select Start Time"
                  disabled={!form.date}
                />
              </FormField>
              <FormField label="End Time">
                <input value={selectedSlot ? minutesToLabel(selectedSlot.end) : ""} disabled className={cn(inputCls, "opacity-70")}/>
              </FormField>
              {/* mt-6 skips the field label's height so the button's top lines up with the End Time input's top. */}
              <div className="sm:mt-6">
                <Btn variant="primary" size="sm" onClick={submit} loading={isAdding}>
                  <CalendarCheck2 size={14}/> Book
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
        {apptsLoading ? (
          <div className="bg-card rounded-lg border border-border"><Spinner message="Loading your appointments…"/></div>
        ) : (
          <DataTable
            title="My Appointments"
            titleExtra={
              <>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">From Date
                  <DatePickerCalendar value={rangeFrom} onChange={v => setRangeFrom(v)} max={rangeTo || undefined}/>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">To Date
                  <DatePickerCalendar value={rangeTo} onChange={v => setRangeTo(v)} min={rangeFrom || undefined}/>
                </label>
                <div className="min-w-[150px]">
                  <SearchableSelect value={statusFilter} onChange={setStatusFilter}
                    options={["All", "Not Attended", "Attended", "Cancelled"]} placeholder="Status"/>
                </div>
              </>
            }
            compact
            columns={cols} data={myAppointments} exportColumns={exportColumns} exportFileName="DoctorAppointments" hideExport={!canExport}
            actions={(a) => (
              <>
                <button onClick={() => setViewing(a)} className="p-1.5 rounded-md transition-colors bg-transparent border-none cursor-pointer hover:bg-secondary text-foreground" title="View">
                  <Eye size={14}/>
                </button>
              </>
            )}
          />
        )}
      </div>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Appointment Details"
        footer={viewing && (
          <div className="flex flex-wrap gap-2 w-full">
            {canMarkAttended(viewing) && <Btn variant="primary" size="sm" onClick={() => handleAttended(viewing)} loading={isMarkingAttended}><UserCheck size={13}/> Attended</Btn>}
            {canCancel(viewing) && <Btn variant="secondary" size="sm" onClick={() => handleCancel(viewing)}><X size={13}/> Cancel</Btn>}
            <Btn variant="ghost" size="sm" className="ml-auto" onClick={() => setViewing(null)}>Close</Btn>
          </div>
        )}
      >
        {viewing && [
          [<UserIcon size={15}/>, "Employee", `${viewing.employeeName} (${viewing.employeeNumber})`],
          [<Calendar size={15}/>, "Date", new Date(`${viewing.date}T00:00:00`).toLocaleDateString("en-GB")],
          [<Clock size={15}/>, "Time", `${minutesToLabel(viewing.start)} - ${minutesToLabel(viewing.end)}`],
        ].map(([icon, label, value]) => (
          <div key={label} className="flex items-start gap-2.5 text-sm">
            <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
              <div className="text-foreground break-words">{value}</div>
            </div>
          </div>
        ))}
        {viewing && (
          <div className="flex items-start gap-2.5 text-sm">
            <span className="text-muted-foreground mt-0.5 shrink-0"><Stethoscope size={15}/></span>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Status</p>
              <StatusBadge status={viewing.status}/>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
