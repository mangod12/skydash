import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
  sidebarOpen: false,
  activeView: 'dashboard',
  commandPaletteOpen: false,
  notificationOpen: false,
  theme: 'midnight',
  isMobile: false,
  isTablet: false,
  entityCreateOpen: false,
  missionCreateOpen: false,
  workspace: 'operator',
  consoleOpen: false,

  setWorkspace: (ws) => set({
    workspace: ws,
    sidebarOpen: ws !== 'operator',
    activeView: ws === 'analyst' ? 'intel' : 'dashboard',
    notificationOpen: ws === 'commander',
  }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveView: (view) => set({ activeView: view }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  toggleNotifications: () => set((s) => ({ notificationOpen: !s.notificationOpen })),
  setNotificationOpen: (open) => set({ notificationOpen: open }),
  setEntityCreateOpen: (open) => set({ entityCreateOpen: open }),
  setMissionCreateOpen: (open) => set({ missionCreateOpen: open }),
  toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
  setConsoleOpen: (open) => set({ consoleOpen: open }),
  setTheme: (theme) => set({ theme }),
  setResponsive: (width) => set({
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    sidebarOpen: width >= 1024 ? get().sidebarOpen : false,
  }),
}));
