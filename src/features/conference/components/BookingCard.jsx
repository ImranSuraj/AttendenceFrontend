import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Clock, MapPin, Pencil, Send, Users, Utensils, X } from "lucide-react";
import { Btn } from "@/shared/components/Btn";
import { minutesTo12hLabel, minutesToLabel } from "../conference.constants";

const CARD_W = 392;

/**
 * The Teams-style details card shown when a booking is clicked on the calendar: a coloured strip, the
 * title, an action row, then icon rows (time, room, people, meals). It floats beside the clicked block
 * and flips to the other side when there is no room. The full-detail slide-over stays available through
 * "All details" (that surface is shared with the My Bookings / All Bookings tabs).
 */
export function BookingCard({
  booking, anchorEl, onClose, isMine, timeFormat = "24", onEdit, onCancel, isCancelling, onInvite, isInviting, onAllDetails,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0, ready: false });

  useLayoutEffect(() => {
    if (!booking || !anchorEl || !ref.current) return;
    const r = anchorEl.getBoundingClientRect();
    const h = ref.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.right + 8;
    if (left + CARD_W > vw - 8) left = r.left - CARD_W - 8;
    if (left < 8) left = Math.max(8, (vw - CARD_W) / 2); // narrow screen: centre it
    const top = Math.max(8, Math.min(r.top, vh - h - 8));
    setPos({ left, top, ready: true });
  }, [booking, anchorEl]);

  useEffect(() => {
    if (!booking) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target) && !anchorEl?.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [booking, anchorEl, onClose]);

  if (!booking) return null;
  const fmtTime = (m) => (timeFormat === "12" ? minutesTo12hLabel(m) : minutesToLabel(m));
  const date = new Date(`${booking.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "2-digit", day: "2-digit", year: "numeric" });
  const meals = [booking.breakfast === "Required" && "Breakfast", booking.tea === "Required" && "Tea", booking.lunch === "Required" && "Lunch"].filter(Boolean);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isPast = booking.date < today || (booking.date === today && booking.end <= now.getHours() * 60 + now.getMinutes());
  const canAct = isMine && booking.status !== "Cancelled" && !isPast;
  const color = booking.roomName ? "var(--cal-booked-fg)" : "#5B5FC7"; // red = room booked, purple = meeting with no room yet

  return (
    <div ref={ref} role="dialog" aria-label={booking.purpose || "Booking"}
      className="fixed z-[60] bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
      style={{ width: CARD_W, maxWidth: "calc(100vw - 16px)", left: pos.left, top: pos.top, visibility: pos.ready ? "visible" : "hidden", fontFamily: '"Segoe UI", var(--font-sans)' }}>
      <div className="h-1" style={{ backgroundColor: color }}/>
      <div className="p-4 pt-3 flex flex-col gap-2.5">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-xl font-semibold leading-7 text-foreground break-words">{booking.purpose || "Booking"}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded-md bg-transparent border-none cursor-pointer text-muted-foreground hover:bg-muted"><X size={18}/></button>
        </div>

        {canAct && (
          <div className="flex flex-wrap gap-2">
            <Btn variant="teams" size="sm" onClick={() => onEdit(booking)}><Pencil size={13}/> Edit</Btn>
            <Btn variant="secondary" size="sm" onClick={() => onInvite(booking)} loading={isInviting}><Send size={13}/> Invite</Btn>
            <Btn variant="secondary" size="sm" onClick={() => onCancel(booking)} loading={isCancelling}><X size={13}/> Cancel</Btn>
          </div>
        )}

        <div className="h-px bg-border"/>
        <div className="flex items-start gap-3 text-sm text-foreground"><Clock size={18} className="mt-0.5 text-muted-foreground shrink-0"/><span>{date} {fmtTime(booking.start)} - {fmtTime(booking.end)}</span></div>
        <div className="flex items-start gap-3 text-sm text-foreground"><MapPin size={18} className="mt-0.5 text-muted-foreground shrink-0"/><span>{booking.roomName ? `${booking.roomName}${booking.locationName ? ` (${booking.locationName})` : ""}` : `No room yet${booking.locationName ? ` (${booking.locationName})` : ""}`}</span></div>
        <div className="h-px bg-border"/>
        <div className="flex items-start gap-3 text-sm text-foreground">
          <Users size={18} className="mt-0.5 text-muted-foreground shrink-0"/>
          <div className="min-w-0">
            <p>{booking.employeeName || "Someone"} booked this.</p>
            {booking.participants?.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{booking.participants.length} invited: {booking.participants.map(p => p.name || p.id).slice(0, 4).join(", ")}{booking.participants.length > 4 ? ` +${booking.participants.length - 4}` : ""}</p>
            )}
          </div>
        </div>
        {meals.length > 0 && (
          <div className="flex items-start gap-3 text-sm text-foreground"><Utensils size={18} className="mt-0.5 text-muted-foreground shrink-0"/><span>{meals.join(", ")}</span></div>
        )}
        <button type="button" onClick={() => onAllDetails(booking)} className="self-start text-sm text-[#5B5FC7] dark:text-[#AAB1FA] bg-transparent border-none p-0 cursor-pointer hover:underline">All details</button>
      </div>
    </div>
  );
}
