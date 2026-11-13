// Real AMSBackendAPI integration for the Holiday Calendar, backed by the real
// dbo.HolidayCalendarMaster table (spv1_HolidayCalendar) — replaces the old att_calendar/
// att_calendar_pattern-derived contract entirely (no more "Holiday" name placeholder; HolidayName
// is a real column now).
//
// Reconciled contract (AMS.Api/Features/Holidays):
//   GET  /holidays/locations                      -> { data: string[] }  — every distinct
//     Location value ("<CODE> | <NAME>", e.g. "BLRF | BANGALORE FACTORY") that has holiday rows.
//   GET  /holidays?year={yyyy}&location={loc}      -> { data: HolidayItem[] }  — location omitted
//     = every location (used by Dashboard's "Upcoming Holidays" widget).
//   POST /holidays  body: FormData{ file }  -> { data: { rowsSubmitted, rowsAffected } }
// HolidayItem = { id, date ("yyyy-MM-dd"), dayOfWeek, name, location }.
import * as controller from "../controllers/holidayCalendar.controller";

function normalizeDate(value) {
  if (!value) return value;
  const ddMMyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (ddMMyyyy) {
    const [, d, m, y] = ddMMyyyy;
    return `${y}-${m}-${d}`;
  }
  return value;
}

// Names and locations are stored in capitals ("DIWALI", "BANGALORE CORPORATE OFFICE"); the screens show "Diwali", "Bangalore Corporate Office".
export const titleCase = (text) => String(text ?? "").toLowerCase().replace(/(^|[\s(\-/])([a-z])/g, (_, lead, ch) => lead + ch.toUpperCase());

function toHolidayRow(r) {
  const date = normalizeDate(r.date ?? r.holidayDate);
  return {
    id: String(r.id ?? `${r.location}-${date}`),
    name: titleCase(r.name ?? r.holidayName ?? ""),
    date,
    day: r.dayOfWeek ?? r.day ?? "",
    location: r.location ?? "",
  };
}

// Every distinct Location that has holiday rows — backs the searchable Location dropdown. Never
// hardcoded: grows automatically as more locations get holidays added via Bulk Upload.
export async function getHolidayLocations() {
  const data = await controller.locations();
  return data || [];
}

// `location` omitted/blank fetches every location's holidays for that year (Dashboard's
// "Upcoming Holidays" widget); a specific location scopes to just that one (HolidaysPage.jsx).
export async function getHolidays({ year, location } = {}) {
  const params = { year: year ?? new Date().getFullYear() };
  if (location) params.location = location;
  const data = await controller.list(params);
  return (data || []).map(toHolidayRow);
}
