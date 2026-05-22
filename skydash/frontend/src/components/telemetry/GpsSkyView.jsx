import { useTelemetryStore } from '../../stores/telemetryStore';

/**
 * Simplified GPS satellite constellation sky dome
 * Shows satellite count with a visual sky plot
 */
export default function GpsSkyView() {
  const data = useTelemetryStore((s) => s.data);
  const satCount = data?.gps?.satellites ?? 0;

  // Generate deterministic satellite positions from count
  const satellites = Array.from({ length: satCount }).map((_, i) => {
    const angle = (i * 137.5) * Math.PI / 180; // Golden angle distribution
    const r = 12 + (i % 3) * 10; // Varying radius
    return {
      x: 32 + Math.cos(angle) * r,
      y: 32 + Math.sin(angle) * r,
    };
  });

  const getColor = () => {
    if (satCount >= 10) return { text: 'text-emerald-400', dot: '#10b981' };
    if (satCount >= 6) return { text: 'text-cyan-400', dot: '#22d3ee' };
    return { text: 'text-amber-400', dot: '#f59e0b' };
  };

  const colors = getColor();

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          GPS CONSTELLATION
        </span>
        <span className={`text-xs font-mono tabular-nums font-bold ${colors.text}`}>
          {satCount} SATS
        </span>
      </div>

      {/* Sky dome */}
      <div className="flex justify-center">
        <svg viewBox="0 0 64 64" className="w-16 h-16">
          {/* Outer ring (horizon) */}
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
          {/* Middle ring (45 deg elevation) */}
          <circle cx="32" cy="32" r="18" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="2 2" />
          {/* Inner ring (zenith area) */}
          <circle cx="32" cy="32" r="8" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          {/* Cross lines */}
          <line x1="32" y1="4" x2="32" y2="60" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          <line x1="4" y1="32" x2="60" y2="32" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />

          {/* Satellite dots */}
          {satellites.map((sat, i) => (
            <circle
              key={i}
              cx={sat.x}
              cy={sat.y}
              r="2"
              fill={colors.dot}
              opacity={0.8}
            >
              <animate
                attributeName="opacity"
                values="0.5;1;0.5"
                dur={`${1.5 + (i % 3) * 0.5}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </svg>
      </div>
    </div>
  );
}
