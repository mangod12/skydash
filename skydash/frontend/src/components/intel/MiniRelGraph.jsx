import { useMemo } from 'react';

const ENTITY_TYPE_COLORS = {
  vehicle: '#f59e0b',
  person: '#8b5cf6',
  building: '#ef4444',
  device: '#10b981',
  event: '#ec4899',
};

const MAX_NODES = 8;
const WIDTH = 280;
const HEIGHT = 120;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const CENTER_R = 12;
const NODE_R = 7;
const ORBIT_RX = 100;
const ORBIT_RY = 40;

export default function MiniRelGraph({ entity, relationships, entities }) {
  const nodes = useMemo(() => {
    const connected = relationships.slice(0, MAX_NODES).map((rel, i) => {
      const otherId = rel.from === entity.id ? rel.to : rel.from;
      const other = entities.find((e) => e.id === otherId);
      const angle = (2 * Math.PI * i) / Math.min(relationships.length, MAX_NODES);
      return {
        id: otherId,
        name: other?.name ?? otherId,
        type: other?.type ?? 'unknown',
        x: CX + ORBIT_RX * Math.cos(angle - Math.PI / 2),
        y: CY + ORBIT_RY * Math.sin(angle - Math.PI / 2),
        relType: rel.type,
      };
    });
    return connected;
  }, [entity.id, relationships, entities]);

  if (nodes.length === 0) return null;

  return (
    <svg
      width="100%"
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block"
    >
      {/* Edges */}
      {nodes.map((node) => (
        <line
          key={`edge-${node.id}`}
          x1={CX}
          y1={CY}
          x2={node.x}
          y2={node.y}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* Connected nodes */}
      {nodes.map((node) => {
        const fill = ENTITY_TYPE_COLORS[node.type] || '#71717a';
        return (
          <g key={`node-${node.id}`}>
            <circle
              cx={node.x}
              cy={node.y}
              r={NODE_R}
              fill={fill}
              fillOpacity={0.6}
              stroke={fill}
              strokeWidth={1}
              strokeOpacity={0.8}
            />
            <text
              x={node.x}
              y={node.y + NODE_R + 10}
              textAnchor="middle"
              fill="#a1a1aa"
              fontSize={7}
              fontFamily="Inter, sans-serif"
            >
              {node.name.length > 12 ? `${node.name.slice(0, 11)}...` : node.name}
            </text>
          </g>
        );
      })}

      {/* Center node — this entity */}
      <circle
        cx={CX}
        cy={CY}
        r={CENTER_R}
        fill="#22d3ee"
        fillOpacity={0.25}
        stroke="#22d3ee"
        strokeWidth={1.5}
      />
      <text
        x={CX}
        y={CY + 3}
        textAnchor="middle"
        fill="#22d3ee"
        fontSize={8}
        fontWeight="bold"
        fontFamily="JetBrains Mono, monospace"
      >
        {entity.name.length > 8 ? entity.name.slice(0, 7) : entity.name}
      </text>
    </svg>
  );
}
