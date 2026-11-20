import { create } from 'zustand';

const workspaceState = ws => ({ workspace: ws, recordedReviewOpen: false, sidebarOpen: ws !== 'operator', activeView: ws === 'analyst' ? 'intel' : 'dashboard', notificationOpen: ws === 'commander' });

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
  recordedReviewOpen: false,

  recordedSourceOpen: false,
  pendingRecordedExit: null,
  setWorkspace: (ws) => {
    if (get().recordedSourceOpen && ws === get().workspace) return;
    if (get().recordedSourceOpen) { set({ pendingRecordedExit: { kind: 'workspace', value: ws } }); return; }
    set(workspaceState(ws));
  },
  setRecordedSourceOpen: (open) => set({ recordedSourceOpen: open, ...(!open ? { pendingRecordedExit: null } : {}) }),
  requestRecordedBack: () => set({ pendingRecordedExit: { kind: 'back' } }),
  cancelRecordedExit: () => set({ pendingRecordedExit: null }),
  confirmRecordedExit: () => {
    const pending = get().pendingRecordedExit;
    if (!pending) return null;
    set({ pendingRecordedExit: null, recordedSourceOpen: false, recordedReviewOpen: false,
      ...(pending.kind === 'view' ? { activeView: pending.value } : pending.kind === 'workspace' ? workspaceState(pending.value) : {}) });
    return pending.kind;
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveView: (view) => {
    if (get().recordedSourceOpen && view === get().activeView) return;
    if (get().recordedSourceOpen) { set({ pendingRecordedExit: { kind: 'view', value: view } }); return; }
    set({ activeView: view, recordedReviewOpen: false });
  },
  setRecordedReviewOpen: (open) => set({ recordedReviewOpen: open }),
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
