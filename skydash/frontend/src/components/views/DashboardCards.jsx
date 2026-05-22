import { motion } from 'framer-motion';
import GlassCard from '../common/GlassCard';

const STAGGER_DELAY = 0.1;

const GLOW_MAP = {
  emerald: 'shadow-emerald-500/10',
  amber: 'shadow-amber-500/10',
  red: 'shadow-red-500/10',
  indigo: 'shadow-indigo-500/10',
  cyan: 'shadow-cyan-500/10',
};

const TEXT_MAP = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  indigo: 'text-indigo-400',
  cyan: 'text-cyan-400',
};

export function StatCard({ label, value, sub, icon: Icon, accent, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.4, delay: index * STAGGER_DELAY, ease: [0.16, 1, 0.3, 1] }}
    >
      <GlassCard className={`!p-4 ${GLOW_MAP[accent] || ''}`} animate={false}>
        <div className="flex items-start justify-between mb-2">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
            {label}
          </span>
          {Icon && <Icon size={14} className="text-zinc-600" />}
        </div>
        <div className={`text-2xl font-mono font-bold tabular-nums ${TEXT_MAP[accent] || 'text-zinc-200'}`}>
          {value}
        </div>
        {sub && (
          <div className="text-[10px] text-zinc-500 mt-1 font-mono tabular-nums">
            {sub}
          </div>
        )}
      </GlassCard>
    </motion.div>
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
  if (items.length === 0) {
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
          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[item.severity] || SEVERITY_DOT.info}`} />
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
