import { clsx } from 'clsx';

export default function MapHUD({ data }) {
  if (!data) {
    return (
      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
        <div className="text-zinc-700 text-xs tracking-wider animate-pulse">
          AWAITING TELEMETRY...
        </div>
      </div>
    );
  }

  const batColor = data.battery_voltage < 14.5
    ? 'text-red-400'
    : data.battery_voltage < 15.5
      ? 'text-amber-400'
      : 'text-emerald-400';

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Scan line ambient effect */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
        <div
          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent"
          style={{
            animation: 'scan-line 4s linear infinite',
          }}
        />
      </div>

      {/* Top-left: Mission badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-1.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] font-mono text-zinc-300 tracking-wider">DRONE-01</span>
          <span className="text-[9px] font-mono text-zinc-600">|</span>
          <span className={clsx('text-[10px] font-mono tracking-wider',
            data.flight_mode === 'STABILIZE' ? 'text-cyan-400' : 'text-amber-400'
          )}>
            {data.flight_mode}
          </span>
        </div>
      </div>

      {/* Top-right: Mission time */}
      <div className="absolute top-3 right-14 flex items-center gap-2">
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-1.5">
          <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
            T+{formatMissionTime(data.timestamp)}
          </span>
        </div>
      </div>

      {/* Crosshair reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full opacity-15">
          {/* Outer circle */}
          <circle cx="40" cy="40" r="36" fill="none" stroke="white" strokeWidth="0.5" />
          {/* Inner dashed circle */}
          <circle cx="40" cy="40" r="16" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="3 4" />
          {/* Crosshair lines */}
          <line x1="40" y1="2" x2="40" y2="20" stroke="white" strokeWidth="0.5" />
          <line x1="40" y1="60" x2="40" y2="78" stroke="white" strokeWidth="0.5" />
          <line x1="2" y1="40" x2="20" y2="40" stroke="white" strokeWidth="0.5" />
          <line x1="60" y1="40" x2="78" y2="40" stroke="white" strokeWidth="0.5" />
          {/* Corner brackets */}
          <path d="M12,12 L12,20 M12,12 L20,12" fill="none" stroke="white" strokeWidth="0.5" />
          <path d="M68,12 L68,20 M68,12 L60,12" fill="none" stroke="white" strokeWidth="0.5" />
          <path d="M12,68 L12,60 M12,68 L20,68" fill="none" stroke="white" strokeWidth="0.5" />
          <path d="M68,68 L68,60 M68,68 L60,68" fill="none" stroke="white" strokeWidth="0.5" />
        </svg>
      </div>

      {/* Bottom metrics bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {[
          { label: 'ALT', value: `${data.altitude?.toFixed(1)}`, unit: 'm', color: 'text-emerald-400' },
          { label: 'SPD', value: `${data.ground_speed?.toFixed(1)}`, unit: 'm/s', color: 'text-blue-400' },
          { label: 'HDG', value: `${Math.round(data.attitude?.yaw ?? 0).toString().padStart(3, '0')}`, unit: '\u00B0', color: 'text-cyan-400' },
          { label: 'BAT', value: `${data.battery_voltage?.toFixed(1)}`, unit: 'V', color: batColor },
          { label: 'SIG', value: `${data.signal_strength}`, unit: '%', color: 'text-violet-400' },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-zinc-900/80 backdrop-blur-sm border border-white/[0.06] rounded-lg px-2.5 py-1.5 min-w-[72px] text-center"
          >
            <div className="text-[8px] text-zinc-600 tracking-[0.15em] leading-none mb-1">{m.label}</div>
            <div className={clsx('text-[13px] font-mono font-bold tabular-nums leading-none', m.color)}>
              {m.value}
              <span className="text-[9px] text-zinc-500 font-normal ml-0.5">{m.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Vignette edges */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(9,9,11,0.4) 100%)',
        }}
      />
    </div>
  );
}

function formatMissionTime(seconds) {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
