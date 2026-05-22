import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { X, Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import useNotificationStore from '../../stores/notificationStore';
import VirtualList from './VirtualList';

const TABS = ['all', 'alert', 'intel', 'system', 'mission'];

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

function NotificationItem({ notification, onDismiss }) {
  const markRead = useNotificationStore((s) => s.markRead);

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
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-400 transition-opacity"
      >
        <X size={12} />
      </button>

      <div className="flex items-start gap-2.5 pr-5">
        <span className={clsx(
          'mt-1.5 w-2 h-2 rounded-full shrink-0',
          SEVERITY_DOT[notification.severity] || 'bg-zinc-500',
        )} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-zinc-200 truncate">
            {notification.title}
          </p>
          <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <span className="text-[9px] font-mono text-zinc-600 mt-1 block">
            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function NotificationCenter({ isOpen, onClose }) {
  const panelRef = useRef(null);
  const { notifications, markAllRead, dismiss } = useNotificationStore();
  const [activeTab, setActiveTab] = useState('all');

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

  const filtered = activeTab === 'all'
    ? notifications
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
          className="fixed top-0 right-0 bottom-0 z-50 w-96 bg-zinc-950/90 backdrop-blur-xl border-l border-white/10 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-indigo-400" />
              <h2 className="text-xs font-semibold text-zinc-200 tracking-wider">NOTIFICATIONS</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-indigo-400 transition-colors"
              >
                <CheckCheck size={12} />
                MARK ALL READ
              </button>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-3 py-2 border-b border-white/[0.06]">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'px-2.5 py-1 rounded text-[10px] font-semibold tracking-wider transition-colors',
                  activeTab === tab
                    ? 'bg-indigo-500/15 text-indigo-400'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]',
                )}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Notification list */}
          {filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center h-40 text-zinc-600">
              <Bell size={20} className="mb-2 opacity-40" />
              <span className="text-[11px]">No notifications</span>
            </div>
          ) : filtered.length > 20 ? (
            <VirtualList
              items={filtered}
              itemHeight={72}
              className="flex-1"
              renderItem={(n) => (
                <NotificationItem key={n.id} notification={n} onDismiss={dismiss} />
              )}
            />
          ) : (
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {filtered.map((n) => (
                  <NotificationItem key={n.id} notification={n} onDismiss={dismiss} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
