import { useEffect, useRef } from 'react';
import * as d3Force from 'd3-force';
import * as d3Selection from 'd3-selection';

const REL_COLORS = {
  located_at: '#6366f1', associated_with: '#f59e0b', traveled_to: '#22d3ee',
  owns: '#10b981', communicates_with: '#8b5cf6',
};
const COMMUNITY_COLORS = ['#22d3ee', '#10b981', '#f59e0b', '#8b5cf6', '#6366f1', '#ef4444'];
const TYPE_ICONS = { person: 'P', vehicle: 'V', building: 'B', device: 'D', event: 'E', organization: 'O' };
const BASE_RADIUS = 10;

function truncate(str, len = 12) { return str.length > len ? str.slice(0, len) + '...' : str; }

function curvedPath(sx, sy, tx, ty) {
  const dx = tx - sx, dy = ty - sy;
  const mx = (sx + tx) / 2 - dy * 0.15, my = (sy + ty) / 2 + dx * 0.15;
  return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
}

function ensureDefs(svg) {
  if (!svg.select('.graph-root').empty()) return;
  svg.selectAll('*').remove();
  const defs = svg.append('defs');
  defs.append('filter').attr('id', 'node-glow').append('feGaussianBlur').attr('stdDeviation', '4');
  defs.append('marker').attr('id', 'arrow').attr('viewBox', '0 -3 6 6')
    .attr('refX', 20).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient', 'auto').append('path').attr('d', 'M0,-3L6,0L0,3').attr('fill', '#3f3f46');
  const root = svg.append('g').attr('class', 'graph-root');
  root.append('g').attr('class', 'links');
  root.append('g').attr('class', 'nodes');
}

function updateLinks(linkGroup, links, highlightedEdges) {
  const sel = linkGroup.selectAll('.link-path').data(links, (d) => `${d.source}-${d.target}`);
  sel.exit().remove();
  const enter = sel.enter().append('path').attr('class', 'link-path')
    .attr('fill', 'none').attr('marker-end', 'url(#arrow)');
  return enter.merge(sel)
    .attr('stroke', (d) => highlightedEdges.has(`${d.source}-${d.target}`) ? '#22d3ee' : (REL_COLORS[d.type] || '#3f3f46'))
    .attr('stroke-opacity', (d) => highlightedEdges.has(`${d.source}-${d.target}`) ? 0.9 : 0.2 + (d.confidence / 100) * 0.4)
    .attr('stroke-width', (d) => highlightedEdges.has(`${d.source}-${d.target}`) ? 3 : 1 + (d.confidence / 100) * 1.5)
    .attr('stroke-dasharray', (d) => d.confidence < 50 ? '4 4' : 'none');
}

function updateNodes(nodeGroup, nodes, ctx) {
  const { degree, betweenness, communities, hoveredId, pathSelection, links } = ctx;
  const sel = nodeGroup.selectAll('.node-group').data(nodes, (d) => d.id);
  sel.exit().remove();

  const enter = sel.enter().append('g').attr('class', 'node-group').attr('cursor', 'pointer');
  enter.append('circle').attr('class', 'glow-ring');
  enter.append('circle').attr('class', 'main-circle');
  enter.append('text').attr('class', 'icon-letter')
    .attr('text-anchor', 'middle').attr('dy', '0.35em')
    .attr('font-size', '9').attr('font-family', 'var(--font-mono)').attr('font-weight', 'bold');
  enter.append('text').attr('class', 'node-label')
    .attr('text-anchor', 'middle').attr('font-size', '9').attr('font-family', 'var(--font-mono)');

  const merged = enter.merge(sel);

  const isConnected = (id) => {
    if (!hoveredId) return true;
    if (id === hoveredId) return true;
    return links.some((l) => {
      const s = l.source.id || l.source, t = l.target.id || l.target;
      return (s === hoveredId && t === id) || (t === hoveredId && s === id);
    });
  };

  const nodeColor = (d) => {
    if (!communities) return '#71717a';
    return COMMUNITY_COLORS[communities.get(d.id) % COMMUNITY_COLORS.length];
  };

  merged.select('.main-circle')
    .attr('r', (d) => BASE_RADIUS + (degree.get(d.id) || 0) * 10)
    .attr('fill', nodeColor).attr('fill-opacity', (d) => hoveredId && !isConnected(d.id) ? 0.08 : 0.3)
    .attr('stroke', nodeColor).attr('stroke-width', 1.5);

  merged.select('.glow-ring')
    .attr('r', (d) => BASE_RADIUS + (degree.get(d.id) || 0) * 10 + 4)
    .attr('fill', 'none')
    .attr('stroke', (d) => pathSelection.includes(d.id) ? '#22d3ee' : 'transparent')
    .attr('stroke-width', 2)
    .attr('stroke-opacity', (d) => 0.3 + (betweenness.get(d.id) || 0) * 0.7)
    .attr('filter', (d) => (betweenness.get(d.id) || 0) > 0.3 ? 'url(#node-glow)' : 'none');

  merged.select('.icon-letter')
    .text((d) => TYPE_ICONS[d.type] || '?')
    .attr('fill', (d) => hoveredId && !isConnected(d.id) ? '#3f3f46' : '#e4e4e7');

  merged.select('.node-label')
    .text((d) => truncate(d.name))
    .attr('dy', (d) => BASE_RADIUS + (degree.get(d.id) || 0) * 10 + 14)
    .attr('fill', (d) => hoveredId && !isConnected(d.id) ? '#27272a' : '#71717a');

  return merged;
}

