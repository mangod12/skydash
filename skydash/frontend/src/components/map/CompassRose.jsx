import { useTelemetryStore } from '../../stores/telemetryStore';

export default function CompassRose() {
  const data = useTelemetryStore((s) => s.data);
  const heading = data?.attitude?.yaw ?? 0;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
      <div className="relative w-[72px] h-[72px]">
        <svg viewBox="0 0 72 72" className="w-full h-full drop-shadow-lg">
          {/* Outer ring */}
          <circle cx="36" cy="36" r="34" fill="rgba(9,9,11,0.7)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />

          {/* Rotating compass ring */}
          <g transform={`rotate(${-heading}, 36, 36)`}>
            {/* Cardinal ticks */}
            {[0, 90, 180, 270].map((deg) => (
              <line
                key={deg}
                x1="36" y1="5" x2="36" y2="11"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1.5"
                transform={`rotate(${deg}, 36, 36)`}
              />
            ))}

            {/* Minor ticks every 30 degrees */}
            {[30, 60, 120, 150, 210, 240, 300, 330].map((deg) => (
              <line
                key={deg}
                x1="36" y1="6" x2="36" y2="10"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="0.5"
                transform={`rotate(${deg}, 36, 36)`}
              />
            ))}

            {/* Cardinal labels */}
            <text x="36" y="18" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="700" fontFamily="var(--font-mono)">N</text>
            <text x="36" y="66" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="var(--font-mono)" transform="rotate(180, 36, 62)">S</text>
            <text x="63" y="39" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="var(--font-mono)">E</text>
            <text x="9" y="39" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="var(--font-mono)">W</text>
          </g>

          {/* Fixed heading pointer (top) */}
          <polygon points="36,3 33,9 39,9" fill="#6366f1" />

          {/* Center heading readout background */}
          <rect x="20" y="28" width="32" height="16" rx="4" fill="rgba(9,9,11,0.8)" />
        </svg>

        {/* Heading number overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-mono font-bold tabular-nums text-white/90 mt-0.5">
            {String(Math.round(heading)).padStart(3, '0')}&deg;
          </span>
        </div>
      </div>
    </div>
  );
}
