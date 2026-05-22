import { clsx } from 'clsx';
import { useTelemetryStore } from '../../stores/telemetryStore';

const BAR_COUNT = 5;

export default function SignalMeter() {
  const data = useTelemetryStore((s) => s.data);
  const strength = data?.signal_strength ?? 0;
  const activeBars = Math.ceil((strength / 100) * BAR_COUNT);

  const getColor = () => {
    if (strength >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-400' };
    if (strength >= 40) return { bar: 'bg-amber-500', text: 'text-amber-400' };
    return { bar: 'bg-red-500', text: 'text-red-400' };
  };

  const colors = getColor();

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          SIGNAL
        </span>
        <span className={clsx('text-xs font-mono tabular-nums font-bold', colors.text)}>
          {strength}%
        </span>
      </div>

      {/* Signal bars */}
      <div className="flex items-end gap-1 h-6">
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          const height = 8 + i * 4; // 8px to 24px
          const isActive = i < activeBars;
          return (
            <div
              key={i}
              className={clsx(
                'w-3 rounded-sm transition-all duration-300',
                isActive ? colors.bar : 'bg-zinc-800',
                isActive && i >= BAR_COUNT - 1 && 'shadow-[0_0_8px_rgba(16,185,129,0.3)]',
              )}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>
    </div>
  );
}
