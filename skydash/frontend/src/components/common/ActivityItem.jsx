import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Shield, Target, Settings, AlertTriangle, Radio } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

const ICON_MAP = {
  Shield,
  Target,
  Settings,
  AlertTriangle,
  Radio,
};

const SEVERITY_COLOR = {
  info: 'bg-cyan-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
};

const SEVERITY_TEXT = {
  info: 'text-cyan-400/70',
  warning: 'text-amber-400/70',
  critical: 'text-red-400/70',
};

const CATEGORY_COLOR = {
  intel: 'text-violet-400',
  mission: 'text-indigo-400',
  system: 'text-zinc-400',
  alert: 'text-amber-400',
  telemetry: 'text-cyan-400',
};

export default function ActivityItem({ activity }) {
  const setActiveView = useUIStore((s) => s.setActiveView);
  const Icon = ICON_MAP[activity.icon] || Settings;

  const handleClick = () => {
    if (activity.entityId) {
      setActiveView('intel');
    } else if (activity.missionId) {
      setActiveView('missions');
    }
  };

  const isClickable = activity.entityId || activity.missionId;
  const timeLabel = formatDistanceToNow(activity.timestamp, { addSuffix: true });

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleClick}
      className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border border-white/[0.04]
        bg-white/[0.02] hover:bg-white/[0.04] transition-colors
        ${isClickable ? 'cursor-pointer hover:border-white/[0.08]' : ''}`}
    >
      {/* Category icon */}
      <div className={`mt-0.5 shrink-0 ${CATEGORY_COLOR[activity.category] || 'text-zinc-500'}`}>
        <Icon size={14} strokeWidth={1.5} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-zinc-200 truncate">
            {activity.action}
          </span>
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_COLOR[activity.severity] || SEVERITY_COLOR.info}`} />
        </div>
        <p className="text-[10px] text-zinc-500 leading-snug mt-0.5 line-clamp-1">
          {activity.detail}
        </p>
      </div>

      {/* Timestamp */}
      <span className={`text-[9px] font-mono tabular-nums shrink-0 mt-0.5 ${SEVERITY_TEXT[activity.severity] || 'text-zinc-600'}`}>
        {timeLabel}
      </span>
    </motion.div>
  );
}
