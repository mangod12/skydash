import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useIntelStore } from '../../stores/intelStore';
import { degreeCentrality, betweennessCentrality, shortestPath, detectCommunities, getNeighborhood } from '../../utils/graphUtils';
import useGraphSimulation from '../../hooks/useGraphSimulation';
import GraphToolbar from './GraphToolbar';

const REL_COLORS = {
  located_at: '#6366f1', associated_with: '#f59e0b', traveled_to: '#22d3ee',
  owns: '#10b981', communicates_with: '#8b5cf6',
};
const FALLBACK_RELATIONSHIP_LIMIT = 10;

function toEdge(r) {
  return {
    source: r.from ?? r.source ?? r.from_entity,
    target: r.to ?? r.target ?? r.to_entity,
    type: r.type,
    confidence: r.confidence ?? 50,
  };
}

function distanceSq(a, b) {
  const [alat, alng] = a.coordinates ?? [];
  const [blat, blng] = b.coordinates ?? [];
  if (alat == null || alng == null || blat == null || blng == null) return Number.POSITIVE_INFINITY;
  return (alat - blat) ** 2 + (alng - blng) ** 2;
}

function deriveFallbackRelationships(entities) {
  const hubs = entities
    .filter((entity) => entity.threatLevel === 'critical' || entity.threatLevel === 'high')
    .slice(0, 2);
  const pairs = [];

  hubs.forEach((hub) => {
    entities
      .filter((entity) => entity.id !== hub.id)
      .sort((a, b) => distanceSq(hub, a) - distanceSq(hub, b))
      .slice(0, 4)
      .forEach((entity) => {
        pairs.push({
          from: entity.id,
          to: hub.id,
          type: entity.type === 'vehicle' ? 'traveled_to' : 'associated_with',
          confidence: Math.max(45, Math.min(90, entity.confidence ?? 60)),
        });
      });
  });

  return pairs.slice(0, FALLBACK_RELATIONSHIP_LIMIT);
}

export default function LinkGraph() {
  const svgRef = useRef(null);
  const allEntities = useIntelStore((s) => s.entities);
  const allRelationships = useIntelStore((s) => s.relationships);
  const selectEntity = useIntelStore((s) => s.selectEntity);

  const [focusedId, setFocusedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [pathSelection, setPathSelection] = useState([]);
  const [layout, setLayout] = useState('force');
  const [expanded, setExpanded] = useState(true);
  const [showCommunities, setShowCommunities] = useState(false);

  const graphRelationships = useMemo(() => {
    const entityIds = new Set(allEntities.map((entity) => entity.id));
    const validRelationships = allRelationships.filter((relationship) => {
      const edge = toEdge(relationship);
      return entityIds.has(edge.source) && entityIds.has(edge.target);
    });

    return validRelationships.length > 0
      ? validRelationships
      : deriveFallbackRelationships(allEntities);
  }, [allEntities, allRelationships]);
  const allEdges = useMemo(() => graphRelationships.map(toEdge), [graphRelationships]);

  // 2-hop neighborhood filter
  const { entities, relationships } = useMemo(() => {
    if (!focusedId) return { entities: allEntities, relationships: graphRelationships };
    const hood = getNeighborhood(allEdges, focusedId, 2);
    return {
      entities: allEntities.filter((e) => hood.has(e.id)),
      relationships: graphRelationships.filter((r) => {
        const edge = toEdge(r);
        return hood.has(edge.source) && hood.has(edge.target);
      }),
    };
  }, [allEntities, graphRelationships, allEdges, focusedId]);

  // Graph metrics
  const edges = useMemo(() => relationships.map(toEdge), [relationships]);
  const degree = useMemo(() => degreeCentrality(entities, edges), [entities, edges]);
  const betweenness = useMemo(() => betweennessCentrality(entities, edges), [entities, edges]);
  const communities = useMemo(
    () => showCommunities ? detectCommunities(entities, edges) : null,
    [entities, edges, showCommunities],
  );

  // Shortest path between shift-clicked pair
  const highlightedPath = useMemo(() => {
    if (pathSelection.length !== 2) return null;
    return shortestPath(edges, pathSelection[0], pathSelection[1]);
  }, [pathSelection, edges]);

  const highlightedEdges = useMemo(() => {
    if (!highlightedPath || highlightedPath.length < 2) return new Set();
    const set = new Set();
    for (let i = 0; i < highlightedPath.length - 1; i++) {
      set.add(`${highlightedPath[i]}-${highlightedPath[i + 1]}`);
      set.add(`${highlightedPath[i + 1]}-${highlightedPath[i]}`);
    }
    return set;
  }, [highlightedPath]);

  // Callbacks
  const onHover = useCallback((id) => setHoveredId(id), []);
  const onHoverEnd = useCallback(() => setHoveredId(null), []);

  const onClick = useCallback((event, id) => {
    if (event.shiftKey) {
      setPathSelection((prev) => prev.length >= 2 ? [id] : [...prev, id]);
    } else {
      setPathSelection([]);
      selectEntity(id);
    }
  }, [selectEntity]);

  const onDblClick = useCallback((_event, id) => {
    setFocusedId((prev) => prev === id ? null : id);
  }, []);

  // D3 simulation hook
  const simRef = useGraphSimulation({
    svgRef, entities, edges, degree, betweenness, communities,
    hoveredId, highlightedEdges, pathSelection, layout,
    onHover, onHoverEnd, onClick, onDblClick,
  });

  const zoomFit = useCallback(() => {
    if (simRef.current) simRef.current.alpha(0.3).restart();
  }, [simRef]);

  // ESC to clear focus + path
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setFocusedId(null); setPathSelection([]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          LINK ANALYSIS
        </h3>
        <div className="flex gap-2">
          {Object.entries(REL_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[8px] text-zinc-600 uppercase">{type.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 relative bg-zinc-950/50">
        <svg ref={svgRef} className="w-full h-full" style={{ minHeight: 300 }} />
        <GraphToolbar
          layout={layout} onLayoutChange={setLayout} onZoomFit={zoomFit}
          onExpandAll={() => setExpanded((p) => !p)} expanded={expanded}
          communities={showCommunities} onToggleCommunities={() => setShowCommunities((p) => !p)}
          focusedId={focusedId} onClearFocus={() => setFocusedId(null)}
          focusName={allEntities.find((e) => e.id === focusedId)?.name}
        />
        {!focusedId && (
          <div className="absolute bottom-2 left-3 text-[9px] text-zinc-700 pointer-events-none">
            Dbl-click: 2-hop focus | Shift+click two nodes: shortest path
          </div>
        )}
      </div>
    </div>
  );
}
