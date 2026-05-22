import { useEffect, useRef, useState } from 'react';
import * as d3Force from 'd3-force';
import * as d3Selection from 'd3-selection';
import { Maximize2 } from 'lucide-react';
import { useIntelStore } from '../../stores/intelStore';

const TYPE_COLORS = {
  person: '#8b5cf6', vehicle: '#3b82f6', building: '#f59e0b',
  device: '#22d3ee', event: '#ef4444', organization: '#6366f1',
};
const THREAT_RADIUS = { none: 8, low: 10, medium: 12, high: 14, critical: 16 };
const REL_COLORS = {
  located_at: '#6366f1', associated_with: '#f59e0b', traveled_to: '#22d3ee',
  owns: '#10b981', communicates_with: '#8b5cf6',
};

export default function LinkGraph() {
  const svgRef = useRef(null);
  const allEntities = useIntelStore((s) => s.entities);
  const allRelationships = useIntelStore((s) => s.relationships);
  const selectEntity = useIntelStore((s) => s.selectEntity);
  const [focusedId, setFocusedId] = useState(null);

  // Filter to 1-hop neighborhood when focused
  const { entities, relationships } = (() => {
    if (!focusedId) return { entities: allEntities, relationships: allRelationships };

    const connectedIds = new Set([focusedId]);
    const filteredRels = allRelationships.filter((r) => {
      if (r.from === focusedId || r.to === focusedId) {
        connectedIds.add(r.from);
        connectedIds.add(r.to);
        return true;
      }
      return false;
    });
    return {
      entities: allEntities.filter((e) => connectedIds.has(e.id)),
      relationships: filteredRels,
    };
  })();

  useEffect(() => {
    const svg = d3Selection.select(svgRef.current);
    const width = svgRef.current?.clientWidth || 600;
    const height = svgRef.current?.clientHeight || 400;
    svg.selectAll('*').remove();

    const nodeMap = {};
    entities.forEach((e) => { nodeMap[e.id] = { ...e, x: width / 2 + (Math.random() - 0.5) * 100, y: height / 2 + (Math.random() - 0.5) * 100 }; });
    const nodes = Object.values(nodeMap);
    const links = relationships
      .filter((r) => nodeMap[r.from] && nodeMap[r.to])
      .map((r) => ({ source: r.from, target: r.to, type: r.type, confidence: r.confidence }));

    if (nodes.length === 0) return;

    const simulation = d3Force.forceSimulation(nodes)
      .force('link', d3Force.forceLink(links).id((d) => d.id).distance(120))
      .force('charge', d3Force.forceManyBody().strength(-400))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force('collision', d3Force.forceCollide().radius(35));

    // Glow filter
    const defs = svg.append('defs');
    defs.append('filter').attr('id', 'glow').append('feGaussianBlur').attr('stdDeviation', '3');

    // Links
    const link = svg.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', (d) => REL_COLORS[d.type] || '#3f3f46')
      .attr('stroke-opacity', (d) => 0.2 + (d.confidence / 100) * 0.5)
      .attr('stroke-width', (d) => 1 + (d.confidence / 100) * 2)
      .attr('stroke-dasharray', (d) => d.confidence < 50 ? '4 4' : 'none');

    // Link labels
    const linkLabel = svg.append('g').selectAll('text').data(links).join('text')
      .text((d) => d.type.replace(/_/g, ' '))
      .attr('fill', '#52525b').attr('font-size', '8').attr('font-family', 'var(--font-mono)').attr('text-anchor', 'middle');

    // Nodes
    const node = svg.append('g').selectAll('g').data(nodes).join('g').attr('cursor', 'pointer');

    node.append('circle')
      .attr('r', (d) => THREAT_RADIUS[d.threatLevel] || 8)
      .attr('fill', (d) => TYPE_COLORS[d.type] || '#71717a')
      .attr('fill-opacity', (d) => d.id === focusedId ? 0.6 : 0.3)
      .attr('stroke', (d) => TYPE_COLORS[d.type] || '#71717a')
      .attr('stroke-width', (d) => d.id === focusedId ? 2.5 : 1.5)
      .attr('filter', 'url(#glow)');

    node.append('circle').attr('r', 3).attr('fill', 'white').attr('fill-opacity', 0.8);

    node.append('text')
      .text((d) => d.name)
      .attr('fill', '#a1a1aa').attr('font-size', '9').attr('font-family', 'var(--font-mono)')
      .attr('text-anchor', 'middle').attr('dy', (d) => (THREAT_RADIUS[d.threatLevel] || 8) + 12);

    // Click: select entity. Double-click: focus/unfocus
    node.on('click', (_event, d) => selectEntity(d.id));
    node.on('dblclick', (_event, d) => setFocusedId((prev) => prev === d.id ? null : d.id));

    // Drag
    let dragNode = null;
    node.on('mousedown', (_event, d) => { dragNode = d; simulation.alphaTarget(0.3).restart(); });
    svg.on('mousemove', (event) => {
      if (!dragNode) return;
      const [x, y] = d3Selection.pointer(event, svgRef.current);
      dragNode.fx = x; dragNode.fy = y;
    });
    svg.on('mouseup', () => {
      if (!dragNode) return;
      simulation.alphaTarget(0); dragNode.fx = null; dragNode.fy = null; dragNode = null;
    });

    simulation.on('tick', () => {
      link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
      linkLabel.attr('x', (d) => (d.source.x + d.target.x) / 2).attr('y', (d) => (d.source.y + d.target.y) / 2);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [entities, relationships, selectEntity, focusedId]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
            LINK ANALYSIS
          </h3>
          {focusedId && (
            <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
              FOCUSED: {allEntities.find((e) => e.id === focusedId)?.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {focusedId && (
            <button
              onClick={() => setFocusedId(null)}
              className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Show all entities"
            >
              <Maximize2 size={10} /> SHOW ALL
            </button>
          )}
          <div className="flex gap-2">
            {Object.entries(TYPE_COLORS).slice(0, 5).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[8px] text-zinc-600 uppercase">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative bg-zinc-950/50">
        <svg ref={svgRef} className="w-full h-full" style={{ minHeight: 300 }} />
        {!focusedId && (
          <div className="absolute bottom-2 left-3 text-[9px] text-zinc-700 pointer-events-none">
            Double-click node to focus 1-hop neighborhood
          </div>
        )}
      </div>
    </div>
  );
}
