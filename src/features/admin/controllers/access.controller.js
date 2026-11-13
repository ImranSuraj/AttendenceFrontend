import { api } from "@/shared/api/apiClient";

// AccessController (api/access): role permissions, roles, user roles and menu items.
// (The signed-in user's own menu, GET api/access/menu, is read in shared/access.)
const data = (res) => res?.data?.data;
const body = (res) => res.data;

export const getPermissions = () => api.get("/access/permissions").then(data);
export const setPermission = (change) => api.put("/access/permissions", change).then(body);

export const getRoles = () => api.get("/access/roles").then(data);
export const createRole = (role) => api.post("/access/roles", role).then(body);
export const updateRole = (id, role) => api.put(`/access/roles/${id}`, role).then(body);
export const deleteRole = (id) => api.delete(`/access/roles/${id}`).then(body);

export const getUserRoles = (params) => api.get("/access/user-roles", { params }).then(data);
export const addUserRole = (userRole) => api.post("/access/user-roles", userRole).then(body);
export const removeUserRole = (id) => api.delete(`/access/user-roles/${id}`).then(body);

export const getNavItems = () => api.get("/access/nav-items").then(data);
export const createNavItem = (item) => api.post("/access/nav-items", item).then(body);
export const updateNavItem = (id, item) => api.put(`/access/nav-items/${id}`, item).then(body);
export const deleteNavItem = (id) => api.delete(`/access/nav-items/${id}`).then(body);