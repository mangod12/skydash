import { clsx } from 'clsx';

const CHIP_ACTIVE = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
const CHIP_IDLE = 'text-zinc-500 border-white/[0.06] hover:bg-white/[0.04]';

export function SectionLabel({ children }) {
  return (
    <h4 className="text-[8px] font-semibold tracking-[0.15em] text-zinc-500 uppercase mb-2">
      {children}
    </h4>
  );
}

export function ModeChip({ label, active, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={clsx(
        'rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider border transition-all duration-150',
        disabled ? 'border-white/[0.04] text-zinc-700 cursor-not-allowed' : active ? CHIP_ACTIVE : CHIP_IDLE,
        active && 'scale-[1.02]',
      )}
    >
      {label}
    </button>
  );
}

export function QuickBtn({ icon: Icon, label, danger, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold tracking-wider border transition-all duration-150',
        disabled
          ? 'border-white/[0.04] text-zinc-700 cursor-not-allowed'
          : danger
          ? 'border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 animate-pulse'
          : 'border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]',
      )}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

export function Slider({ label, value, min, max, step, unit, onChange, onCommit, disabled = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[8px] font-semibold tracking-[0.15em] text-zinc-600 uppercase w-16 shrink-0">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={(e) => onCommit?.(Number(e.currentTarget.value))}
        onTouchEnd={(e) => onCommit?.(Number(e.currentTarget.value))}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onCommit?.(Number(e.currentTarget.value));
        }}
        className="flex-1 h-1 appearance-none bg-zinc-800 rounded-full outline-none
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(99,102,241,0.5)]"
      />
      <span className="text-[11px] font-mono tabular-nums text-zinc-300 w-16 text-right">
        {value.toFixed(step < 1 ? 1 : 0)} {unit}
      </span>
    </div>
  );
}
