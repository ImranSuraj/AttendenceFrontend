import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getRolePermissions, listNavItems, listRoles, listUserRoles, setRolePermission } from "../services/access.service";

export const ROLE_PERMISSIONS_KEY = ["rolePermissions"];
export const ROLES_KEY = ["access", "roles"];
export const USER_ROLES_KEY = ["access", "userRoles"];
export const NAV_ITEMS_KEY = ["access", "navItems"];

// options: extra useQuery options (e.g. { staleTime: 0 } to always refetch).
export function useRolesQuery(options = {}) {
  return useQuery({ queryKey: ROLES_KEY, queryFn: listRoles, ...options });
}

export function useUserRolesQuery(search) {
  return useQuery({ queryKey: [...USER_ROLES_KEY, search], queryFn: () => listUserRoles(search), staleTime: 0 });
}

export function useNavItemsQuery() {
  return useQuery({ queryKey: NAV_ITEMS_KEY, queryFn: listNavItems, staleTime: 0 });
}

export function useRolePermissionsQuery() {
  return useQuery({ queryKey: ROLE_PERMISSIONS_KEY, queryFn: getRolePermissions, staleTime: 0 });
}

// One checkbox: shown at once, rolled back if the server refuses.
export function useSetRolePermission() {
  const queryClient = useQueryClient();
  const QUERY_KEY = ROLE_PERMISSIONS_KEY;
  return useMutation({
    mutationFn: setRolePermission,
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData(QUERY_KEY);
      queryClient.setQueryData(QUERY_KEY, (old) => {
        if (!old) return old;
        const exists = old.grants.some(g => g.roleId === change.roleId && g.navItemId === change.navItemId);
        const grants = exists
          ? old.grants.map(g => (g.roleId === change.roleId && g.navItemId === change.navItemId ? { ...g, isVisible: change.isVisible } : g))
          : [...old.grants, { roleId: change.roleId, navItemId: change.navItemId, isVisible: change.isVisible }];
        return { ...old, grants };
      });
      return { previous };
    },
    onError: (err, _change, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
      toast.error(err?.response?.data?.message ?? "Could not save the change.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}