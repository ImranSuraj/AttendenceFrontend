import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEmployeeSettings, updateEmployeeSettings } from "../services/employeeSettings.service";
import { useAccessStore, hasAccessKey } from "@/shared/access/access.store";

export const EMPLOYEE_SETTINGS_QUERY_KEY = ["employeeSettings"];

// Same defaults the backend's own EmployeeSettingsService.Defaults/table column defaults use --
// so a not-yet-loaded query and an employee who has never saved a preference render identically.
const DEFAULT_SETTINGS = { darkMode: false, leaveApprovalAlerts: true, ticketStatusUpdates: true, visitorAlertSound: true };

export function useEmployeeSettingsQuery() {
  // Only once the menu is known and the user may use Settings -- a Visitor has no preferences (and no access to them).
  const enabled = useAccessStore(s => s.loaded && hasAccessKey(s.items, "settings"));
  return useQuery({
    enabled,
    queryKey: EMPLOYEE_SETTINGS_QUERY_KEY,
    queryFn: getEmployeeSettings,
    initialData: DEFAULT_SETTINGS,
  });
}

export function useEmployeeSettingsMutations() {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: updateEmployeeSettings,
    // Optimistic update -- a toggle should flip instantly, not wait on a round trip.
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: EMPLOYEE_SETTINGS_QUERY_KEY });
      const previous = queryClient.getQueryData(EMPLOYEE_SETTINGS_QUERY_KEY);
      queryClient.setQueryData(EMPLOYEE_SETTINGS_QUERY_KEY, (old) => ({ ...old, ...next }));
      return { previous };
    },
    onError: (_err, _next, context) => {
      if (context?.previous) queryClient.setQueryData(EMPLOYEE_SETTINGS_QUERY_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: EMPLOYEE_SETTINGS_QUERY_KEY }),
  });

  return { update };
}
