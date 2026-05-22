import { useMemo } from 'react';
import { clsx } from 'clsx';
import GlassCard from '../common/GlassCard';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useUIStore } from '../../stores/uiStore';

const STATUS_MAP = {
  ok:   { label: 'OK',   dot: 'bg-emerald-400', text: 'text-emerald-400' },
  warn: { label: 'WARN', dot: 'bg-amber-400',   text: 'text-amber-400' },
  crit: { label: 'CRIT', dot: 'bg-red-400',     text: 'text-red-400' },
};

function deriveStatus(battery, signal) {
  if (battery < 15) return 'crit';
  if (battery < 30 || signal < 50) return 'warn';
  return 'ok';
}

function valueColor(value, warnThresh, critThresh) {
  if (value < critThresh) return 'text-red-400';
  if (value < warnThresh) return 'text-amber-400';
  return 'text-emerald-400';
}

const HEADER = 'text-[8px] font-semibold tracking-[0.12em] text-zinc-600';
const CELL = 'text-[10px] font-mono tabular-nums text-zinc-400';

export default function FleetOverview() {
  const fleet = useTelemetryStore((s) => s.fleet);
  const setActiveView = useUIStore((s) => s.setActiveView);

  const rows = useMemo(() =>
    fleet.map((d) => {
      const bat = d.battery_percentage ?? 0;
      const sig = d.signal_strength ?? 0;
      const status = deriveStatus(bat, sig);
      return { id: d.drone_id, alt: d.altitude ?? 0, bat, sig, mode: d.flight_mode ?? '--', status };
    }),
  [fleet]);

  if (rows.length === 0) return null;

  return (
    <GlassCard className="!p-3" animate={false}>
      <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 block mb-2">
        FLEET OVERVIEW
      </span>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {['DRONE', 'STATUS', 'ALT', 'BATT', 'SIGNAL', 'MODE'].map((h) => (
              <th key={h} className={clsx(HEADER, 'text-left pb-1.5 px-1')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = STATUS_MAP[r.status];
            return (
              <tr key={r.id}
                className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.03] cursor-pointer transition-colors"
                onClick={() => setActiveView('telemetry')}
              >
                <td className={clsx(CELL, 'py-1 px-1 text-zinc-300 font-semibold')}>{r.id}</td>
                <td className={clsx(CELL, 'py-1 px-1')}>
                  <span className="flex items-center gap-1.5">
                    <span className={clsx('w-1.5 h-1.5 rounded-full', s.dot)} />
                    <span className={s.text}>{s.label}</span>
                  </span>
                </td>
                <td className={clsx(CELL, 'py-1 px-1')}>{r.alt.toFixed(0)}m</td>
                <td className={clsx(CELL, 'py-1 px-1', valueColor(r.bat, 30, 15))}>{r.bat}%</td>
                <td className={clsx(CELL, 'py-1 px-1', valueColor(r.sig, 50, 25))}>{r.sig}%</td>
                <td className={clsx(CELL, 'py-1 px-1 text-zinc-500')}>{r.mode}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </GlassCard>
  );
}
