import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Map, Radio, Brain, Users, Clock, Settings,
  ChevronLeft, ChevronRight, Crosshair, BarChart3, Target,
  Radar,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

const NAV_ITEMS = [
  { id: 'dashboard', icon: Crosshair, label: 'Dashboard' },
  { id: 'scenario', icon: Radar, label: 'Scenario Lab' },
  { id: 'map', icon: Map, label: 'Map' },
  { id: 'telemetry', icon: Radio, label: 'Telemetry' },
  { id: 'intel', icon: Brain, label: 'Intel' },
  { id: 'missions', icon: Target, label: 'Missions' },
  { id: 'entities', icon: Users, label: 'Entities' },
  { id: 'timeline', icon: Clock, label: 'Timeline' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
];

function NavButton({ item, active, expanded }) {
  const setActiveView = useUIStore((s) => s.setActiveView);

  return (
    <button
      data-tour={item.id}
      onClick={() => setActiveView(item.id)}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      title={expanded ? undefined : item.label}
      className={clsx(
        'group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl',
        'transition-all duration-200',
        active
          ? 'bg-indigo-500/15 text-indigo-400'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]',
      )}
    >
      <item.icon size={20} strokeWidth={1.5} className={clsx(
        'shrink-0 transition-colors',
        active && 'drop-shadow-[0_0_6px_rgba(99,102,241,0.5)]',
      )} />
      {expanded && (
        <span className="text-sm font-medium truncate">{item.label}</span>
      )}
      {!expanded && (
        <div className="absolute left-full ml-3 px-2.5 py-1 rounded-md bg-zinc-800 text-xs text-zinc-200 font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-white/[0.08]">
          {item.label}
        </div>
      )}
    </button>
  );
}

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, activeView, isTablet } = useUIStore();
  const expanded = isTablet ? false : sidebarOpen;
  const width = isTablet ? 60 : (sidebarOpen ? 200 : 60);

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1, width }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="h-full flex flex-col border-r border-white/[0.06] bg-[var(--surface-0)] relative z-30"
    >
      {/* Logo */}
      <div className="h-12 flex items-center justify-center border-b border-white/[0.06] shrink-0">
        <span className={clsx(
          'font-bold tracking-wider text-indigo-400',
          expanded ? 'text-sm' : 'text-xs',
        )}>
          {expanded ? 'SKYDASH' : 'SD'}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={activeView === item.id}
            expanded={expanded}
          />
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-white/[0.06] space-y-1">
        <NavButton
          item={{ id: 'settings', icon: Settings, label: 'Settings' }}
          active={activeView === 'settings'}
          expanded={expanded}
        />
        {!isTablet && (
          <button
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="flex items-center justify-center w-full py-2 text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </div>
    </motion.aside>
  );
}
