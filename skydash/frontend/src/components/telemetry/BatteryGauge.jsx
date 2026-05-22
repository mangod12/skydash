import { clsx } from 'clsx';
import { useTelemetryStore } from '../../stores/telemetryStore';

export default function BatteryGauge() {
  const data = useTelemetryStore((s) => s.data);
  const voltage = data?.battery_voltage ?? 0;

  // 4S LiPo: 14.0V (empty) to 16.8V (full)
  const percent = Math.max(0, Math.min(100, ((voltage - 14.0) / 2.8) * 100));

  const getColor = () => {
    if (percent > 50) return { bar: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.3)]' };
    if (percent > 25) return { bar: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-[0_0_12px_rgba(245,158,11,0.3)]' };
    return { bar: 'bg-red-500', text: 'text-red-400', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.3)]' };
  };

  const colors = getColor();

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 uppercase">
          BATTERY
        </span>
        <span className={clsx('text-xs font-mono tabular-nums font-bold', colors.text)}>
          {Math.round(percent)}%
        </span>
      </div>

      {/* Bar */}
      <div className="h-2 rounded-full bg-zinc-800/80 overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', colors.bar, colors.glow)}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Voltage */}
      <div className={clsx('text-2xl font-bold font-mono tabular-nums', colors.text)}>
        {voltage.toFixed(2)}
        <span className="text-zinc-500 text-sm ml-1 font-sans font-normal">V</span>
      </div>
    </div>
  );
}
