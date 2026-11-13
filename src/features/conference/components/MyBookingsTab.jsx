import { useMemo, useState } from "react";
import { Building2, Calendar, Clock, MapPin } from "lucide-react";
import { Spinner } from "@/shared/components/Spinner";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { cn } from "@/shared/utils/cn";
import { useConferenceMyBookingsQuery } from "../hooks/useConferenceQuery";
import { minutesToLabel, minutesTo12hLabel } from "../conference.constants";

function fmtDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// New tab (real backend capability, see conference.service.js's ASSUMED contract) — every booking
// the current user has ever made, across every location, unlike the header's single-location
// Calendar/All Bookings scoping.
export function MyBookingsTab({ onOpenDetails, from, to, timeFormat = "24" }) {
  // Times follow the calendar's AM|PM switch: "3:00 PM" or "15:00" (display only).
  const fmtTime = (m) => (timeFormat === "12" ? minutesTo12hLabel(m) : minutesToLabel(m));
  const { data: bookings, isLoading } = useConferenceMyBookingsQuery(from, to);
  const [subTab, setSubTab] = useState("today");
  const now = new Date();
  const todayStr = fmtDate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const classified = useMemo(() => {
    const groups = { upcoming: [], today: [], past: [], cancelled: [] };
    bookings.forEach(b => {
      if (b.status === "Cancelled") { groups.cancelled.push(b); return; }
      if (b.date > todayStr) groups.upcoming.push(b);
      else if (b.date === todayStr && b.end > nowMinutes) groups.today.push(b);
      else groups.past.push(b);
    });
    return groups;
  }, [bookings, todayStr, nowMinutes]);

  const SUB_TABS = [
    { id: "upcoming", label: "Upcoming" },
    { id: "today", label: "Today" },
    { id: "past", label: "Past" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const list = classified[subTab] || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 teams-tablist w-fit flex-wrap animate-fade-in-up" style={{ animationDelay: "120ms" }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={cn("flex items-center gap-1.5 py-1.5 px-3 text-sm font-medium rounded-md transition-colors border-none cursor-pointer",
              subTab === t.id ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground bg-transparent")}>
            {t.label} <span className="text-[10px] opacity-70 dark:opacity-100">({(classified[t.id] || []).length})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner message="Loading your bookings…"/>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">No {subTab} bookings.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map(b => (
            <button key={b.id} onClick={() => onOpenDetails(b, true)}
              className="text-left bg-card rounded-lg border border-border p-4 flex flex-col gap-1.5 cursor-pointer transition-colors hover:border-[#5B5FC7]/50 hover-lift animate-fade-in-up">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground text-sm truncate">{b.purpose || "Untitled Booking"}</p>
                <StatusBadge status={subTab === "cancelled" ? "Cancelled" : "Scheduled"}/>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 size={12}/> {b.roomName}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin size={12}/> {b.locationName}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar size={12}/> {b.date}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock size={12}/> {fmtTime(b.start)}–{fmtTime(b.end)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
