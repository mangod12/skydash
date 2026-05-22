import { create } from 'zustand';

export const useUIStore = create((set) => ({
  sidebarOpen: false,
  activeView: 'dashboard',
  commandPaletteOpen: false,
  notificationOpen: false,
  theme: 'midnight',

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveView: (view) => set({ activeView: view }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  toggleNotifications: () => set((s) => ({ notificationOpen: !s.notificationOpen })),
  setNotificationOpen: (open) => set({ notificationOpen: open }),
  setTheme: (theme) => set({ theme }),
}));
