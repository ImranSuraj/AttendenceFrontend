// "Take me to where this needs doing": a sidebar link with a notification count sets an intent (module + optional scope/request
// number), the destination page reads it once its data is ready, acts on it (switches scope, opens the
// request) and clears it.
import { create } from "zustand";

export const useNavIntent = create((set) => ({
  intent: null,
  setIntent: (intent) => set({ intent }),
  clear: () => set({ intent: null }),
}));
