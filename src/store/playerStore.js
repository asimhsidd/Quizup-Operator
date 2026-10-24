import { create } from 'zustand';

// The player drawer (components/PlayerDrawer.jsx) opens from anywhere: Users, Reports,
// Inbox, Moderation. `version` bumps when a drawer action changes a player, so a list
// showing them can reload.
export const usePlayerStore = create((set) => ({
  playerId: null,
  version: 0,
  openPlayer: (id) => set({ playerId: id }),
  closePlayer: () => set({ playerId: null }),
  changed: () => set(s => ({ version: s.version + 1 })),
}));
