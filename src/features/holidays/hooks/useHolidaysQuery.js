import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getHolidays, getHolidayLocations } from "../services/holidayCalendar.service";
import { bulkUploadHolidays } from "../services/calendarUpload.service";

export const HOLIDAYS_QUERY_KEY = ["holidays"];
export const HOLIDAY_LOCATIONS_QUERY_KEY = ["holidays", "locations"];
export const holidaysQueryKey = (year, location) => ["holidays", year, location || "all"];

// Every distinct Location that has holiday rows — backs the searchable Location dropdown.
export function useHolidayLocationsQuery() {
  return useQuery({
    queryKey: HOLIDAY_LOCATIONS_QUERY_KEY,
    queryFn: getHolidayLocations,
    initialData: [],
  });
}

// Scoped to one year + (optionally) one location — HolidaysPage.jsx's own Year toggle + Location
// dropdown. `initialData: []` avoids a loading flash on first paint while still letting the UI
// show a real Spinner via `isLoading` for the actual network round trip.
export function useHolidaysQuery(year, location) {
  return useQuery({
    queryKey: holidaysQueryKey(year, location),
    queryFn: () => getHolidays({ year, location }),
    enabled: year != null,
    initialData: [],
  });
}

// Every location, for the current + next year — Dashboard's "Upcoming Holidays" widget, which
// isn't scoped to a single location.
export function useAllLocationsHolidaysQuery(years) {
  return useQuery({
    queryKey: ["holidays", "allLocations", years],
    queryFn: async () => {
      const perYear = await Promise.all(years.map(year => getHolidays({ year })));
      return perYear.flat();
    },
    initialData: [],
  });
}

export function useHolidaysMutations() {
  const queryClient = useQueryClient();

  const bulkUpload = useMutation({
    mutationFn: (file) => bulkUploadHolidays(file),
    onSuccess: (data) => {
      const count = data?.rowsAffected ?? data?.rowsSubmitted;
      toast.success(count != null ? `Imported ${count} holiday(s) — calendar refreshed` : "Holiday calendar updated");
      queryClient.invalidateQueries({ queryKey: HOLIDAYS_QUERY_KEY });
    },
    // No onError toast here — TanStack Query's global MutationCache (queryClient.js) already
    // funnels any mutation failure through the central error handler.
  });

  return { bulkUpload };
}
