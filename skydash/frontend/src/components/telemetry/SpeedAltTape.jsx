import { clsx } from 'clsx';

/**
 * Vertical tape instrument (like Boeing glass cockpit speed/altitude tapes)
 * Shows current value with moving scale
 */
export default function SpeedAltTape({
  value = 0,
  label,
  unit,
  color = 'text-emerald-400',
  min = 0,
  max = 100,
  step = 10,
  side = 'left', // 'left' or 'right'
}) {
  const tapeHeight = 160;
  const range = max - min;
  const normalizedValue = Math.max(min, Math.min(max, value));
  const offsetPercent = ((normalizedValue - min) / range);

  // Generate tick marks
  const ticks = [];
  for (let v = min; v <= max; v += step) {
    ticks.push(v);
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[9px] font-semibold tracking-[0.15em] text-zinc-600">{label}</div>

      <div
        className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-zinc-900/60"
        style={{ width: 52, height: tapeHeight }}
      >
        {/* Moving tape */}
        <div
          className="absolute left-0 right-0 transition-transform duration-150"
          style={{
            height: tapeHeight * 3,
            transform: `translateY(${tapeHeight - (offsetPercent * tapeHeight * 2)}px)`,
          }}
        >
          {ticks.map((tick) => {
            const y = tapeHeight * 3 - ((tick - min) / range) * tapeHeight * 2;
            const isMajor = tick % (step * 2) === 0;
            return (
              <div
                key={tick}
                className="absolute flex items-center"
                style={{
                  top: y,
                  [side === 'left' ? 'right' : 'left']: 0,
                  width: '100%',
                }}
              >
                <div className={clsx(
                  'flex items-center w-full',
                  side === 'left' ? 'flex-row-reverse' : 'flex-row',
                )}>
                  <div className={clsx(
                    'bg-white/20',
                    isMajor ? 'w-3 h-[1px]' : 'w-1.5 h-[1px] opacity-50',
                  )} />
                  {isMajor && (
                    <span className="text-[8px] font-mono tabular-nums text-zinc-500 px-1 leading-none">
                      {tick}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Center readout box */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 z-10">
          <div className={clsx(
            'mx-0.5 py-1 rounded border text-center',
            'bg-zinc-900/90 border-white/[0.15]',
          )}>
            <span className={clsx('text-sm font-mono font-bold tabular-nums', color)}>
              {value.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Center line */}
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/10 z-[5]" />
      </div>

      <div className="text-[8px] text-zinc-600">{unit}</div>
    </div>
  );
}
