import { create } from "zustand";

// What the signed-in user may use, loaded ONCE after sign-in from the server (POST /api/access/menu):
//   items -- the menu / pages they may open (database-driven, the same logic that protects the APIs: dbo.spv1_ManageAccessControl),
//   roles -- the roles they hold (dbo.UserRoles). The screens show or hide tabs, buttons and icons from the roles; the SERVER still authorizes every
//            endpoint on its own, so hiding something here is presentation, not security.
// Until it has loaded (`loaded` false) the app shows a spinner, so nobody sees a screen built for the wrong user.
export const useAccessStore = create((set) => ({
  items: [],
  roles: [],
  loaded: false,
  setMenu: (items, roles) => set({ items, roles, loaded: true }),
  reset: () => set({ items: [], roles: [], loaded: false }),
}));

export const hasAccessKey = (items, key) => items.some(i => i.endpoint === key);

/** True only when the user was given this role itself -- ITAdmin does NOT count (used for the Excel exports, which are HRAdmin only). */
export function useHasExactRole(role) {
  return useAccessStore(s => s.roles.includes(role));
}

/** True when the user may use the page / permission item with this module key (their roles + what was given to them personally, minus what was taken: dbo.EmployeeAccess). */
export function useHasAccess(key) {
  return useAccessStore(s => hasAccessKey(s.items, key));
}

/** True when the user holds this role. ITAdmin sees everything, so it counts as holding every role. */
export function useHasRole(role) {
  return useAccessStore(s => s.roles.includes(role) || s.roles.includes("ITAdmin"));
}
