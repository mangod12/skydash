import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useIntelStore } from '../../stores/intelStore';
import {
  findCorrelations,
  buildTimeline,
  getTimeScale,
  formatTickLabel,
} from '../../utils/temporalAnalysis';
import CorrelationLane from './CorrelationLane';
import { CorrelationHeader, EventTooltip, MAX_ENTITIES } from './CorrelationControls';

const LANE_HEIGHT = 52;
const HEADER_HEIGHT = 28;
const CORRELATION_WINDOW_MS = 5 * 60 * 1000;

export default function TimelineCorrelation() {
  const entities = useIntelStore((s) => s.entities);
  const events = useIntelStore((s) => s.events);

  const [selectedIds, setSelectedIds] = useState(
    () => new Set(entities.slice(0, MAX_ENTITIES).map((e) => e.id)),
  );
  const [range, setRange] = useState('all');
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const dragRef = useRef(null);

  const toggleEntity = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < MAX_ENTITIES) { next.add(id); }
      return next;
    });
  }, []);

  const activeEntities = useMemo(
    () => entities.filter((e) => selectedIds.has(e.id)),
    [entities, selectedIds],
  );

  const { lanes, timeRange } = useMemo(
    () => buildTimeline(activeEntities, events, range),
    [activeEntities, events, range],
  );

  const correlations = useMemo(
    () => findCorrelations(
      events.filter((e) => selectedIds.has(e.entityId)),
      CORRELATION_WINDOW_MS,
    ),
    [events, selectedIds],
  );

  const scaledWidth = containerWidth * zoom;

  const scale = useMemo(
    () => getTimeScale(timeRange.start, timeRange.end, scaledWidth),
    [timeRange, scaledWidth],
  );

  const svgHeight = HEADER_HEIGHT + activeEntities.length * LANE_HEIGHT + 8;
  const rangeDuration = timeRange.end - timeRange.start;

  const clampZoom = (z) => Math.max(1, Math.min(8, z));
  const handleZoom = useCallback((dir) => setZoom((z) => clampZoom(z + dir * 0.5)), []);
  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => clampZoom(z + (e.deltaY < 0 ? 0.3 : -0.3)));
  }, []);
  const handleMouseDown = useCallback((e) => {
    if (e.button === 0) dragRef.current = { startX: e.clientX, startPan: panOffset };
  }, [panOffset]);
  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    setPanOffset(dragRef.current.startPan + (e.clientX - dragRef.current.startX));
  }, []);
  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseUp, handleMouseMove]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const update = () => setContainerWidth(el.clientWidth || 800);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleHover = useCallback((evt, entity, e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 8,
      event: evt,
      entity,
    });
  }, []);

  const handleLeave = useCallback(() => setTooltip(null), []);

  const entityLaneMap = useMemo(() => {
    const map = {};
    activeEntities.forEach((e, i) => {
      map[e.id] = HEADER_HEIGHT + i * LANE_HEIGHT + LANE_HEIGHT / 2;
    });
    return map;
  }, [activeEntities]);

  return (
    <div className="h-full flex flex-col">
      <CorrelationHeader
        range={range}
        setRange={setRange}
        zoom={zoom}
        onZoom={handleZoom}
        entities={entities}
        selectedIds={selectedIds}
        toggleEntity={toggleEntity}
        selectorOpen={selectorOpen}
        setSelectorOpen={setSelectorOpen}
        correlationCount={correlations.length}
      />

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <svg
          ref={svgRef}
          width={scaledWidth}
          height={svgHeight}
          style={{ transform: `translateX(${panOffset}px)` }}
          className="select-none"
        >
          {/* Time axis ticks */}
          {scale.tickMarks.map((t) => {
            const x = scale.toX(t);
            return (
              <g key={t}>
                <line x1={x} y1={0} x2={x} y2={svgHeight}
                  stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                <text x={x} y={12} fill="rgba(161,161,170,0.5)" fontSize={8}
                  fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                  {formatTickLabel(t, rangeDuration)}
                </text>
              </g>
            );
          })}

          {/* Correlation connector lines */}
          {correlations.map((corr, ci) => (
            <g key={ci}>
              {corr.events.map((evt, ei) => {
                const x = scale.toX(evt.time);
                const y = entityLaneMap[evt.entityId];
                if (y == null) return null;
                const nextEvt = corr.events[ei + 1];
                const nextY = nextEvt ? entityLaneMap[nextEvt.entityId] : null;
                if (nextY == null) return null;
                return (
                  <line key={`${ci}-${ei}`}
                    x1={x} y1={y} x2={scale.toX(nextEvt.time)} y2={nextY}
                    stroke="rgba(139,92,246,0.35)" strokeWidth={1.5}
                    strokeDasharray="4,3" />
                );
              })}
            </g>
          ))}

          {/* Entity lanes */}
          {lanes.map((lane, i) => (
            <CorrelationLane
              key={lane.entity.id}
              entity={lane.entity}
              events={lane.events}
              y={HEADER_HEIGHT + i * LANE_HEIGHT}
              laneHeight={LANE_HEIGHT}
              toX={scale.toX}
              onHover={handleHover}
              onLeave={handleLeave}
            />
          ))}
        </svg>

        {tooltip && <EventTooltip tooltip={tooltip} />}
      </div>
    </div>
  );
}