/**
 * Custom hook: manages D3 force simulation and SVG rendering.
 */
export default function useGraphSimulation({
  svgRef, entities, edges, degree, betweenness, communities,
  hoveredId, highlightedEdges, pathSelection, layout,
  onHover, onHoverEnd, onClick, onDblClick,
}) {
  const simRef = useRef(null);

  useEffect(() => {
    const svg = d3Selection.select(svgRef.current);
    const width = svgRef.current?.clientWidth || 600;
    const height = svgRef.current?.clientHeight || 400;

    const nodeMap = {};
    entities.forEach((e) => {
      nodeMap[e.id] = { ...e, x: width / 2 + (Math.random() - 0.5) * 100, y: height / 2 + (Math.random() - 0.5) * 100 };
    });
    const nodes = Object.values(nodeMap);
    const links = edges.filter((e) => nodeMap[e.source] && nodeMap[e.target]);

    if (nodes.length === 0) { svg.selectAll('*').remove(); return; }

    ensureDefs(svg);
    const linkMerge = updateLinks(svg.select('.links'), links, highlightedEdges);
    const nodeMerge = updateNodes(svg.select('.nodes'), nodes, {
      degree, betweenness, communities, hoveredId, pathSelection, links,
    });

    // Events
    nodeMerge.on('mouseenter', (_e, d) => onHover(d.id))
      .on('mouseleave', () => onHoverEnd())
      .on('click', (e, d) => onClick(e, d.id))
      .on('dblclick', (e, d) => onDblClick(e, d.id));

    // Drag
    let dragNode = null;
    nodeMerge.on('mousedown', (_e, d) => { dragNode = d; sim.alphaTarget(0.3).restart(); });
    svg.on('mousemove', (event) => {
      if (!dragNode) return;
      const [x, y] = d3Selection.pointer(event, svgRef.current);
      dragNode.fx = x; dragNode.fy = y;
    });
    svg.on('mouseup', () => {
      if (!dragNode) return;
      sim.alphaTarget(0); dragNode.fx = null; dragNode.fy = null; dragNode = null;
    });

    // Simulation
    const sim = d3Force.forceSimulation(nodes)
      .force('link', d3Force.forceLink(links).id((d) => d.id).distance(layout === 'grid' ? 80 : 120))
      .force('charge', d3Force.forceManyBody().strength(layout === 'radial' ? -200 : -400))
      .force('center', d3Force.forceCenter(width / 2, height / 2))
      .force('collision', d3Force.forceCollide().radius(30));

    if (layout === 'radial') {
      sim.force('radial', d3Force.forceRadial(Math.min(width, height) * 0.3, width / 2, height / 2).strength(0.5));
    }

    simRef.current = sim;
    sim.on('tick', () => {
      linkMerge.attr('d', (d) => curvedPath(d.source.x, d.source.y, d.target.x, d.target.y));
      nodeMerge.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [svgRef, entities, edges, degree, betweenness, communities, hoveredId, highlightedEdges, pathSelection, layout, onClick, onDblClick, onHover, onHoverEnd]);

  return simRef;
}
