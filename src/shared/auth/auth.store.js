import { create } from "zustand";

// The signed-in session: the token the backend issued (sent as "Authorization: Bearer ..." on every call), who it is for, and how they
// signed in ("teams" = Microsoft Teams SSO, "password" = Employee No and password). Kept in this browser so a refresh does not sign the
// user out; it ends when the token expires or they sign out. Which ROLE the user has is never stored here -- the server looks it up.
const KEY = "ams-auth-session";

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s?.token && s.expiresAtUtc && new Date(s.expiresAtUtc).getTime() > Date.now()) return s;
  } catch { /* storage unavailable or corrupt: signed out */ }
  return null;
}

function save(session) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable: the session lasts until the tab closes */ }
}

const initial = load();

export const useAuthStore = create((set) => ({
  token: initial?.token ?? null,
  empNo: initial?.empNo ?? null,
  name: initial?.name ?? null,
  method: initial?.method ?? null,
  expiresAtUtc: initial?.expiresAtUtc ?? null,

  signIn: (session) => { save(session); set({ token: session.token, empNo: session.empNo, name: session.name ?? null, method: session.method ?? null, expiresAtUtc: session.expiresAtUtc }); },
  signOut: () => { save(null); set({ token: null, empNo: null, name: null, method: null, expiresAtUtc: null }); },
}));

/** The signed-in employee number (non-reactive; for plain functions such as the API client). */
export const getToken = () => useAuthStore.getState().token;
export const getEmpNo = () => useAuthStore.getState().empNo;