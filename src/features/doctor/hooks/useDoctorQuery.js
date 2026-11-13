import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBookingContext, getAvailableSlots, getMyAppointments, bookAppointment, cancelAppointment,
  exportAppointmentReport, markAttended, getAppointmentReport,
} from "../services/doctorAppointments.service";

// Real backend-backed data layer, replacing the old mock APPOINTMENTS array. `initialData` is an
// empty/placeholder shell (not mock data), matching the useHolidaysQuery.js/
// useTaxDeclarationQuery.js convention for migrated features — avoids a loading flash while still
// letting `isLoading` drive a real Spinner (see DoctorPage.jsx).
export const DOCTOR_BOOKING_CONTEXT_QUERY_KEY = ["doctor", "bookingContext"];
export const DOCTOR_APPOINTMENTS_QUERY_KEY = ["doctor", "appointments"];
export const doctorAvailableSlotsQueryKey = (date) => ["doctor", "availableSlots", date];

const EMPTY_BOOKING_CONTEXT = {
  employeeNo: "", employeeName: "", age: "", gender: "", department: "",
  clinicDates: [], slots: [],
};

// Real age/gender/department (empmast) + upcoming clinic dates + the slot template — replaces the
// old client-side upcomingClinicDates()/TIME_SLOTS/deriveAge()/deriveGender() from doctor.mock.js.
export function useDoctorBookingContextQuery() {
  return useQuery({
    queryKey: DOCTOR_BOOKING_CONTEXT_QUERY_KEY,
    queryFn: getBookingContext,
    initialData: EMPTY_BOOKING_CONTEXT,
  });
}

// Per-date availability (excludes slots already booked by ANY employee) — only enabled once a
// Booking Date is actually chosen.
export function useAvailableSlotsQuery(date) {
  return useQuery({
    queryKey: doctorAvailableSlotsQueryKey(date),
    queryFn: () => getAvailableSlots(date),
    enabled: !!date,
    initialData: [],
  });
}

export function useDoctorQuery() {
  return useQuery({
    queryKey: DOCTOR_APPOINTMENTS_QUERY_KEY,
    queryFn: getMyAppointments,
    initialData: [],
  });
}

// HRAdmin's table: every employee's appointments in a wide window around today (the report
// endpoint is the only one that returns other employees' rows). Same query key as the personal
// list so every mutation's invalidation refreshes whichever is shown.
export function useDoctorQuery_AllForAdmin(enabled, fromDate, toDate) {
  return useQuery({
    queryKey: [...DOCTOR_APPOINTMENTS_QUERY_KEY, "all", fromDate, toDate],
    queryFn: () => getAppointmentReport({ fromDate, toDate, attendedStatus: "All" }),
    enabled,
    initialData: [],
  });
}

export function useDoctorMutations() {
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (payload) => bookAppointment(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: DOCTOR_APPOINTMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: doctorAvailableSlotsQueryKey(variables.date) });
    },
    // No onError toast here — TanStack Query's global MutationCache (queryClient.js) already
    // funnels any mutation failure through the central error handler.
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id }) => cancelAppointment(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: DOCTOR_APPOINTMENTS_QUERY_KEY });
      if (variables.date) queryClient.invalidateQueries({ queryKey: doctorAvailableSlotsQueryKey(variables.date) });
    },
  });

  const attendedMutation = useMutation({
    mutationFn: ({ id }) => markAttended(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCTOR_APPOINTMENTS_QUERY_KEY }),
  });

  return {
    markAttended: (appt, options) => attendedMutation.mutate({ id: appt.id }, options),
    isMarkingAttended: attendedMutation.isPending,
    add: addMutation.mutate,
    isAdding: addMutation.isPending,
    // Takes the full appointment row (not just an id) so the matching available-slots query for
    // that appointment's own date can be invalidated too, freeing the slot back up immediately.
    cancel: (appt, options) => cancelMutation.mutate({ id: appt.id, date: appt.date }, options),
    isCancelling: cancelMutation.isPending,
  };
}

// HRAdmin sees every employee's rows, a plain employee sees only their own — the report endpoint
// itself is RBAC-scoped server-side (see doctor.service.js), so this is the one call for both.
export function useDoctorReportExport() {
  const exportMutation = useMutation({
    mutationFn: (filters) => exportAppointmentReport(filters),
  });
  return { exportReport: exportMutation.mutate, isExporting: exportMutation.isPending };
}
