import { useState, useMemo, useRef, useEffect } from "react";
import {
  LayoutGrid, List, Plus, CalendarClock, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/utils/cn";
import { Btn } from "@/shared/components/Btn";
import { useHasExactRole } from "@/shared/access/access.store";
import {
  useConferenceContextQuery, useConferenceRoomsQuery, useConferenceLocationBookingsQuery, useConferenceMyBookingsQuery,
  useConferenceLocationDayQuery, useConferenceBookingDetailFetch, useConferenceMutations,
} from "../hooks/useConferenceQuery";
import { validateBookingForm, isMealRestrictedLocation } from "../conference.validators";
import { getNearestLocation } from "../services/conferenceRooms.service";
import { TIME_SLOTS, minutesToLabel, minutesTo12hLabel } from "../conference.constants";
import { useCurrentUser } from "@/features/employees";
import { BookingFormPanel } from "../components/BookingFormPanel";
import { BookingDetailsPanel } from "../components/BookingDetailsPanel";
import { MyBookingsTab } from "../components/MyBookingsTab";
import { AllBookingsTab } from "../components/AllBookingsTab";
import { TeamsCalendar } from "../components/TeamsCalendar";
import { BookingCard } from "../components/BookingCard";
import { startOfDay, toDateStr, viewRange } from "../teamsCalendar.utils";
import { DatePickerCalendar } from "@/shared/components/DatePickerCalendar";


function fmtDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function shiftDate(dateStr, deltaDays) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + deltaDays);
  return fmtDate(d);
}

const emptyForm = {
  location: "", roomCode: "", roomName: "", date: "", start: null, end: null,
  // participantIds: array of picked employee ids (EmployeeMultiPicker) — the attendees COUNT is
  // always derived from this array's length (participantIds.length), never a separately-typed
  // number; see conference.service.js's ASSUMED PARTICIPANT CONTRACT for the wire shape.
  roomLocked: false, // the room was chosen by clicking its column on the calendar: shown as plain text in the new-booking window, not a dropdown
  wasRoomless: false, // editing a booking that has no room yet (a room can be added, or left out)
  purpose: "", participantIds: [], breakfast: "Not Required", tea: "Not Required", lunch: "Not Required",
  // "Entire booking" vs "This slot only" — see the edit panel's scope toggle. slot*/entire* hold
  // each option's own range; `start`/`end` (submitted to the server) always mirror whichever one
  // is currently selected via `scope`.
  scope: "slot", slotStart: null, slotEnd: null, entireStart: null, entireEnd: null,
};

const TABS = [
  { id: "calendar", label: "Calendar", icon: <LayoutGrid size={13}/> },
  { id: "my-bookings", label: "My Bookings", icon: <CalendarClock size={13}/> },
  { id: "all-bookings", label: "All Bookings", icon: <List size={13}/> },
];

