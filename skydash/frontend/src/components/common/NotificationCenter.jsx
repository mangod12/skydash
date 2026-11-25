import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { X, Bell, CheckCheck, Crosshair, Check, ArrowUpCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import useNotificationStore from '../../stores/notificationStore';
import { useUIStore } from '../../stores/uiStore';
import { useMapStore } from '../../stores/mapStore';
import VirtualList from './VirtualList';

const TABS = ['attention', 'all', 'alert', 'intel', 'system', 'mission'];

const SEVERITY_DOT = {
  info: 'bg-blue-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-500 animate-pulse',
};

const SEVERITY_BORDER = {
  info: 'border-l-blue-400',
  warning: 'border-l-amber-400',
  critical: 'border-l-red-500',
};

function NotificationItem({ notification, onDismiss, onClose }) {
  const markRead = useNotificationStore((s) => s.markRead);
  const acknowledge = useNotificationStore((s) => s.acknowledge);
  const escalate = useNotificationStore((s) => s.escalate);
  const isAlert = notification.type === 'alert';
  const status = notification.status || 'new';

  const locate = (e) => {
    e.stopPropagation();
    markRead(notification.id);
    const loc = notification.location;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) {
      useMapStore.getState().flyTo([loc.lat, loc.lon], 15);
    }
    useUIStore.getState().setActiveView('map');
    onClose?.();
  };

  const handleClick = () => {
    markRead(notification.id);
    notification.action?.handler?.();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30, height: 0 }}
      className={clsx(
        'group relative px-3 py-2.5 border-l-2 rounded-r-lg cursor-pointer',
        'hover:bg-white/[0.03] transition-colors',
        SEVERITY_BORDER[notification.severity] || 'border-l-zinc-600',
        !notification.read && 'bg-indigo-500/[0.04]',
        notification.read && 'border-l-zinc-700/50',
      )}
      onClick={handleClick}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
        className="absolute top-1.5 right-1.5 min-h-8 min-w-8 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
        aria-label={`Dismiss ${notification.title}`}
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-2.5 pr-5">
        <span className={clsx(
          'mt-1.5 w-2 h-2 rounded-full shrink-0',
          SEVERITY_DOT[notification.severity] || 'bg-zinc-500',
        )} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-zinc-200 truncate">
            {notification.title}
            {notification.sample && (
              <span className="ml-1.5 align-middle text-[8px] font-bold tracking-[0.15em] text-zinc-400 bg-white/[0.06] px-1 py-0.5 rounded"
                title="Demo sample, not a live detection">SAMPLE</span>
            )}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <span className="text-[9px] font-mono text-zinc-600 mt-1 block">
            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
            {isAlert && status !== 'new' && (
              <span className={clsx('ml-2 uppercase', status === 'escalated' ? 'text-red-400' : 'text-emerald-400')}>
                {status}
                {notification.statusBy && notification.statusAt
                  ? ` · ${notification.statusBy} · ${new Date(notification.statusAt).toISOString().slice(11, 16)}Z`
                  : ''}
              </span>
            )}
          </span>
          {isAlert && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {notification.location && (
                <button type="button" onClick={locate} aria-label={`Locate ${notification.title} on map`}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold tracking-wider text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20">
                  <Crosshair size={10} />LOCATE
                </button>
              )}
              {status !== 'acknowledged' && (
                <button type="button" onClick={(e) => { e.stopPropagation(); acknowledge(notification.id); }}
                  aria-label={`Acknowledge ${notification.title}`}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold tracking-wider text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20">
                  <Check size={10} />ACK
                </button>
              )}
              {status === 'new' && (
                <button type="button" onClick={(e) => { e.stopPropagation(); escalate(notification.id); }}
                  aria-label={`Escalate ${notification.title}`}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold tracking-wider text-red-300 bg-red-500/10 hover:bg-red-500/20">
                  <ArrowUpCircle size={10} />ESCALATE
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function NotificationCenter({ isOpen, onClose }) {
  const panelRef = useRef(null);
  const { notifications, markAllRead, dismiss } = useNotificationStore();
  const [activeTab, setActiveTab] = useState('attention');

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    // Delay to avoid the triggering click
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handler);
    }, 50);
    return () => { clearTimeout(timer); window.removeEventListener('mousedown', handler); };
  }, [isOpen, onClose]);

  const needsAttention = (n) => n.type === 'alert' && n.status !== 'acknowledged'
    && (n.severity === 'critical' || n.severity === 'warning' || n.status === 'escalated');
  const attentionCount = notifications.filter(needsAttention).length;
  const filtered = activeTab === 'all'
    ? notifications
    : activeTab === 'attention'
      ? notifications.filter(needsAttention)
      : notifications.filter((n) => n.type === activeTab);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ x: 384, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 384, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="notifications-title"
          className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-96 max-w-full bg-zinc-950/90 backdrop-blur-xl border-l border-white/10 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-indigo-400" />
              <h2 id="notifications-title" className="text-xs font-semibold text-zinc-200 tracking-wider">NOTIFICATIONS</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={markAllRead}
                aria-label="Mark all notifications read"
                className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-indigo-400 transition-colors"
              >
                <CheckCheck size={12} />
                MARK ALL READ
              </button>
              <button
                onClick={onClose}
                aria-label="Close notifications"
                className="min-h-8 min-w-8 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-3 py-2 border-b border-white/[0.06] overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-pressed={activeTab === tab}
                className={clsx(
                  'px-2.5 py-1 rounded whitespace-nowrap text-[10px] font-semibold tracking-wider transition-colors',
                  activeTab === tab
                    ? 'bg-indigo-500/15 text-indigo-400'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]',
                )}
              >
                {tab === 'attention' ? `ATTENTION${attentionCount ? ` (${attentionCount})` : ''}` : tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Notification list */}
          {filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center h-40 text-zinc-600">
              <Bell size={20} className="mb-2 opacity-40" />
              <span className="text-[11px]">{activeTab === 'attention' ? 'Nothing needs attention' : 'No notifications'}</span>
            </div>
          ) : filtered.length > 20 ? (
            <VirtualList
              items={filtered}
              itemHeight={72}
              className="flex-1"
              renderItem={(n) => (
                <NotificationItem key={n.id} notification={n} onDismiss={dismiss} onClose={onClose} />
              )}
            />
          ) : (
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {filtered.map((n) => (
                  <NotificationItem key={n.id} notification={n} onDismiss={dismiss} onClose={onClose} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
