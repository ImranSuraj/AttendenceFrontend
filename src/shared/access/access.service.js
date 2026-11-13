import { api } from "../api/apiClient";

// The menu and permission keys the signed-in user may use (GET /api/access/menu).
export async function getMyMenu() {
  const res = await api.get("/access/menu");
  return res.data?.data ?? [];
}