import { Building2, Calendar, Clock, Mail, Phone, Pencil, User as UserIcon, Users, Utensils, X, Send, Loader2 } from "lucide-react";
import { SlideOver } from "@/shared/components/SlideOver";
import { Btn } from "@/shared/components/Btn";
import { minutesToLabel, minutesTo12hLabel } from "../conference.constants";

function Row({ icon, label, children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
        <div className="text-foreground break-words">{children}</div>
      </div>
    </div>
  );
}

// Booking details slide-in panel — replaces the old hover tooltip for the Calendar view AND is
// reused by My Bookings/All Bookings cards+rows so there's exactly one "view a booking" surface
// in the whole feature. `isMine` gates Edit/Cancel/Invite (matching the reference app's own
// "organizer-only, not-cancelled" gating). `onInvite` (the footer's bulk "Invite" button) re-
// notifies every participant at once; `onInviteOne` sends to exactly one, next to their name in
// the Participants list — `invitingParticipantId` scopes the loading spinner to that one row
// instead of graying out the whole list while any single invite is in flight.
export function BookingDetailsPanel({
  open, onClose, booking, isMine, onEdit, onCancel, isCancelling, onInvite, isInviting,
  onInviteOne, invitingParticipantId, timeFormat = "24", hideParticipants = false,
}) {
  if (!booking) return null;
  // Times follow the calendar's AM|PM switch: "3:00 PM" or "15:00" (display only).
  const fmtTime = (m) => (timeFormat === "12" ? minutesTo12hLabel(m) : minutesToLabel(m));
  const mealsRequested = [
    booking.breakfast === "Required" && "Breakfast",
    booking.tea === "Required" && "Tea",
    booking.lunch === "Required" && "Lunch",
  ].filter(Boolean);
  const isCancelled = booking.status === "Cancelled";
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const isPast = booking.date < todayStr || (booking.date === todayStr && booking.end <= now.getHours() * 60 + now.getMinutes());

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={booking.purpose || "Booking Details"}
      widthClass="max-w-2xl"
      footer={
        <div className="flex flex-wrap gap-2 w-full">
          {isMine && !isCancelled && !isPast && (
            <>
              <Btn variant="teams" size="sm" onClick={() => onEdit(booking)}><Pencil size={13}/> Edit</Btn>
              <Btn variant="secondary" size="sm" onClick={() => onInvite(booking)} loading={isInviting}><Send size={13}/> Invite</Btn>
              <Btn variant="secondary" size="sm" onClick={() => onCancel(booking)} loading={isCancelling}><X size={13}/> Cancel</Btn>
            </>
          )}
          <Btn variant="ghost" size="sm" className="ml-auto" onClick={onClose}>Close</Btn>
        </div>
      }
    >
      <Row icon={<Building2 size={15}/>} label="Room">{booking.roomName ? `${booking.roomName} (${booking.locationName})` : `No room yet (${booking.locationName})`}</Row>
      <Row icon={<Calendar size={15}/>} label="Date">{booking.date}</Row>
      <Row icon={<Clock size={15}/>} label="Time">{fmtTime(booking.start)} – {fmtTime(booking.end)}</Row>
      <Row icon={<UserIcon size={15}/>} label="Organizer">{booking.employeeName}</Row>
      {booking.contact && <Row icon={<Phone size={15}/>} label="Contact">{booking.contact}</Row>}
      {booking.email && <Row icon={<Mail size={15}/>} label="Email">{booking.email}</Row>}
      {/* hideParticipants: set when the window was opened from the All Bookings table, which does not show who was invited. */}
      {!hideParticipants && booking.participants?.length > 0 && (
        <Row icon={<Users size={15}/>} label={`Participants (${booking.participants.length})`}>
          <div className="flex flex-col gap-1.5 mt-0.5">
            {booking.participants.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{p.name || p.id}</span>
                {isMine && !isCancelled && onInviteOne && !p.id.includes("@") && (
                  <button
                    type="button"
                    title={`Send invitation to ${p.name || p.id}`}
                    disabled={invitingParticipantId === p.id}
                    onClick={() => onInviteOne(booking, p)}
                    className="p-1 rounded-md border border-border bg-transparent cursor-pointer transition-colors hover:bg-[#5B5FC7] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {invitingParticipantId === p.id ? <Loader2 size={12} className="animate-spin"/> : <Send size={12}/>}
                  </button>
                )}
              </div>
            ))}
          </div>
        </Row>
      )}
      {mealsRequested.length > 0 && (
        <Row icon={<Utensils size={15}/>} label="Meals Requested">{mealsRequested.join(", ")}</Row>
      )}
    </SlideOver>
  );
}
