import { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';

export function useKeyboard({ onHelp } = {}) {
  const { toggleCommandPalette, setActiveView, toggleSidebar } = useUIStore();

  useEffect(() => {
    const handler = (e) => {
      // Cmd+K or Ctrl+K — Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // Don't capture shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'm': setActiveView('map'); break;
        case 't': setActiveView('telemetry'); break;
        case 'i': setActiveView('intel'); break;
        case 'd': setActiveView('dashboard'); break;
        case 'b': toggleSidebar(); break;
        case '?': onHelp?.(); break;
        case 'Escape':
          useUIStore.getState().commandPaletteOpen && toggleCommandPalette();
          break;
        default: break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleCommandPalette, setActiveView, toggleSidebar, onHelp]);
}
