import { useTelemetryStore } from '../../stores/telemetryStore';

export default function AttitudeIndicator() {
  const data = useTelemetryStore((s) => s.data);
  const roll = data?.attitude?.roll ?? 0;
  const pitch = data?.attitude?.pitch ?? 0;

  // Clamp pitch for display
  const pitchOffset = Math.max(-30, Math.min(30, pitch)) * 2;

  return (
    <div className="w-full aspect-square max-w-[200px] mx-auto relative">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <defs>
          <clipPath id="horizon-clip">
            <circle cx="100" cy="100" r="90" />
          </clipPath>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#92400e" />
            <stop offset="100%" stopColor="#451a03" />
          </linearGradient>
        </defs>

        {/* Outer ring */}
        <circle cx="100" cy="100" r="95" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />

        {/* Horizon */}
        <g clipPath="url(#horizon-clip)" transform={`rotate(${-roll}, 100, 100)`}>
          {/* Sky */}
          <rect x="-100" y={-200 + pitchOffset} width="400" height="300" fill="url(#sky)" />
          {/* Ground */}
          <rect x="-100" y={100 + pitchOffset} width="400" height="300" fill="url(#ground)" />
          {/* Horizon line */}
          <line x1="-100" y1={100 + pitchOffset} x2="400" y2={100 + pitchOffset} stroke="white" strokeWidth="1.5" opacity="0.8" />

          {/* Pitch ladder */}
          {[-20, -10, 10, 20].map((deg) => (
            <g key={deg} transform={`translate(0, ${-deg * 2 + pitchOffset})`}>
              <line x1="70" y1="100" x2="130" y2="100" stroke="white" strokeWidth="0.8" opacity="0.5" />
              <text x="135" y="103" fill="white" fontSize="8" opacity="0.4" fontFamily="var(--font-mono)">
                {Math.abs(deg)}
              </text>
            </g>
          ))}
        </g>

        {/* Fixed aircraft symbol */}
        <g stroke="#22d3ee" strokeWidth="2.5" fill="none" opacity="0.9">
          <line x1="55" y1="100" x2="80" y2="100" />
          <line x1="120" y1="100" x2="145" y2="100" />
          <circle cx="100" cy="100" r="4" fill="#22d3ee" />
        </g>

        {/* Bank angle ticks */}
        {[0, 10, 20, 30, -10, -20, -30].map((angle) => (
          <line
            key={angle}
            x1="100"
            y1="14"
            x2="100"
            y2={angle === 0 ? 22 : 18}
            stroke="white"
            strokeWidth={angle === 0 ? 2 : 0.8}
            opacity={angle === 0 ? 0.8 : 0.4}
            transform={`rotate(${angle}, 100, 100)`}
          />
        ))}

        {/* Bank pointer (rotates with roll) */}
        <polygon
          points="100,12 96,20 104,20"
          fill="#22d3ee"
          transform={`rotate(${-roll}, 100, 100)`}
        />
      </svg>
    </div>
  );
}
