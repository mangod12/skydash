import { create } from 'zustand';

export const useUIStore = create((set) => ({
  sidebarOpen: false,
  activeView: 'dashboard',
  commandPaletteOpen: false,
  theme: 'midnight',

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveView: (view) => set({ activeView: view }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setTheme: (theme) => set({ theme }),
}));
