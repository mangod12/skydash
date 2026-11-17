import { Inbox, Loader2, AlertTriangle } from 'lucide-react';

const KINDS = {
  empty: { icon: Inbox, tone: 'text-zinc-500', ring: 'text-zinc-600' },
  loading: { icon: Loader2, tone: 'text-zinc-400', ring: 'text-zinc-500' },
  error: { icon: AlertTriangle, tone: 'text-red-300', ring: 'text-red-400' },
};

/**
 * One shape for "nothing to show" inside a panel: empty, loading or error.
 * Readable contrast, a short title, an optional hint, an optional action.
 */
export default function PanelState({ kind = 'empty', title, hint, actionLabel, onAction, className = '' }) {
  const { icon: Icon, tone, ring } = KINDS[kind] || KINDS.empty;
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      aria-busy={kind === 'loading' || undefined}
      className={`flex flex-col items-center justify-center text-center gap-1.5 py-6 px-3 ${className}`}
    >
      <Icon size={16} className={`${ring} ${kind === 'loading' ? 'animate-spin' : ''}`} />
      <div className={`text-[11px] font-medium ${tone}`}>{title}</div>
      {hint && <div className="text-[10px] text-zinc-500 max-w-[28ch] leading-snug">{hint}</div>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 px-2.5 py-1 rounded text-[10px] font-mono tracking-wide text-zinc-300 border border-white/[0.12] hover:bg-white/[0.05]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
