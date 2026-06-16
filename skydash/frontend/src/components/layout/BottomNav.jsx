import { clsx } from 'clsx';
import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Clock,
  Crosshair,
  Map,
  MoreHorizontal,
  Radio,
  Brain,
  Settings,
  Target,
  Users,
  Radar,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

const BOTTOM_NAV_ITEMS = [
  { id: 'dashboard', icon: Crosshair, label: 'Dash', fullLabel: 'Dashboard' },
  { id: 'scenario', icon: Radar, label: 'Lab', fullLabel: 'Scenario Lab' },
  { id: 'map', icon: Map, label: 'Map', fullLabel: 'Map' },
  { id: 'telemetry', icon: Radio, label: 'Tele', fullLabel: 'Telemetry' },
  { id: 'intel', icon: Brain, label: 'Intel', fullLabel: 'Intel' },
];

const MORE_ITEMS = [
  { id: 'missions', icon: Target, label: 'Missions' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
  { id: 'entities', icon: Users, label: 'Intel Entities' },
  { id: 'timeline', icon: Clock, label: 'Intel Timeline' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

const MORE_VIEW_IDS = new Set(MORE_ITEMS.map((item) => item.id));

function BottomNavButton({ item, active, onClick }) {
  const setActiveView = useUIStore((s) => s.setActiveView);

  return (
    <button
      data-tour={item.id === 'more' ? undefined : item.id}
      onClick={() => {
        if (onClick) onClick();
        else setActiveView(item.id);
      }}
      aria-label={item.fullLabel || item.label}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5 min-h-14',
        'transition-all duration-200',
        active
          ? 'text-indigo-400'
          : 'text-zinc-500 active:text-zinc-300',
      )}
    >
      <item.icon
        size={20}
        strokeWidth={1.5}
        className={clsx(
          'transition-all duration-200',
          active && 'drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]',
        )}
      />
      <span className={clsx(
        'text-[10px] font-medium uppercase tracking-wider',
        active ? 'text-indigo-400' : 'text-zinc-600',
      )}>
        {item.label}
      </span>
    </button>
  );
}

export default function BottomNav() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onPointerDown = (event) => {
      if (moreRef.current && !moreRef.current.contains(event.target)) {
        setMoreOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const handleMoreSelect = (view) => {
    setActiveView(view);
    setMoreOpen(false);
  };

  return (
    <div ref={moreRef} className="fixed bottom-0 left-0 right-0 z-50">
      {moreOpen && (
        <div className="absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.5rem)] right-3 left-3 rounded-xl border border-white/[0.08] bg-zinc-950/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="grid grid-cols-2 gap-1 p-2">
            {MORE_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleMoreSelect(item.id)}
                aria-current={activeView === item.id ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-2 rounded-lg px-3 py-3 text-left transition-colors',
                  activeView === item.id
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200',
                )}
              >
                <item.icon size={16} strokeWidth={1.5} />
                <span className="text-[11px] font-semibold tracking-wider uppercase">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <nav
        aria-label="Primary mobile navigation"
        className={clsx(
          'flex items-start',
          'min-h-14 border-t border-white/[0.06]',
          'bg-zinc-950/85 backdrop-blur-xl',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {BOTTOM_NAV_ITEMS.map((item) => (
          <BottomNavButton
            key={item.id}
            item={item}
            active={activeView === item.id}
          />
        ))}
        <BottomNavButton
          item={{ id: 'more', icon: MoreHorizontal, label: 'More', fullLabel: 'More navigation' }}
          active={moreOpen || MORE_VIEW_IDS.has(activeView)}
          onClick={() => setMoreOpen((value) => !value)}
        />
      </nav>
    </div>
  );
}
