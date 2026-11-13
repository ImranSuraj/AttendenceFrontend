import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock, Save, X } from "lucide-react";
import { FormField, inputCls } from "@/shared/components/Modal";
import { Btn } from "@/shared/components/Btn";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { cn } from "@/shared/utils/cn";
import { MEAL_OPTIONS, TIME_SLOTS, minutesToLabel, minutesTo12hLabel } from "../conference.constants";
import { EmployeeMultiPicker } from "./EmployeeMultiPicker";
import { addDays, fromDateStr, hourLabel, toDateStr } from "../teamsCalendar.utils";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";

const HOUR_PX = 56;

// The day beside the form, like the Teams "New event" window: the chosen room's other bookings for that
// date, with the slot being booked drawn in green so a clash is visible before saving.
function DaySchedule({ date, onDate, minDate, roomName, dayBookings, start, end, timeFormat, fmtTime }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = Math.max(0, ((start ?? 480) / 60 - 1) * HOUR_PX); }, [date, start]);
  const place = (a, b) => ({ top: (a / 60) * HOUR_PX, height: Math.max(((b - a) / 60) * HOUR_PX - 2, 20) });
  const day = date ? fromDateStr(date) : new Date();
  const shift = (n) => { const next = toDateStr(addDays(day, n)); if (!minDate || next >= minDate) onDate(next); };

  return (
    <div className="hidden lg:flex w-[350px] shrink-0 min-h-0 flex-col bg-card rounded-lg" aria-label="Day schedule">
      <div className="flex items-center gap-1 px-3 py-2.5 border-b border-border">
        <button type="button" aria-label="Previous day" onClick={() => shift(-1)} className="p-1 rounded bg-transparent border-none cursor-pointer text-foreground hover:bg-muted"><ChevronLeft size={18}/></button>
        <button type="button" aria-label="Today" onClick={() => minDate && onDate(minDate)} className="p-1 rounded bg-transparent border-none cursor-pointer text-foreground hover:bg-muted"><CalendarDays size={17}/></button>
        <button type="button" aria-label="Next day" onClick={() => shift(1)} className="p-1 rounded bg-transparent border-none cursor-pointer text-foreground hover:bg-muted"><ChevronRight size={18}/></button>
        <span className="ml-1.5 text-sm font-semibold text-foreground truncate">{day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
      </div>
      <p className="px-3 py-1 text-[11px] text-muted-foreground truncate">{roomName ? `${roomName} · bookings` : "Conference room bookings"}</p>
      <div ref={ref} className="flex-1 min-h-0 overflow-y-auto relative">
        <div className="relative ml-[52px] mr-2" style={{ height: 24 * HOUR_PX }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h}>
              <div className="absolute inset-x-0 border-t border-border" style={{ top: h * HOUR_PX }}/>
              {h > 0 && <span className="absolute -left-[48px] w-11 text-right -translate-y-1/2 text-xs text-muted-foreground" style={{ top: h * HOUR_PX }}>{hourLabel(h, timeFormat)}</span>}
            </div>
          ))}
          {dayBookings.map((b) => (
            <div key={b.id} className="absolute inset-x-0.5 rounded px-2 py-0.5 text-xs leading-4 overflow-hidden text-foreground border-l-4 border-[#8A8A8A]"
              style={{ ...place(b.start, b.end), backgroundColor: "color-mix(in srgb, #8A8A8A 20%, var(--card))" }}>
              <b className="block truncate">{b.purpose || "Booked"}</b>
              {b.employeeName && <span className="block truncate text-muted-foreground">{b.employeeName}</span>}
            </div>
          ))}
          {start != null && end != null && (
            <div className="absolute inset-x-0.5 rounded px-2 py-0.5 text-xs leading-4 font-semibold text-white overflow-hidden z-[1]"
              style={{ ...place(start, end), backgroundColor: "#4CC361" }}>
              {fmtTime(start)} - {fmtTime(end)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Create/Edit window, laid out like the Teams "New event" form: a grey header, an "Event" pill with the
// action buttons on one row, the form in a white card on the left and the day schedule on the right.
// Field order and every rule are unchanged from before: Purpose -> Participants (AMS employees or any
// typed email) -> Date+Start+End -> meeting type / Location+Room -> availability banner ->
// Breakfast/Tea/Lunch. The "This Slot Only"/"Entire Booking" scope toggle (edit mode only) is kept at the
// top since it changes what Date/Start/End even mean for the rest of the form.
export function BookingFormPanel({
  open, mode, onClose, form, setForm, onChangeLocation, locations, rooms, roomsLoading,
  mealRestricted, conflict, scheduleBookings = [], currentUser, onSubmit, isSubmitting, onCancel, isCancelling, onSetScope,
  withRoom, setWithRoom, timeFormat = "24",
}) {
  const roomName = (code) => rooms.find(r => r.code === code)?.name || code;

  // Start/End dropdowns show ONE format, following the calendar's AM|PM switch: 24-hour ("15:00") or 12-hour
  // ("3:00 PM"). Display only -- the option VALUE is always minutes-since-midnight (24-hour), which is all the
  // backend and database ever see.
  const fmtTime = (minutes) => (timeFormat === "12" ? minutesTo12hLabel(minutes) : minutesToLabel(minutes));

  // Today as yyyy-MM-dd in the user's own time zone -- the earliest date the date picker allows.
  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();

  // "Meeting type" (state lives in ConferencePage because it decides what Book does):
  // OFF  -> a plain Teams/Outlook meeting: no room, nothing is stored in the database, no meals.
  // ON   -> a real room booking (Location + Room + meals), saved as before.
  // It starts ON when the panel was opened from a calendar cell (room already chosen) and when
  // editing an existing room booking (then it can't be switched off).
  const showLocRoom = withRoom;
  const setShowLocRoom = setWithRoom;

  // The time is picked FIRST and the rooms are then narrowed to the ones free for it (see `rooms`), so the Start / End lists no
  // longer depend on a room: every slot is offered (past ones are not, for a new booking today).
  // For a NEW booking dated today, Start times that have already passed are not offered.
  const nowMinutes = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
  const hidePast = mode === "add" && form.date === todayStr;

  const startOptions = useMemo(
    () => TIME_SLOTS
      // The Start already chosen (e.g. by dragging over the calendar, where the slot that is running right now
      // can be the first cell) is always kept in the list, even though it began a few minutes ago.
      .filter(s => !(hidePast && s.start < nowMinutes && s.start !== form.start))
      .map(s => ({ value: String(s.start), label: fmtTime(s.start) }))
      // A meeting made in Teams can start on any minute: its own start is offered too.
      .concat(form.start != null && !TIME_SLOTS.some(s => s.start === form.start) ? [{ value: String(form.start), label: fmtTime(form.start) }] : [])
      .sort((a, b) => Number(a.value) - Number(b.value)),
    [timeFormat, hidePast, nowMinutes, form.start]
  );

  const endOptions = useMemo(() => {
    const idx = TIME_SLOTS.findIndex(s => s.start === form.start);
    const options = TIME_SLOTS.slice(idx === -1 ? 0 : idx).filter(s => idx !== -1 || s.end > (form.start ?? 0)).map(s => ({ value: String(s.end), label: fmtTime(s.end) }));
    // ...and so can its end.
    if (form.end != null && !options.some(o => o.value === String(form.end))) options.push({ value: String(form.end), label: fmtTime(form.end) });
    return options.sort((a, b) => Number(a.value) - Number(b.value));
  }, [form.start, form.end, timeFormat]);

  // Changing Start keeps the same duration at the new time (or runs to the end of the day if it no longer fits).
  const handleStartChange = (v) => {
    const newStart = Number(v);
    const duration = form.start != null && form.end != null ? form.end - form.start : TIME_SLOTS[0].end - TIME_SLOTS[0].start;
    const last = TIME_SLOTS[TIME_SLOTS.length - 1].end;
    setForm(f => ({ ...f, start: newStart, end: Math.min(newStart + duration, last) }));
  };

  // Escape closes the window (clicking outside does not, so a half-filled form is never lost by accident).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // The organizer (the logged-in employee) is shown in the heading instead of as a form field.
  const title = mode === "add" ? `New event${currentUser?.name ? ` - ${currentUser.name} (Organizer)` : ""}` : "Edit event";
  const setDate = (d) => setForm(f => ({ ...f, date: d && d < todayStr ? todayStr : d }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-[color:var(--colorBackgroundOverlay)]">
      <div role="dialog" aria-modal="true" aria-label={title}
        className="w-[1090px] max-w-full h-full sm:h-[min(92vh,780px)] bg-muted flex flex-col overflow-hidden sm:rounded-lg shadow-2xl [--ring:#5B5FC7]"
        style={{ fontFamily: '"Segoe UI", var(--font-sans)' }}>
        <div className="flex items-center px-4 py-2.5 bg-[#E5E5E5] dark:bg-[#1F1F1F]">
          <span className="flex-1 text-sm text-muted-foreground truncate">{title}</span>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-md bg-transparent border-none cursor-pointer text-foreground hover:bg-black/10"><X size={18}/></button>
        </div>

        <div className="flex items-center flex-wrap gap-2 px-4 py-2">
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-card border border-border text-sm text-foreground"><CalendarDays size={16}/> Event</span>
          <div className="flex-1"/>
          {mode === "edit" && <Btn variant="secondary" size="sm" onClick={onCancel} loading={isCancelling}>Cancel booking</Btn>}
          <Btn variant="teams" size="sm" onClick={onSubmit} loading={isSubmitting}>
            <Save size={14}/> {mode === "add" ? (withRoom && form.roomCode ? "Book" : "Create meeting") : "Update"}
          </Btn>
        </div>

        <div className="flex-1 min-h-0 flex gap-4 px-4 pb-4">
          <div className="flex-1 min-w-0 overflow-y-auto bg-card rounded-lg p-4 sm:p-5 flex flex-col gap-3.5">
            {/* The choice only matters when the clicked slot is part of a longer booking; when both ranges are the same there is nothing to choose. */}
            {mode === "edit" && (form.slotStart !== form.entireStart || form.slotEnd !== form.entireEnd) && (
              <FormField label="Apply to">
                <div className="flex gap-1 teams-tablist">
                  <button type="button" onClick={() => onSetScope("slot")}
                    className={cn("flex-1 py-1.5 px-2 text-[11px] font-medium rounded-md transition-colors border-none cursor-pointer",
                      form.scope === "slot" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
                    This Slot Only<br/><span className="font-normal">{fmtTime(form.slotStart)}–{fmtTime(form.slotEnd)}</span>
                  </button>
                  <button type="button" onClick={() => onSetScope("entire")}
                    className={cn("flex-1 py-1.5 px-2 text-[11px] font-medium rounded-md transition-colors border-none cursor-pointer",
                      form.scope === "entire" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
                    Entire Booking<br/><span className="font-normal">{fmtTime(form.entireStart)}–{fmtTime(form.entireEnd)}</span>
                  </button>
                </div>
              </FormField>
            )}

            {/* Order: when (date, start, end) -> how (Conference Room Required / Virtual / In Person, then the optional room) ->
                what (purpose) -> who (participants) -> meals. */}
            <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-3 gap-2 sm:gap-3">
              <FormField label="Date">
                {/* No past dates: `min` greys them out in the picker, and the onChange guard also catches a
                    past date typed by hand (it snaps to today). A narrower box on a phone so Date, Start and End share one row. */}
                <DatePickerCalendar value={form.date} onChange={v => setDate(v)} min={todayStr} className="max-sm:!px-2 max-sm:!text-xs max-sm:[&_svg]:hidden"/>
              </FormField>
              <FormField label="Start Time">
                <SearchableSelect
                  value={form.start != null ? String(form.start) : ""}
                  onChange={handleStartChange}
                  options={startOptions}
                  placeholder="Select time..."
                  icon={<Clock size={14} className="text-muted-foreground"/>}
                />
              </FormField>
              <FormField label="End Time">
                <SearchableSelect
                  value={form.end != null ? String(form.end) : ""}
                  onChange={v => setForm(f => ({ ...f, end: Number(v) }))}
                  options={endOptions}
                  placeholder="Select time..."
                  icon={<Clock size={14} className="text-muted-foreground"/>}
                />
              </FormField>
            </div>

            {/* A new booking opens as "Virtual / In Person": a meeting with no room at all. "Conference Room Required" shows the Room
                list -- only the rooms FREE for the chosen date and time -- and a room has to be picked (there is no "Meeting only" entry in
                the list). A Teams meeting link is created every time. Locked to "Conference Room Required" when editing an existing booking. */}
            <div className={cn("grid gap-3 items-end", showLocRoom ? "grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1")}>
              <FormField label="Meeting type">
                <div role="radiogroup" aria-label="Meeting type" className="flex flex-wrap items-center gap-x-3 sm:gap-x-5 px-3 py-2 rounded-md bg-muted border border-border">
                  {[[true, "Conference Room Required"], [false, "Virtual / In Person"]].map(([value, label]) => (
                    <label key={label} className={cn("flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-foreground whitespace-nowrap", mode === "edit" ? "opacity-60 cursor-not-allowed" : "cursor-pointer")}>
                      <input type="radio" name="meeting-type" checked={showLocRoom === value} disabled={mode === "edit"}
                        onChange={() => setShowLocRoom(value)} className="accent-[#5B5FC7] w-4 h-4"/>
                      {label}
                    </label>
                  ))}
                </div>
              </FormField>

              {showLocRoom && (mode === "add" && form.roomLocked && form.roomCode ? (
                /* Opened from a room's column on the calendar: the room is already chosen, so it is just shown as text. */
                <FormField required label={form.location ? `Room - ${locations.find(l => l.code === form.location)?.name || form.location}` : "Room"}>
                  <input value={form.roomName || roomName(form.roomCode)} readOnly aria-label="Room" className={cn(inputCls, "w-full")}/>
                </FormField>
              ) : (
                <FormField required label={form.location ? `Room - ${locations.find(l => l.code === form.location)?.name || form.location}` : "Room"}>
                  {/* Searchable: type to filter. Only rooms free for the chosen time are listed. */}
                  <SearchableSelect
                    value={form.roomCode}
                    onChange={v => setForm(f => ({ ...f, roomCode: v, roomName: rooms.find(r => r.code === v)?.name || "" }))}
                    options={rooms.map(r => ({ value: r.code, label: r.name }))}
                    placeholder={!form.location ? "Location not detected" : roomsLoading ? "Loading rooms…" : rooms.length === 0 ? "No room free for this time" : "Select room"}
                    disabled={!form.location || roomsLoading}
                  />
                </FormField>
              ))}
            </div>

            {showLocRoom && form.roomCode && conflict && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 text-xs">
                <AlertTriangle size={14} className="mt-0.5 shrink-0"/>
                <span>Conflicts with {conflict.employeeName || "another booking"}'s "{conflict.purpose}" ({fmtTime(conflict.start)}–{fmtTime(conflict.end)}).</span>
              </div>
            )}

            {/* The meeting purpose: required, 10 to 200 characters (typing stops at 200, no counter shown). */}
            <FormField required label="Purpose">
              <textarea value={form.purpose} maxLength={200} rows={2} onChange={e => setForm(f => ({ ...f, purpose: e.target.value.replace(/\s*[\r\n]+\s*/g, " ") }))}
                aria-label="Purpose" className={cn(inputCls, "w-full resize-none")}/>
            </FormField>

            <FormField label={`Participants${form.participantIds.length ? ` (${form.participantIds.length})` : ""}`}>
              <EmployeeMultiPicker
                value={form.participantIds}
                onChange={ids => setForm(f => ({ ...f, participantIds: ids }))}
                excludeIds={[currentUser.id]}
              />
            </FormField>

            {withRoom && form.roomCode && (<>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Breakfast">
                  <select value={form.breakfast} onChange={e => setForm(f => ({ ...f, breakfast: e.target.value }))} className={inputCls} disabled={mealRestricted}>
                    {MEAL_OPTIONS.filter(o => !mealRestricted || o === "Not Required").map(o => <option key={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Tea">
                  <select value={form.tea} onChange={e => setForm(f => ({ ...f, tea: e.target.value }))} className={inputCls} disabled={mealRestricted}>
                    {MEAL_OPTIONS.filter(o => !mealRestricted || o === "Not Required").map(o => <option key={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Lunch">
                  <select value={form.lunch} onChange={e => setForm(f => ({ ...f, lunch: e.target.value }))} className={inputCls} disabled={mealRestricted}>
                    {MEAL_OPTIONS.filter(o => !mealRestricted || o === "Not Required").map(o => <option key={o}>{o}</option>)}
                  </select>
                </FormField>
              </div>
              {mealRestricted && (
                <p className="text-[11px] text-muted-foreground -mt-1">Breakfast/Tea/Lunch are not available for this location.</p>
              )}
            </>)}
          </div>
          <DaySchedule
            date={form.date} onDate={setDate} minDate={mode === "add" ? todayStr : undefined}
            roomName={withRoom && form.roomCode ? (form.roomName || roomName(form.roomCode)) : ""}
            dayBookings={scheduleBookings} start={form.start} end={form.end}
            timeFormat={timeFormat} fmtTime={fmtTime}
          />
        </div>
      </div>
    </div>
  );
}
