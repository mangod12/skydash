import GlassCard from '../common/GlassCard';

const TEXT_MAP = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  indigo: 'text-indigo-400',
  cyan: 'text-cyan-400',
};

const BAR_MAP = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
  indigo: 'bg-indigo-400',
  cyan: 'bg-cyan-400',
};

/**
 * Flat metric card: label row, one large value, a single supporting line.
 * `empty` shows a muted dash instead of a value (no data yet).
 * `status` draws a 2px left rule in the semantic colour; nothing else glows.
 */
export function StatCard({ label, value, sub, icon: Icon, accent, freshness, empty = false }) {
  return (
    <GlassCard className="!p-4 relative overflow-hidden" animate={false}>
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-[2px] ${BAR_MAP[accent] || 'bg-zinc-700'}`}
      />
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          {label}
        </span>
        {Icon && <Icon size={14} className="text-zinc-600" />}
      </div>
      <div className={`text-2xl font-mono font-semibold tabular-nums ${
        empty ? 'text-zinc-600' : TEXT_MAP[accent] || 'text-zinc-200'}`}>
        {empty ? '\u2014' : value}
      </div>
      {sub && (
        <div className="text-[10px] text-zinc-500 mt-1 font-mono tabular-nums">
          {sub}
        </div>
      )}
      {freshness && (
        <div className="text-[9px] text-zinc-600 mt-1 font-mono">
          {freshness}
        </div>
      )}
    </GlassCard>
  );
}

/* ─── Activity Feed ──────────────────────────────────────── */

const SEVERITY_DOT = {
  info: 'bg-indigo-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
};

const SEVERITY_TEXT = {
  info: 'text-zinc-400',
  warning: 'text-amber-300',
  critical: 'text-red-300',
};

export function ActivityFeed({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-700 text-[10px] tracking-wider">
        NO RECENT ACTIVITY
      </div>
    );
  }

  return (
    <div className="space-y-1.5 overflow-y-auto max-h-[440px] pr-1 custom-scrollbar">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-2.5 py-1.5 border-b border-white/[0.03] last:border-0"
        >
          <div
            role="img"
            aria-label={`Severity: ${SEVERITY_DOT[item.severity] ? item.severity : 'info'}`}
            className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[item.severity] || SEVERITY_DOT.info}`}
          />
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] leading-tight ${SEVERITY_TEXT[item.severity] || 'text-zinc-400'}`}>
              {item.description}
            </p>
            <span className="text-[9px] font-mono tabular-nums text-zinc-600">
              {item.timeLabel}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
