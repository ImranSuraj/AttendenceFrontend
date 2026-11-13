import { create } from "zustand";
import { getNotificationCounts, markNotificationsRead } from "../services/notifications.service";

// Notifications are not listed anywhere: each page that has something for the user shows a count on its sidebar link. `counts` is keyed by
// module: { unread, scope, requestNo } (scope / requestNo = where the newest item wants the user to land). The server works the numbers out
// (work waiting for the user + things that happened to them, see spv1_ManageNotifications), so the store only asks: once after sign-in, on every
// live SignalR push, whenever a page is opened, and every minute. Opening a page marks what happened there as read.
export const useNotificationStore = create((set, get) => ({
  counts: {},
  activeModule: null,

  loadCounts: async () => {
    try {
      const rows = await getNotificationCounts();
      set({ counts: Object.fromEntries(rows.map(r => [r.module, { unread: r.unread, scope: r.scope ?? null, requestNo: r.requestNo ?? null }])) });
    } catch { /* the counts simply stay as they were */ }
  },

  // The page the user is on: its notifications are read as soon as it opens, and again as new ones arrive while it is open.
  setActiveModule: async (module) => {
    set({ activeModule: module });
    await get().markModuleRead(module);
  },

  markModuleRead: async (module) => {
    if (!get().counts[module]?.unread) return;
    try { await markNotificationsRead(module); } catch { /* ignore */ }
    await get().loadCounts();
  },

  _addNotification: async (n) => {
    if (n.module && n.module === get().activeModule) {
      try { await markNotificationsRead(n.module); } catch { /* ignore */ }
    }
    await get().loadCounts();
  },

  reset: () => set({ counts: {}, activeModule: null }),
}));
