import { clsx } from 'clsx';
import { Shield } from 'lucide-react';

const THREAT_LABELS = {
  none: { text: 'NONE', color: 'text-zinc-400 bg-zinc-800' },
  low: { text: 'LOW', color: 'text-emerald-400 bg-emerald-500/15' },
  medium: { text: 'MEDIUM', color: 'text-amber-400 bg-amber-500/15' },
  high: { text: 'HIGH', color: 'text-red-400 bg-red-500/15' },
  critical: { text: 'CRITICAL', color: 'text-red-400 bg-red-500/20 animate-pulse' },
};

const THREAT_VALUES = { none: 10, low: 30, medium: 50, high: 75, critical: 95 };

const THREAT_BAR_COLORS = {
  none: 'bg-zinc-500',
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
  critical: 'bg-red-600',
};

function StatPill({ label, accent }) {
  return (
    <span
      className={clsx(
        'px-2 py-0.5 rounded font-mono text-[9px] tabular-nums border',
        accent
          ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
          : 'text-zinc-400 bg-zinc-800/60 border-white/[0.06]'
      )}
    >
      {label}
    </span>
  );
}

function AssessmentBar({ label, value, barClass }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono tracking-wider text-zinc-500 w-20 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barClass)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[9px] font-mono tabular-nums text-zinc-500 w-6 text-right">
        {value}
      </span>
    </div>
  );
}

export function QuickStatsPills({ relCount, eventCount, missionCount, confidence }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatPill label={`${relCount} rel`} />
      <StatPill label={`${eventCount} events`} />
      <StatPill label={`${missionCount} missions`} />
      <StatPill label={`${confidence}% conf`} accent />
    </div>
  );
}

export function ThreatBadges({ threatLevel, confidence }) {
  const threat = THREAT_LABELS[threatLevel] || THREAT_LABELS.none;
  return (
    <div className="flex gap-2">
      <div className={clsx('px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider', threat.color)}>
        THREAT: {threat.text}
      </div>
      <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider text-cyan-400 bg-cyan-500/10">
        CONF: {confidence}%
      </div>
    </div>
  );
}

export function ThreatAssessment({ threatLevel, confidence }) {
  const threatValue = THREAT_VALUES[threatLevel] ?? 10;
  const threatBarColor = THREAT_BAR_COLORS[threatLevel] || 'bg-zinc-500';

  return (
    <div className="border-t border-white/[0.06] pt-3">
      <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2 flex items-center gap-1.5">
        <Shield size={10} /> THREAT ASSESSMENT
      </h4>
      <div className="space-y-2">
        <AssessmentBar label="THREAT" value={threatValue} barClass={threatBarColor} />
        <AssessmentBar label="CONFIDENCE" value={confidence} barClass="bg-cyan-500" />
      </div>
    </div>
  );
}
