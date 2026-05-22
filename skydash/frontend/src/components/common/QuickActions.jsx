import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Plus, Target, Camera, Maximize, Minimize,
  FileDown, Terminal, MapPin, Search, X,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useMapStore } from '../../stores/mapStore';
import useNotificationStore from '../../stores/notificationStore';
import QuickActionButton from './QuickActionButton';

const ACTIONS = [
  { id: 'create-entity', label: 'Create Entity', icon: Plus, color: 'text-violet-400' },
  { id: 'new-mission', label: 'New Mission', icon: Target, color: 'text-indigo-400' },
  { id: 'screenshot', label: 'Take Screenshot', icon: Camera, color: 'text-cyan-400' },
  { id: 'fullscreen', label: 'Toggle Fullscreen', icon: Maximize, color: 'text-zinc-300' },
  { id: 'export', label: 'Export Report', icon: FileDown, color: 'text-emerald-400' },
  { id: 'console', label: 'Open Console', icon: Terminal, color: 'text-amber-400' },
  { id: 'drop-pin', label: 'Drop Pin', icon: MapPin, color: 'text-red-400' },
  { id: 'search', label: 'Quick Search', icon: Search, color: 'text-cyan-300' },
];

const ARC_START = -Math.PI / 2;
const ARC_END = -Math.PI;
const RADIUS = 140;

function getPosition(index, total) {
  const angle = ARC_START + ((ARC_END - ARC_START) * index) / (total - 1);
  return {
    x: Math.cos(angle) * RADIUS,
    y: Math.sin(angle) * RADIUS,
  };
}

function captureScreenshot() {
  const canvas = document.querySelector('canvas');
  if (canvas) {
    const link = document.createElement('a');
    link.download = `skydash-screenshot-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    return;
  }
  /* No canvas found — use SVG-based map or notify user */
  const svg = document.querySelector('.leaflet-container svg');
  if (svg) {
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = `skydash-screenshot-${Date.now()}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

export default function QuickActions() {
  const [open, setOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const containerRef = useRef(null);
  const isMobile = useUIStore((s) => s.isMobile);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        close();
      }
    };
    if (open) {
      requestAnimationFrame(() => document.addEventListener('mousedown', onClickOutside));
    }
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open, close]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const handleAction = useCallback((id) => {
    setOpen(false);
    switch (id) {
      case 'create-entity':
        useUIStore.getState().setEntityCreateOpen(true);
        useUIStore.getState().setActiveView('intel');
        break;
      case 'new-mission':
        useUIStore.getState().setActiveView('missions');
        break;
      case 'screenshot':
        captureScreenshot();
        break;
      case 'fullscreen':
        toggleFullscreen();
        break;
      case 'export':
        useUIStore.getState().setActiveView('intel');
        break;
      case 'console':
        useUIStore.getState().toggleConsole();
        break;
      case 'drop-pin':
        useUIStore.getState().setActiveView('map');
        useMapStore.getState().setAnnotationMode('pin');
        break;
      case 'search':
        useUIStore.getState().toggleCommandPalette();
        break;
      default:
        break;
    }
  }, []);

  if (isMobile) return null;

  const hasNotifications = unreadCount > 0;

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-40">
      <AnimatePresence>
        {open && ACTIONS.map((action, i) => {
          const pos = getPosition(i, ACTIONS.length);
          const Icon = action.id === 'fullscreen' && isFullscreen ? Minimize : action.icon;
          return (
            <QuickActionButton
              key={action.id}
              action={action}
              Icon={Icon}
              x={pos.x}
              y={pos.y}
              index={i}
              hovered={hoveredId === action.id}
              onHover={setHoveredId}
              onClick={handleAction}
            />
          );
        })}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="relative w-14 h-14 rounded-full flex items-center justify-center border border-white/[0.12] backdrop-blur-xl bg-[rgba(9,9,11,0.7)] shadow-lg shadow-indigo-500/10 hover:bg-[rgba(9,9,11,0.85)] transition-colors"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Quick actions"
      >
        <motion.div
          animate={{ rotate: open ? 135 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {open ? <X size={20} className="text-zinc-300" /> : <Zap size={20} className="text-indigo-400" />}
        </motion.div>

        {hasNotifications && !open && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border border-zinc-950 animate-pulse" />
        )}
      </motion.button>
    </div>
  );
}