export default function ConferencePage({ onHome }) {
  const { data: ctx, isLoading: ctxLoading } = useConferenceContextQuery();
  const locations = ctx.locations;
  const isHrAdmin = useHasExactRole("HRAdmin"); // the bookings Excel export is HRAdmin only (ITAdmin does not get it)

  const [activeTab, setActiveTab] = useState("calendar");
  const [location, setLocation] = useState("");
  // Teams-style calendar state: the day shown, the time scale and whether the mini-calendar pane is shown.
  // Scale and pane are remembered in this browser.
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const calendarDate = toDateStr(anchor);
  // Day / Week / Month, like the Teams calendar. The choice is remembered in this browser.
  const [calView, setCalView] = useState(() => {
    try { const v = localStorage.getItem("conference.calendarView"); return v === "week" || v === "month" ? v : "day"; } catch { return "day"; }
  });
  const changeCalView = (v) => { setCalView(v); try { localStorage.setItem("conference.calendarView", v); } catch { /* storage unavailable */ } };
  const readPref = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
  const writePref = (key, value) => { try { localStorage.setItem(key, String(value)); } catch { /* storage unavailable */ } };
  // The booking card shown beside a clicked calendar block.
  const [card, setCard] = useState(null); // { booking, el }


  const [showFormPanel, setShowFormPanel] = useState(false);
  const [formMode, setFormMode] = useState("add"); // "add" | "edit"
  // "Choose location & room" toggle: false = a plain Teams/Outlook meeting (no room, nothing saved in the
  // database); true = a real room booking. Off by default; on when opened from a calendar cell or editing.
  const [withRoom, setWithRoom] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const editingIdRef = useRef(null);

  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [detailsBooking, setDetailsBooking] = useState(null);
  const [detailsHideParticipants, setDetailsHideParticipants] = useState(false); // opened from the All Bookings table: the invited people are not shown

  const { data: rooms, isLoading: roomsLoading } = useConferenceRoomsQuery(location);
  // The calendar is PERSONAL, like the Teams calendar: only what the signed-in person booked or was invited to -- room bookings and meetings with no room,
  // at every location -- for the day, the week or the month grid on screen. Other people's bookings are not shown (the booking window still offers only the
  // rooms that are free for the chosen time).
  const calRange = viewRange(calView, anchor);
  const { data: calBookings, isLoading: calLoading } = useConferenceMyBookingsQuery(calRange.from, calRange.to);

  // My Bookings / All Bookings are driven by a From-To date range instead of one day. Default: 30 days back to
  // today (current date - 30 days to the current date); change either date to refetch.
  const [rangeFrom, setRangeFrom] = useState(() => shiftDate(fmtDate(new Date()), -30));
  const [rangeTo, setRangeTo] = useState(() => fmtDate(new Date()));
  const { data: rangeBookings } = useConferenceLocationBookingsQuery(location, rangeFrom, rangeTo);

  // The booking form lists only the rooms that are FREE for the chosen date and time: the location's rooms minus those that
  // already have a booking overlapping that slot (the server stays the sole authority on real conflicts at submit time).
  const { data: formRooms, isLoading: formRoomsLoading } = useConferenceRoomsQuery(form.location);
  const { data: formLocDay, isFetching: formDayFetching } = useConferenceLocationDayQuery(form.location, form.date);

  const { fetchBookingDetail } = useConferenceBookingDetailFetch();
  const {
    add, isAdding, update, isUpdating, cancel, isCancelling, invite, isInviting,
    inviteOne, invitingOneId,
  } = useConferenceMutations();
  const CURRENT_USER = useCurrentUser();
  const queryClient = useQueryClient();

  // Location comes from the browser's GPS position, not a dropdown: on page load the position is sent to
  // the backend, which matches it against each room's Latitude/Longitude/Radius and returns the plant the
  // user is at. "locating" -> "found" | "none" (permission denied, no GPS/HTTPS, or not within any room's
  // radius); with "none" the Location dropdown in the My Bookings / All Bookings tabs is the way to pick one.
  const [geoStatus, setGeoStatus] = useState("locating");
  // Why detection failed -- shown in the calendar so the fix is obvious.
  const [geoReason, setGeoReason] = useState("");
  // Finding the position can take several seconds (laptops use Wi-Fi positioning), so the last detected
  // location is remembered in this browser and used immediately on the next visit; detection then runs
  // quietly in the background and switches the location only if the user is somewhere else now (and has
  // not picked one by hand in the meantime).
  const GEO_CACHE_KEY = "conference.lastLocation";
  const locationPickedByUser = useRef(false);
  const geoFail = (reason, quiet) => { if (!quiet) { setGeoReason(reason); setGeoStatus("none"); } };
  const detectLocation = (quiet = false) => {
    if (!quiet) { setGeoStatus("locating"); setGeoReason(""); }
    // The browser only exposes GPS on a secure page (https:// or localhost).
    if (!window.isSecureContext) { geoFail("insecure", quiet); return; }
    if (!("geolocation" in navigator)) { geoFail("unsupported", quiet); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const nearest = await getNearestLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          if (nearest?.locationCode) {
            if (!locationPickedByUser.current) setLocation(nearest.locationCode);
            try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ code: nearest.locationCode, ts: Date.now() })); } catch { /* storage unavailable */ }
            setGeoReason("");
            setGeoStatus("found");
          } else {
            geoFail("nomatch", quiet);
          }
        } catch {
          geoFail("error", quiet);
        }
      },
      (err) => geoFail(err?.code === 1 ? "denied" : err?.code === 3 ? "timeout" : "unavailable", quiet),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30 * 60 * 1000 }
    );
  };
  useEffect(() => {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "null"); } catch { /* ignore */ }
    if (cached?.code) {
      setLocation(cur => cur || cached.code);
      setGeoStatus("found");
      detectLocation(true); // quiet re-check in the background
    } else {
      detectLocation();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 24-hour or 12-hour (AM/PM) display of the calendar's time column -- display only; times are still stored
  // and sent as 24-hour. The choice is remembered in this browser.
  const [timeFormat, setTimeFormat] = useState(() => {
    // Defaults to 12-hour (AM|PM) until the user switches to 24-hour; the choice is remembered.
    try { return localStorage.getItem("conference.timeFormat") === "24" ? "24" : "12"; } catch { return "12"; }
  });
  const changeTimeFormat = (value) => {
    setTimeFormat(value);
    try { localStorage.setItem("conference.timeFormat", value); } catch { /* storage unavailable */ }
  };
  // One formatter for every time shown in the calendar (time column, booking text, tooltips), so they
  // all follow the AM|PM switch together.
  const fmtTime = (minutes) => (timeFormat === "12" ? minutesTo12hLabel(minutes) : minutesToLabel(minutes));

  const GEO_MESSAGES = {
    insecure: "Location needs a secure (https) page. Open this app over https:// and allow location access.",
    unsupported: "This browser does not support location access.",
    denied: "Location access is blocked. Allow it for this site in the browser's address bar, then reload the page.",
    timeout: "Finding your location took too long. Reload the page to try again.",
    unavailable: "Your position is not available right now. Reload the page to try again.",
    nomatch: "You are not within any conference room's area. Pick a location from the Location dropdown.",
    error: "Could not check your location with the server. Reload the page to try again.",
  };

  // Until the position is known, or when it cannot be found, the location starts on the employee's own plant (e.g. BLRF), not on "Select location...".
  const ownPlant = String(CURRENT_USER?.plant ?? "").trim();
  useEffect(() => {
    if (ownPlant && locations.some(l => l.code === ownPlant)) setLocation(cur => cur || ownPlant);
  }, [ownPlant, locations]);

  const hasCalendarSelection = !!location;
  const mealRestricted = isMealRestrictedLocation(form.location);

  // Trimmed on both sides (the database's employee numbers can come back space-padded), and matched against
  // the employee code as well, so the organizer's Edit / Invite / Cancel buttons reliably appear.
  const isMyBooking = (b) => {
    if (!b) return false;
    const booked = String(b.employeeId ?? "").trim();
    return !!booked && [CURRENT_USER.id, CURRENT_USER.empCode].some(id => String(id ?? "").trim() === booked);
  };

  // Editing a booking must never see its own current range as "already taken", so it is left out of every check below.
  const slotBookings = useMemo(() => formLocDay.filter(b => b.id !== editingId && b.status !== "Cancelled"), [formLocDay, editingId]);
  const overlapsSlot = (b) => form.start != null && form.end != null && form.start < b.end && form.end > b.start;

  // Rooms free for the chosen slot (none are offered until a time is chosen).
  const availableRooms = useMemo(() => {
    if (form.start == null || form.end == null) return [];
    const taken = new Set(slotBookings.filter(overlapsSlot).map(b => b.roomCode));
    return formRooms.filter(r => !taken.has(r.code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formRooms, slotBookings, form.start, form.end]);

  // The picked room, if another booking now overlaps the slot (e.g. the time was changed) -- shown as a conflict.
  const conflictingBooking = useMemo(
    () => (form.roomCode ? slotBookings.find(b => b.roomCode === form.roomCode && overlapsSlot(b)) || null : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slotBookings, form.roomCode, form.start, form.end]
  );

  // What the form's day schedule draws: the picked room's bookings, or every room's at this location while none is picked.
  const scheduleBookings = useMemo(
    () => (form.roomCode ? slotBookings.filter(b => b.roomCode === form.roomCode) : slotBookings),
    [slotBookings, form.roomCode]
  );

  // A room that is no longer free for the slot (the time or date was changed) is dropped, so a stale room is never booked.
  useEffect(() => {
    if (!form.roomCode || formDayFetching || formRoomsLoading) return;
    if (!availableRooms.some(r => r.code === form.roomCode)) setForm(f => ({ ...f, roomCode: "", roomName: "" }));
  }, [availableRooms, form.roomCode, formDayFetching, formRoomsLoading]);

  const todayStr = fmtDate(new Date());

  const changeLocation = (val) => {
    locationPickedByUser.current = true; // a hand-picked location is never overridden by detection
    setLocation(val);
  };

  const changeFormLocation = (val) => {
    setForm(f => ({ ...f, location: val, roomCode: "" }));
  };

  // Lock Breakfast/Tea/Lunch to "Not Required" the moment the form's location resolves to a
  // meal-restricted one (real legacy CRPO compliance rule — see isMealRestrictedLocation).
  useEffect(() => {
    if (!mealRestricted) return;
    setForm(f => (f.breakfast === "Not Required" && f.tea === "Not Required" && f.lunch === "Not Required")
      ? f
      : { ...f, breakfast: "Not Required", tea: "Not Required", lunch: "Not Required" });
  }, [mealRestricted]);

  const openAddPanel = (roomCode, dateStr, start, end, loc = location) => {
    setFormMode("add");
    // A new booking opens as "Virtual / In Person" (no room); only when it is opened from a room's own column on the calendar (the room is already chosen) does it start as "Conference Room Required".
    setWithRoom(!!roomCode);
    setEditingId(null);
    editingIdRef.current = null;
    setForm({
      ...emptyForm, location: loc, roomCode, roomName: rooms.find(r => r.code === roomCode)?.name || "", roomLocked: !!roomCode, date: dateStr, start, end,
      slotStart: start, slotEnd: end, entireStart: start, entireEnd: end,
    });
    setShowFormPanel(true);
  };

  // "New Booking" button: opens the booking modal with no room picked yet. Date is the one the calendar is
  // showing (or today); Start/End default to the next slot from now when booking today, else the first slot.
  // The modal's time dropdowns follow the calendar's AM|PM switch (timeFormat).
  const openNewBooking = () => {
    let date = activeTab === "calendar" && calendarDate ? calendarDate : todayStr;
    if (date < todayStr) date = todayStr; // never start a booking in the past
    const nowDate = new Date();
    const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
    let slot = date === todayStr ? TIME_SLOTS.find(s => s.start >= nowMin) : TIME_SLOTS[0];
    if (!slot) {
      // Today's last slot (midnight) is over -- nothing is left to book today, so start on the next day's first slot instead of a slot that has passed.
      date = shiftDate(todayStr, 1);
      slot = TIME_SLOTS[0];
    }
    openAddPanel("", date, slot.start, slot.end); // opens as "Virtual / In Person"
  };

  const openEditPanel = (booking, clickedStart, clickedEnd) => {
    const slotStart = clickedStart ?? booking.start;
    const slotEnd = clickedEnd ?? booking.end;
    setFormMode("edit");
    setWithRoom(true);
    setEditingId(booking.id);
    editingIdRef.current = booking.id;
    setForm({
      location: booking.locationCode, roomCode: booking.roomCode, roomName: booking.roomName, wasRoomless: !booking.roomCode,
      date: booking.date, start: slotStart, end: slotEnd,
      purpose: booking.purpose,
      participantIds: (booking.participants || []).map(p => p.id),
      breakfast: booking.breakfast, tea: booking.tea, lunch: booking.lunch,
      scope: "slot", slotStart, slotEnd, entireStart: booking.start, entireEnd: booking.end,
    });
    setShowDetailsPanel(false);
    setShowFormPanel(true);

    // Refresh the canonical stored range in the background so "Entire booking" reflects the
    // server's current state rather than a possibly-stale list-query cache entry. Doesn't block
    // opening the panel — the list data already seeded a reasonable default above.
    fetchBookingDetail(booking.id).then(fresh => {
      if (editingIdRef.current !== booking.id) return; // panel closed/reopened meanwhile
      setForm(f => f.scope === "entire"
        ? { ...f, entireStart: fresh.start, entireEnd: fresh.end, start: fresh.start, end: fresh.end }
        : { ...f, entireStart: fresh.start, entireEnd: fresh.end });
    }).catch(() => { /* best-effort refresh only — central error handler already reported it */ });
  };

  const closeFormPanel = () => {
    setShowFormPanel(false);
    setForm(emptyForm);
    setEditingId(null);
    editingIdRef.current = null;
  };

  // Set while the details window is open (cleared on close).
  const detailsIdRef = useRef(null);
  // true when the details panel was opened from the My Bookings tab (those are the user's own bookings)
  const [detailsFromMine, setDetailsFromMine] = useState(false);

  // The list query does not always carry the booking date or the location (the calendar is already scoped to
  // the location being viewed), so they are filled in from what the calendar is showing.
  const withLocation = (rawBooking) => ({
    ...rawBooking,
    date: rawBooking.date || calendarDate,
    locationCode: rawBooking.locationCode || location,
    locationName: rawBooking.locationName || locations.find(l => l.code === (rawBooking.locationCode || location))?.name || "",
  });

  const openDetailsPanel = (rawBooking, fromMine = false, hideParticipants = false) => {
    // The calendar's day list doesn't carry the booking date or the location (it is already scoped to the
    // date and location being viewed), so they're filled in from what the calendar is showing. Without the
    // date the details window treated the booking as long past and hid Edit / Invite / Cancel.
    const booking = {
      ...rawBooking,
      date: rawBooking.date || calendarDate,
      locationCode: rawBooking.locationCode || location,
      locationName: rawBooking.locationName || locations.find(l => l.code === (rawBooking.locationCode || location))?.name || "",
    };
    setDetailsFromMine(fromMine === true);
    setDetailsHideParticipants(hideParticipants === true);
    detailsIdRef.current = booking.id;
    setDetailsBooking(booking);
    setShowDetailsPanel(true);
  };

  const closeDetailsPanel = () => {
    detailsIdRef.current = null;
    setDetailsFromMine(false);
    setShowDetailsPanel(false);
    setDetailsBooking(null);
  };

  // Direct one-click cancel from the details panel — cancels the booking's own full [start,end)
  // range (not a partial slot), matching the reference app's details-view "Cancel" button acting
  // on the whole booking without needing to go through the Edit form's scope toggle first.
  const cancelBookingFromDetails = (booking) => {
    cancel({ bookingId: booking.id, start: booking.start, end: booking.end }, {
      onSuccess: () => { toast.success("Booking cancelled"); closeDetailsPanel(); },
    });
  };

  const inviteParticipants = (booking) => {
    invite(booking, {
      onSuccess: () => toast.success("Invitations sent"),
    });
  };

  const inviteOneParticipant = (booking, participant) => {
    inviteOne({ bookingId: booking.id, participantEmpId: participant.id }, {
      onSuccess: () => toast.success(`Invitation sent to ${participant.name || participant.id}`),
    });
  };

  const setScope = (scope) => {
    setForm(f => ({
      ...f, scope,
      start: scope === "entire" ? f.entireStart : f.slotStart,
      end: scope === "entire" ? f.entireEnd : f.slotEnd,
    }));
  };

  const submitForm = () => {
    // No room picked (or "Virtual / In Person"): only the Teams meeting is created -- it is saved without a room, shows on the calendar, and
    // can be given a room later (open it and pick one of the rooms free for its time). A Teams link is created in every case.
    // "Conference Room Required" now needs a room when a booking is made (the "Meeting only" choice is gone from the room list); an existing meeting that
    // has no room yet can still be edited without one.
    const meetingOnly = !withRoom || (formMode === "edit" && !form.roomCode);
    const errors = validateBookingForm({
      meetingOnly,
      location: form.location, room: form.roomCode, date: form.date,
      purpose: form.purpose, participantIds: form.participantIds, start: form.start, end: form.end,
    });
    if (Object.keys(errors).length) { toast.error(Object.values(errors)[0]); return; }

    const basePayload = {
      locationCode: form.location, roomCode: meetingOnly ? "" : form.roomCode, date: form.date,
      start: form.start, end: form.end, purpose: form.purpose.trim(),
      participantIds: form.participantIds,
      // meals belong to a room booking; a meeting with no room has none
      breakfast: meetingOnly ? "Not Required" : form.breakfast, tea: meetingOnly ? "Not Required" : form.tea, lunch: meetingOnly ? "Not Required" : form.lunch,
    };

    if (formMode === "add") {
      add(basePayload, {
        onSuccess: () => {
          toast.success(meetingOnly
            ? "Meeting created. The Teams meeting link will be emailed. Open it on the calendar."
            : `Room booked for ${fmtTime(form.start)}–${fmtTime(form.end)}. The Teams meeting link will be emailed.`);
          closeFormPanel();
        },
      });
    } else {
      // slotStart/slotEnd identify WHICH portion of the existing booking is being edited (the
      // scope toggle's selection) — distinct from start/end, the NEW target time for that
      // portion (only differs if the user also changed the Start/End selects after picking scope).
      const slotStart = form.scope === "entire" ? form.entireStart : form.slotStart;
      const slotEnd = form.scope === "entire" ? form.entireEnd : form.slotEnd;
      update({ bookingId: editingId, slotStart, slotEnd, ...basePayload }, {
        onSuccess: () => { toast.success(!form.roomCode ? "Room removed. It is now a meeting with no room." : form.wasRoomless ? "Room added to the meeting" : "Booking updated"); closeFormPanel(); },
      });
    }
  };

  const cancelBookingFromPanel = () => {
    if (!editingId) return;
    // form.start/form.end already mirror whichever scope (slot-only vs entire booking) is
    // selected — see setScope — so that's the exact range being cancelled.
    cancel({ bookingId: editingId, start: form.start, end: form.end }, {
      onSuccess: () => { toast.success("Booking cancelled"); closeFormPanel(); },
    });
  };

  return (
    <div className="conference-page flex flex-col gap-4 [--ring:#5B5FC7]">
      {/* One toolbar row: title, tabs, date (calendar / all bookings) or location (my / all bookings) on the
          left. Wraps onto more lines on a narrow screen. */}
      {/* pr-10 keeps this toolbar clear of the floating close (X) button at the screen's top-right corner; the
          calendar below it uses the full width. */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-2 animate-fade-in-up" style={{ animationDelay: "0ms" }}>
        {/* Clicking the title goes back to the home page (this page has no sidebar of its own). */}
        <h2 className="h-8 flex items-center text-sm font-medium text-foreground whitespace-nowrap">
          <button type="button" onClick={onHome} title="Go to home"
            className="inline-flex items-center gap-1.5 bg-transparent border-none p-0 font-medium text-sm text-foreground cursor-pointer hover:text-[#5B5FC7] transition-colors">
            <ArrowLeft size={15}/> Book a meeting
          </button>
        </h2>

        <div className="flex gap-1 teams-tablist flex-wrap max-w-full">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn("flex items-center gap-1.5 h-8 px-2.5 sm:px-3 text-sm font-medium rounded-md transition-colors border-none cursor-pointer whitespace-nowrap",
                activeTab === t.id ? "bg-[#5B5FC7] text-white shadow" : "text-muted-foreground hover:text-foreground bg-transparent")}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>


        {(activeTab === "my-bookings" || activeTab === "all-bookings") && (
          <div className="flex items-center gap-3 flex-wrap max-w-full">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">From Date</label>
              <DatePickerCalendar value={rangeFrom} onChange={v => setRangeFrom(v)} max={rangeTo || undefined} ariaLabel="From date" className="h-8"/>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">To Date</label>
              <DatePickerCalendar value={rangeTo} onChange={v => setRangeTo(v)} min={rangeFrom || undefined} ariaLabel="To date" className="h-8"/>
            </div>
          </div>
        )}

        {/* Always available (every tab): starts on the location detected from the browser's position, and can
            be changed by hand to look at / book a room in another location. The booking modal has no
            location dropdown of its own -- it uses this one. */}
        <select value={location} onChange={e => changeLocation(e.target.value)} aria-label="Location" disabled={ctxLoading}
          className="min-w-0 max-w-full h-8 border border-border rounded-md py-0 px-3 text-sm bg-input-background focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">{ctxLoading ? "Loading locations..." : "Select location..."}</option>
          {locations.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>

        {activeTab !== "calendar" && <button type="button" onClick={openNewBooking} disabled={!location}
          title={location ? "Create a new booking" : "Select a location first"}
          className="ml-auto flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md border-none bg-[#5B5FC7] text-white cursor-pointer transition-colors hover:enabled:bg-[#4F52B2] disabled:opacity-50 disabled:cursor-not-allowed">
          <Plus size={14}/> New Booking
        </button>}
      </div>

      {activeTab === "calendar" && (
        <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <TeamsCalendar
            bookings={calBookings.filter(b => b.status !== "Cancelled")}
            loading={calLoading}
            anchor={anchor} onAnchor={setAnchor}
            view={calView} onView={changeCalView}
            timeFormat={timeFormat} onTimeFormat={changeTimeFormat}
            onOpen={(booking, el) => setCard({ booking: withLocation(booking), el })}
            // A click or drag over a free time starts a booking for that day and range; the booking window then lists only the rooms free for that time.
            onCreate={(dateStr, start, end) => openAddPanel("", dateStr, start, end)}
            onNew={openNewBooking} newDisabled={!location}
            emptyMessage="" /* the calendar needs no location: it shows the person's own bookings; only a NEW booking needs one (the New button says so) */
          />
        </div>
      )}
      {activeTab === "my-bookings" && (
        <MyBookingsTab onOpenDetails={openDetailsPanel} from={rangeFrom} to={rangeTo} timeFormat={timeFormat}/>
      )}

      {activeTab === "all-bookings" && (
        <AllBookingsTab
          bookings={rangeBookings}
          rooms={rooms}
          from={rangeFrom}
          to={rangeTo}
          timeFormat={timeFormat}
          hasSelection={hasCalendarSelection}
          onOpenDetails={(b) => openDetailsPanel(b, false, true)} // the All Bookings table never shows who was invited, not in its window either
          isHrAdmin={isHrAdmin}
        />
      )}

      <BookingFormPanel
        open={showFormPanel}
        mode={formMode}
        onClose={closeFormPanel}
        form={form}
        setForm={setForm}
        onChangeLocation={changeFormLocation}
        locations={locations}
        rooms={availableRooms}
        roomsLoading={formRoomsLoading || formDayFetching}
        mealRestricted={mealRestricted}
        conflict={conflictingBooking}
        scheduleBookings={scheduleBookings}
        currentUser={CURRENT_USER}
        onSubmit={submitForm}
        isSubmitting={formMode === "add" ? isAdding : isUpdating}
        withRoom={withRoom}
        setWithRoom={setWithRoom}
        timeFormat={timeFormat}
        onCancel={cancelBookingFromPanel}
        isCancelling={isCancelling}
        onSetScope={setScope}
      />

      <BookingDetailsPanel
        timeFormat={timeFormat}
        hideParticipants={detailsHideParticipants}
        open={showDetailsPanel}
        onClose={closeDetailsPanel}
        booking={detailsBooking}
        // Edit / Invite / Cancel only for the person who booked it. My Bookings now also lists bookings the person is merely invited to, so being in
        // that tab no longer means "mine" (it only does for a row that carries no booker id at all).
        isMine={isMyBooking(detailsBooking) || (detailsFromMine && !String(detailsBooking?.employeeId ?? "").trim())}
        onEdit={openEditPanel}
        onCancel={cancelBookingFromDetails}
        isCancelling={isCancelling}
        onInvite={inviteParticipants}
        isInviting={isInviting}
        onInviteOne={inviteOneParticipant}
        invitingParticipantId={invitingOneId}
      />

      <BookingCard
        booking={card?.booking} anchorEl={card?.el} onClose={() => setCard(null)}
        isMine={card ? isMyBooking(card.booking) : false} timeFormat={timeFormat}
        onEdit={(b) => { setCard(null); openEditPanel(b); }}
        onCancel={(b) => { setCard(null); cancelBookingFromDetails(b); }}
        isCancelling={isCancelling}
        onInvite={inviteParticipants} isInviting={isInviting}
        onAllDetails={(b) => { setCard(null); openDetailsPanel(b); }}
      />
    </div>
  );
}
