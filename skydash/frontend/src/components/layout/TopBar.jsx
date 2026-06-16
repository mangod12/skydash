import { useEffect, useState } from 'react';
import { Search, Bell, Command, Info } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import useNotificationStore from '../../stores/notificationStore';
import WorkspaceSwitcher from './WorkspaceSwitcher';

function UtcClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toISOString().slice(11, 19) + 'Z');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-xs text-zinc-500 tabular-nums">{time}</span>
  );
}

export default function TopBar({ onInfoOpen, onNotificationToggle }) {
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const _alerts = useTelemetryStore((s) => s.alerts);
  const activeView = useUIStore((s) => s.activeView);
  const isMobile = useUIStore((s) => s.isMobile);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-white/[0.06] bg-[var(--surface-0)] shrink-0 z-20">
      {/* Left: Breadcrumb + Workspace */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 font-medium">SKYDASH</span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-300 font-semibold uppercase tracking-wider text-xs">
            {activeView}
          </span>
        </div>
        {!isMobile && <WorkspaceSwitcher />}
      </div>

      {/* Center: Command palette trigger (hidden on mobile) */}
      {!isMobile && (
        <button
          data-tour="command-palette"
          onClick={toggleCommandPalette}
          aria-label="Open command palette"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors group"
        >
          <Search size={14} className="text-zinc-500" />
          <span className="text-zinc-500 text-xs">Search...</span>
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.08]">
            <Command size={10} />K
          </kbd>
        </button>
      )}

      {/* Right: Info + Notifications + Clock */}
      <div className="flex items-center gap-3">
        {isMobile && (
          <button
            data-tour="command-palette"
            onClick={toggleCommandPalette}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Open command palette"
          >
            <Search size={18} strokeWidth={1.5} />
          </button>
        )}
        <button
          onClick={onInfoOpen}
          className="text-zinc-600 hover:text-indigo-400 transition-colors"
          title="Platform Guide"
          aria-label="Open platform guide"
        >
          <Info size={17} strokeWidth={1.5} />
        </button>
        <button
          data-tour="notifications"
          onClick={onNotificationToggle}
          className="relative text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell size={18} strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
        <UtcClock />
      </div>
    </header>
  );
}
