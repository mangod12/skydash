import { useMemo } from 'react';
import GlassCard from '../common/GlassCard';
import { useIntelStore } from '../../stores/intelStore';
import { useMapStore } from '../../stores/mapStore';
import { THREAT_COLORS } from '../../utils/designTokens';

const SIZE = 180;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_R = SIZE / 2 - 12;
const RANGE_KM = 2;
const DEG_TO_RAD = Math.PI / 180;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const y = Math.sin(dLng) * Math.cos(lat2 * DEG_TO_RAD);
  const x = Math.cos(lat1 * DEG_TO_RAD) * Math.sin(lat2 * DEG_TO_RAD) -
    Math.sin(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function threatColor(level) {
  return THREAT_COLORS[level] || THREAT_COLORS.none;
}

export default function EntityRadar() {
  const dronePos = useMapStore((s) => s.dronePosition);
  const entities = useIntelStore((s) => s.entities);

  const blips = useMemo(() => {
    if (!dronePos) return [];
    return entities
      .filter((e) => e.coordinates)
      .map((e) => {
        const [lat, lng] = e.coordinates;
        const dist = haversineKm(dronePos.lat, dronePos.lng, lat, lng);
        const brg = bearing(dronePos.lat, dronePos.lng, lat, lng);
        const r = Math.min(dist / RANGE_KM, 1) * MAX_R;
        const angle = (brg - 90) * DEG_TO_RAD;
        return {
          id: e.id,
          x: CX + r * Math.cos(angle),
          y: CY + r * Math.sin(angle),
          color: threatColor(e.threatLevel),
          name: e.name,
          dist,
          inRange: dist <= RANGE_KM,
        };
      })
      .filter((b) => b.inRange);
  }, [dronePos, entities]);

  return (
    <GlassCard className="!p-3">
      <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 mb-2">
        ENTITY RADAR
      </h3>
      <div className="flex items-center justify-center">
        <svg width={SIZE} height={SIZE} className="overflow-visible">
          {/* Background */}
          <circle cx={CX} cy={CY} r={MAX_R} fill="rgba(9,9,11,0.8)" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

          {/* Range rings */}
          {[0.25, 0.5, 0.75, 1].map((pct) => (
            <circle key={pct} cx={CX} cy={CY} r={MAX_R * pct}
              fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          ))}

          {/* Crosshairs */}
          <line x1={CX - MAX_R} y1={CY} x2={CX + MAX_R} y2={CY}
            stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          <line x1={CX} y1={CY - MAX_R} x2={CX} y2={CY + MAX_R}
            stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />

          {/* Sweep line */}
          <line x1={CX} y1={CY} x2={CX} y2={CY - MAX_R}
            stroke="rgba(34,211,238,0.3)" strokeWidth={1.5}
            className="origin-center"
            style={{
              transformOrigin: `${CX}px ${CY}px`,
              animation: 'radarSweep 4s linear infinite',
            }}
          />

          {/* Sweep gradient trail */}
          <defs>
            <radialGradient id="sweepGlow">
              <stop offset="0%" stopColor="rgba(34,211,238,0.15)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0)" />
            </radialGradient>
          </defs>

          {/* Range labels */}
          <text x={CX + 4} y={CY - MAX_R * 0.5 + 3}
            fill="rgba(255,255,255,0.15)" fontSize={7} fontFamily="var(--font-mono)">
            {(RANGE_KM * 0.5).toFixed(1)}km
          </text>
          <text x={CX + 4} y={CY - MAX_R + 3}
            fill="rgba(255,255,255,0.15)" fontSize={7} fontFamily="var(--font-mono)">
            {RANGE_KM}km
          </text>

          {/* Center dot (drone) */}
          <circle cx={CX} cy={CY} r={3} fill="#22d3ee" opacity={0.8} />
          <circle cx={CX} cy={CY} r={6} fill="none" stroke="#22d3ee" strokeWidth={0.5} opacity={0.4} />

          {/* Entity blips */}
          {blips.map((b) => (
            <g key={b.id}>
              <circle cx={b.x} cy={b.y} r={4} fill={b.color} opacity={0.7} />
              <circle cx={b.x} cy={b.y} r={7} fill="none" stroke={b.color} strokeWidth={0.5} opacity={0.3} />
            </g>
          ))}

          {/* Cardinal labels */}
          <text x={CX} y={8} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={7} fontFamily="var(--font-mono)">N</text>
          <text x={SIZE - 4} y={CY + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize={7} fontFamily="var(--font-mono)">E</text>
          <text x={CX} y={SIZE - 2} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={7} fontFamily="var(--font-mono)">S</text>
          <text x={4} y={CY + 3} textAnchor="start" fill="rgba(255,255,255,0.2)" fontSize={7} fontFamily="var(--font-mono)">W</text>
        </svg>
      </div>
      <div className="text-center mt-1">
        <span className="text-[9px] text-zinc-600 font-mono tabular-nums">
          {blips.length} IN RANGE ({RANGE_KM}KM)
        </span>
      </div>
    </GlassCard>
  );
}
