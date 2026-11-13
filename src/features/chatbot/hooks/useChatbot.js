import { create } from "zustand";

// Plain zustand store, same convention as role.store.js/notificationHub.js -- message history is
// ephemeral (not persisted), matching CHATBOT_IMPLEMENTATION_PLAN.md §11/§12: a page refresh
// clears the conversation for v1, no backend conversation-log table required to function.
export const useChatbotStore = create((set) => ({
  isOpen: false,
  messages: [], // { id, role: "user"|"bot", text, responseType?, navigationTarget?, clarificationOptions?, data? }
  isSending: false,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  addMessage: (message) =>
    set((s) => ({ messages: [...s.messages, { id: crypto.randomUUID(), ...message }] })),

  setSending: (isSending) => set({ isSending }),

  clear: () => set({ messages: [] }),
}));
