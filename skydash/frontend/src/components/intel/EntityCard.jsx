import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  Car, User, Building2, Wifi, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const TYPE_CONFIG = {
  vehicle: { icon: Car, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  person: { icon: User, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  building: { icon: Building2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  device: { icon: Wifi, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  event: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  organization: { icon: Building2, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
};

const THREAT_COLORS = {
  none: 'bg-zinc-700',
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
  critical: 'bg-red-600 animate-pulse',
};

export default function EntityCard({ entity, selected, onClick }) {
  const config = TYPE_CONFIG[entity.type] || TYPE_CONFIG.event;
  const Icon = config.icon;

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'w-full text-left p-3 rounded-xl border transition-all duration-150',
        selected
          ? 'bg-indigo-500/10 border-indigo-500/30'
          : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', config.bg)}>
          <Icon size={16} className={config.color} strokeWidth={1.5} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-200 truncate">{entity.name}</span>
            <div className={clsx('w-2 h-2 rounded-full shrink-0', THREAT_COLORS[entity.threatLevel])} />
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
            {entity.type.toUpperCase()} &middot; {entity.confidence}% conf
          </div>
          <div className="text-[9px] text-zinc-600 mt-1">
            {formatDistanceToNow(entity.lastSeen, { addSuffix: true })}
          </div>
        </div>

        <ChevronRight size={14} className="text-zinc-700 shrink-0 mt-1" />
      </div>

      {/* Tags */}
      {entity.tags?.length > 0 && (
        <div className="flex gap-1 mt-2 ml-11">
          {entity.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500 border border-white/[0.06]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.button>
  );
}
