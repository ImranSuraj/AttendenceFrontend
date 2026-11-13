import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { DataTable } from "@/shared/components/DataTable";
import { SearchableSelect } from "@/shared/components/SearchableSelect";
import { minutesToLabel, minutesTo12hLabel } from "../conference.constants";

// "All Bookings" tab — the pre-existing Table view, restructured: it now lists actual BOOKINGS
// (one row per booking, sortable, paginated, real DataTable search) for the header's selected
// Location+Date, rather than the old fixed 48-row per-15-minute-slot grid (which mixed booked and
// empty rows together). There's no real "every location, every date" bookings endpoint among the
// 3 new backend capabilities, so this stays scoped the same way the old Table view was — Room and
// Status become in-tab filters instead of a page-level Room selector, and Location itself is
// still the header's existing selector (repeating it here would just duplicate that control).
// "2026-09-13" -> "13-09-2026" (display only).
const toDmy = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("-") : "...");

export function AllBookingsTab({ bookings, rooms, from, to, onOpenDetails, hasSelection, isHrAdmin, timeFormat = "24" }) {
  // Times follow the calendar's AM|PM switch: "3:00 PM" or "15:00" (display only).
  const fmtTime = (m) => (timeFormat === "12" ? minutesTo12hLabel(m) : minutesToLabel(m));
  const [roomFilter, setRoomFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayStr = (() => {
    const yyyy = now.getFullYear(), mm = String(now.getMonth() + 1).padStart(2, "0"), dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  const rows = useMemo(() => {
    return bookings
      .map(b => ({
        ...b,
        timeRange: `${fmtTime(b.start)}–${fmtTime(b.end)}`,
        computedStatus: (b.date < todayStr || (b.date === todayStr && b.end <= nowMinutes)) ? "Past" : "Upcoming",
      }))
      .filter(b => !roomFilter || b.roomCode === roomFilter)
      .filter(b => !statusFilter || b.computedStatus === statusFilter);
  }, [bookings, roomFilter, statusFilter, todayStr, nowMinutes, timeFormat]);

  const columns = [
    // No Participants column: the table does not list who was invited (the details window of a row still does).
    { key: "date", label: "Date" },
    { key: "roomName", label: "Room" },
    { key: "timeRange", label: "Time", sortable: false },
    { key: "employeeName", label: "Booked By" },
    { key: "purpose", label: "Purpose" },
    { key: "computedStatus", label: "Status" },
  ];

  const roomOptions = [{ value: "", label: "All Rooms" }, ...rooms.map(r => ({ value: r.code, label: r.name }))];
  const statusOptions = [{ value: "", label: "All Statuses" }, { value: "Upcoming", label: "Upcoming" }, { value: "Past", label: "Past" }];

  if (!hasSelection) {
    return <p className="text-sm text-muted-foreground text-center py-16">Select a location to view bookings.</p>;
  }

  return (
    <DataTable
      title={`Bookings ${toDmy(from)} to ${toDmy(to)}`}
      columns={columns}
      data={rows}
      hideExport={!isHrAdmin}
      filterExtra={
        <div className="flex items-center gap-2 flex-wrap">
          <div className="min-w-[160px]"><SearchableSelect value={roomFilter} onChange={setRoomFilter} options={roomOptions} placeholder="All Rooms"/></div>
          <div className="min-w-[160px]"><SearchableSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder="All Statuses"/></div>
        </div>
      }
      actions={(row) => (
        <button onClick={() => onOpenDetails(row)} title="View details"
          className="p-1.5 rounded-md border border-border bg-card cursor-pointer transition-colors hover:bg-[#5B5FC7] hover:text-white hover:border-[#5B5FC7]">
          <Eye size={13}/>
        </button>
      )}
    />
  );
}
