import { useMemo } from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import { useIntelStore } from '../../stores/intelStore';

const THREAT_COLORS = {
  low: 'text-emerald-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
  critical: 'text-red-500',
};

const THREAT_BG = {
  low: 'bg-emerald-500/20 border-emerald-500/40',
  medium: 'bg-amber-500/20 border-amber-500/40',
  high: 'bg-red-500/20 border-red-500/40',
  critical: 'bg-red-600/30 border-red-500/60',
};

export function ThreatPanel() {
  const entities = useIntelStore((s) => s.entities);
  const events = useIntelStore((s) => s.events);

  const threatCounts = useMemo(() => {
    const c = { low: 0, medium: 0, high: 0, critical: 0 };
    entities.forEach((e) => { if (c[e.threatLevel] !== undefined) c[e.threatLevel]++; });
    return c;
  }, [entities]);

  const maxThreat = threatCounts.critical > 0 ? 'critical'
    : threatCounts.high > 0 ? 'high'
    : threatCounts.medium > 0 ? 'medium' : 'low';

  const recentEvents = useMemo(
    () => [...events].sort((a, b) => b.time - a.time).slice(0, 8),
    [events],
  );

  return (
    <div className="h-full flex flex-col">
      <span className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 mb-3">THREAT FEED</span>

      {/* Threat Level Gauge */}
      <div className={`border rounded-xl p-4 mb-3 text-center ${THREAT_BG[maxThreat]}`}>
        <Shield size={24} className={`mx-auto mb-1 ${THREAT_COLORS[maxThreat]}`} />
        <div className={`text-2xl font-bold font-mono tracking-wider ${THREAT_COLORS[maxThreat]}`}>
          {maxThreat.toUpperCase()}
        </div>
        <div className="text-[9px] text-zinc-400 mt-1 tracking-wider">
          {threatCounts.critical}C / {threatCounts.high}H / {threatCounts.medium}M / {threatCounts.low}L
        </div>
      </div>

      {/* Scrolling Event Feed */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {recentEvents.map((evt) => (
          <div key={evt.id} className="border border-white/[0.06] rounded-lg p-2.5 bg-zinc-900/40">
            <div className="flex items-start gap-2">
              <AlertTriangle size={12} className={
                evt.severity === 'critical' ? 'text-red-400 mt-0.5' :
                evt.severity === 'warning' ? 'text-amber-400 mt-0.5' : 'text-zinc-500 mt-0.5'
              } />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-200 leading-tight truncate">{evt.description}</p>
                <span className="text-[9px] text-zinc-600 font-mono">
                  {new Date(evt.time).toLocaleTimeString('en-US', { hour12: false })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
