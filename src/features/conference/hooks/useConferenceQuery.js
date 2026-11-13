import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBookingContext, getRoomsForLocation, getLocationDayBookings,
  getBookingById, addBooking, updateBookingSlot, cancelBookingSlot, resendInvitation,
  inviteSingleParticipant, getMyBookings, getLocationBookings,
} from "../services/conferenceRooms.service";

// Real backend-backed data layer, replacing the old always-available mock BOOKINGS array.
// `initialData` is an empty/placeholder shell (not mock data), matching the useHolidaysQuery.js/
// useDoctorQuery.js convention for migrated features — avoids a loading flash while still letting
// `isLoading` drive a real Spinner (see ConferencePage.jsx).
export const CONFERENCE_CONTEXT_QUERY_KEY = ["conference", "context"];
export const conferenceRoomsQueryKey = (locationCode) => ["conference", "rooms", locationCode];
export const conferenceLocationDayQueryKey = (locationCode, date) => ["conference", "locationDay", locationCode, date];

const EMPTY_CONTEXT = { locations: [] };

// Real plant_mast-backed location list.
export function useConferenceContextQuery() {
  return useQuery({
    queryKey: CONFERENCE_CONTEXT_QUERY_KEY,
    queryFn: getBookingContext,
    initialData: EMPTY_CONTEXT,
  });
}

// Real confroom_master-backed room list for one location — used both to populate the Room
// dropdown (Table view's scoping, and a quick-filter) AND as the Calendar view's room columns.
export function useConferenceRoomsQuery(locationCode) {
  return useQuery({
    queryKey: conferenceRoomsQueryKey(locationCode),
    queryFn: () => getRoomsForLocation(locationCode),
    enabled: !!locationCode,
    initialData: [],
  });
}

// Calendar view — scoped to Location + single Date ONLY (no Room requirement): every room's
// bookings at that location for that one date, so the grid can pivot rooms into columns.
export function useConferenceLocationDayQuery(locationCode, date) {
  return useQuery({
    queryKey: conferenceLocationDayQueryKey(locationCode, date),
    queryFn: () => getLocationDayBookings(locationCode, date),
    enabled: !!locationCode && !!date,
    initialData: [],
  });
}

// One-off imperative fetch used right before the edit/cancel modal opens, to refresh the
// canonical currently-stored full booking range (for the "Entire booking" scope option) from the
// server rather than trusting a possibly-stale list-query cache entry. Modeled as a mutation
// (rather than a plain direct service call from the component) so any failure still funnels
// through the shared MutationCache's central error handler like every other network call in this
// app — the component treats it as best-effort and falls back to the list-cached booking on error.
export function useConferenceBookingDetailFetch() {
  const mutation = useMutation({ mutationFn: (bookingId) => getBookingById(bookingId) });
  return { fetchBookingDetail: mutation.mutateAsync };
}

export function useConferenceMutations() {
  const queryClient = useQueryClient();

  // A booking mutation can touch two dates (its original date pre-edit and its new date
  // post-reschedule) and always touches both the location-day query (Calendar) and the
  // room-day query (Table) for whichever date(s)/room(s) it involves. Rather than track every
  // combination precisely, invalidate every "conference" list query broadly — cheap here since
  // this feature has no long-lived unrelated "conference"-prefixed queries, and matches this
  // app's general "let onSettled invalidate, don't hand-track every affected key" convention.
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["conference", "locationDay"] });
    // The calendar (Day / Week / Month) and the My / All Bookings tabs read these.
    queryClient.invalidateQueries({ queryKey: ["conference", "locationBookings"] });
    queryClient.invalidateQueries({ queryKey: ["conference", "myBookings"] });
  };

  const addMutation = useMutation({
    mutationFn: (payload) => addBooking(payload),
    onSettled: invalidateAll,
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => updateBookingSlot(payload),
    onSettled: invalidateAll,
  });

  const cancelMutation = useMutation({
    mutationFn: (payload) => cancelBookingSlot(payload),
    onSettled: invalidateAll,
  });

  const inviteMutation = useMutation({
    mutationFn: (booking) => resendInvitation(booking),
  });

  // Separate from inviteMutation above — targets exactly one participant instead of replaying
  // update-slot's "notify everyone" side effect.
  const inviteOneMutation = useMutation({
    mutationFn: ({ bookingId, participantEmpId }) => inviteSingleParticipant(bookingId, participantEmpId),
  });

  return {
    add: addMutation.mutate,
    isAdding: addMutation.isPending,
    update: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    cancel: cancelMutation.mutate,
    isCancelling: cancelMutation.isPending,
    invite: inviteMutation.mutate,
    isInviting: inviteMutation.isPending,
    inviteOne: inviteOneMutation.mutate,
    invitingOneId: inviteOneMutation.isPending ? inviteOneMutation.variables?.participantEmpId : null,
  };
}

// ================================================================================================
// New-tab data layer (My Bookings) — see the "ASSUMED NEW-CAPABILITY CONTRACTS"
// block in conference.service.js for the exact wire shape each of these assumes.
// ================================================================================================

export const CONFERENCE_MY_BOOKINGS_QUERY_KEY = ["conference", "myBookings"];

// A meeting made in Teams / Outlook reaches the app through a webhook a few seconds later, so the booking lists look again on their own (only while the page is open and visible).
const LIVE_REFRESH_MS = 15_000;

// My Bookings tab — every booking made by the current user, across every location.
export function useConferenceMyBookingsQuery(from, to) {
  return useQuery({
    queryKey: [...CONFERENCE_MY_BOOKINGS_QUERY_KEY, from, to],
    queryFn: () => getMyBookings({ from, to }),
    refetchInterval: LIVE_REFRESH_MS,
    initialData: [],
  });
}

// All Bookings tab -- every booking at one location over a date range (inclusive, yyyy-MM-dd).
export function useConferenceLocationBookingsQuery(location, from, to) {
  return useQuery({
    queryKey: ["conference", "locationBookings", location, from, to],
    queryFn: () => getLocationBookings({ location, from, to }),
    enabled: !!location,
    refetchInterval: LIVE_REFRESH_MS,
    initialData: [],
  });
}
