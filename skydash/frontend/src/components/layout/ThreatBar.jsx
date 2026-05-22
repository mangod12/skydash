import { useIntelStore } from '../../stores/intelStore';

const LEVEL_COLORS = {
  critical: { bg: 'rgb(239, 68, 68)', shadow: '0 0 8px rgba(239, 68, 68, 0.5)' },
  high: { bg: 'rgb(245, 158, 11)', shadow: '0 0 8px rgba(245, 158, 11, 0.4)' },
  steady: { bg: 'rgb(16, 185, 129)', shadow: '0 0 6px rgba(16, 185, 129, 0.3)' },
  none: { bg: '#27272a', shadow: 'none' },
};

export default function ThreatBar() {
  const entities = useIntelStore((s) => s.entities);

  const hasCritical = entities.some((e) => e.threatLevel === 'critical');
  const hasHigh = entities.some((e) => e.threatLevel === 'high');

  const level = entities.length === 0
    ? 'none'
    : hasCritical ? 'critical' : hasHigh ? 'high' : 'steady';

  const { bg, shadow } = LEVEL_COLORS[level];

  return (
    <div
      className={`w-full h-[3px] shrink-0 z-50 ${level === 'critical' ? 'animate-pulse' : ''}`}
      style={{
        backgroundColor: bg,
        boxShadow: shadow,
        transition: 'background-color 300ms ease, box-shadow 300ms ease',
      }}
    />
  );
}
