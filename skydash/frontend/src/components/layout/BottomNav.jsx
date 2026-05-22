import { clsx } from 'clsx';
import { Crosshair, Map, Radio, Brain, Target } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

const BOTTOM_NAV_ITEMS = [
  { id: 'dashboard', icon: Crosshair, label: 'Dash' },
  { id: 'map', icon: Map, label: 'Map' },
  { id: 'telemetry', icon: Radio, label: 'Tele' },
  { id: 'intel', icon: Brain, label: 'Intel' },
  { id: 'missions', icon: Target, label: 'Miss' },
];

function BottomNavButton({ item, active }) {
  const setActiveView = useUIStore((s) => s.setActiveView);

  return (
    <button
      onClick={() => setActiveView(item.id)}
      className={clsx(
        'flex flex-col items-center justify-center flex-1 gap-0.5 py-1.5',
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

  return (
    <nav
      className={clsx(
        'fixed bottom-0 left-0 right-0 z-50',
        'flex items-center',
        'h-14 border-t border-white/[0.06]',
        'bg-zinc-950/80 backdrop-blur-xl',
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
    </nav>
  );
}
