import * as controller from "../controllers/access.controller";

// Access management (IT Admin only: the server refuses anyone else).

// Role-permission screen: roles, items and every checkbox value.
export async function getRolePermissions() {
  return (await controller.getPermissions()) ?? { roles: [], navItems: [], grants: [] };
}

// One checkbox: sets whether a role may use an item.
export function setRolePermission({ roleId, navItemId, isVisible }) {
  return controller.setPermission({ roleId, navItemId, isVisible });
}

// A body with an id is changed, one without is added.
const save = (create, update) => (body) => (body.id ? update(body.id, body) : create(body));

export async function listRoles() {
  return (await controller.getRoles()) ?? [];
}
export const saveRole = save(controller.createRole, controller.updateRole);             // { id (null = new), roleName }
export const deleteRole = (id) => controller.deleteRole(id);

export async function listUserRoles(search) {
  return (await controller.getUserRoles({ search: search || undefined })) ?? [];
}
export const addUserRole = (body) => controller.addUserRole(body);                      // { userId, roleId }
export const removeUserRole = (id) => controller.removeUserRole(id);

export async function listNavItems() {
  return (await controller.getNavItems()) ?? [];
}
export const saveNavItem = save(controller.createNavItem, controller.updateNavItem);    // { id (null = new), navItem, endpoint, showInMenu, isActive }
export const deleteNavItem = (id) => controller.deleteNavItem(id);