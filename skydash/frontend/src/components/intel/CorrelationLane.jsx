import { clsx } from 'clsx';

const SEVERITY_COLORS = {
  info: { fill: '#3b82f6', glow: 'rgba(59,130,246,0.3)' },
  warning: { fill: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  critical: { fill: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
};

const TYPE_COLORS = {
  vehicle: '#06b6d4',
  person: '#a78bfa',
  building: '#f59e0b',
  device: '#10b981',
  event: '#ef4444',
};

/**
 * A single lane in the correlation timeline, representing one entity's events.
 */
export default function CorrelationLane({
  entity,
  events,
  y,
  laneHeight,
  toX,
  onHover,
  onLeave,
}) {
  const centerY = y + laneHeight / 2;
  const labelColor = TYPE_COLORS[entity.type] ?? '#71717a';

  return (
    <g>
      {/* Lane background stripe */}
      <rect
        x={0}
        y={y}
        width="100%"
        height={laneHeight}
        fill="rgba(255,255,255,0.01)"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={0.5}
      />

      {/* Lane baseline */}
      <line
        x1={0}
        y1={centerY}
        x2="100%"
        y2={centerY}
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={1}
        strokeDasharray="2,4"
      />

      {/* Entity label */}
      <text
        x={8}
        y={y + 14}
        fill={labelColor}
        fontSize={9}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight={600}
        letterSpacing="0.08em"
      >
        {entity.name.length > 18
          ? entity.name.slice(0, 16) + '...'
          : entity.name}
      </text>

      {/* Entity type badge */}
      <text
        x={8}
        y={y + 25}
        fill="rgba(161,161,170,0.4)"
        fontSize={7}
        fontFamily="'JetBrains Mono', monospace"
        letterSpacing="0.12em"
        textTransform="uppercase"
      >
        {entity.type.toUpperCase()}
      </text>

      {/* Event dots */}
      {events.map((evt) => {
        const cx = toX(evt.time);
        const { fill, glow } = SEVERITY_COLORS[evt.severity] ?? SEVERITY_COLORS.info;
        const radius = evt.severity === 'critical' ? 5 : 4;

        return (
          <g key={evt.id}>
            {/* Glow */}
            <circle
              cx={cx}
              cy={centerY}
              r={radius + 3}
              fill={glow}
              opacity={0.5}
            />
            {/* Dot */}
            <circle
              cx={cx}
              cy={centerY}
              r={radius}
              fill={fill}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={1}
              className="cursor-pointer"
              onMouseEnter={(e) => onHover(evt, entity, e)}
              onMouseLeave={onLeave}
            />
          </g>
        );
      })}
    </g>
  );
}

export { SEVERITY_COLORS, TYPE_COLORS };
