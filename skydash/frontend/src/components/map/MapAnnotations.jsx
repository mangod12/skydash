import { useCallback } from 'react';
import { Marker, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import { useMapStore } from '../../stores/mapStore';
import AnnotationHandler from './AnnotationHandler';

const INDIGO = '#6366f1';

function makeTextIcon(label) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:rgba(24,24,27,0.85);backdrop-filter:blur(12px);
      border:1px solid rgba(99,102,241,0.35);border-radius:6px;
      padding:2px 8px;color:#a5b4fc;font-size:12px;
      font-family:'Inter',sans-serif;white-space:nowrap;
      pointer-events:auto;
    ">${label}</div>`,
    iconAnchor: [0, 0],
  });
}

function makePinIcon(number) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:${INDIGO};border:2px solid #a5b4fc;
      color:#fff;font-size:11px;font-weight:700;
      font-family:'JetBrains Mono','monospace';
      display:flex;align-items:center;justify-content:center;
      pointer-events:auto;box-shadow:0 0 8px rgba(99,102,241,0.4);
    ">${number}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function arrowHead(start, end) {
  const dx = end[1] - start[1];
  const dy = end[0] - start[0];
  const angle = Math.atan2(dy, dx);
  const len = 0.0008;
  const spread = 0.5;
  return [
    [end[0] - len * Math.sin(angle + spread), end[1] - len * Math.cos(angle + spread)],
    end,
    [end[0] - len * Math.sin(angle - spread), end[1] - len * Math.cos(angle - spread)],
  ];
}

function TextAnnotation({ ann, onContextMenu }) {
  return (
    <Marker
      position={ann.positions[0]}
      icon={makeTextIcon(ann.label)}
      eventHandlers={{ contextmenu: onContextMenu }}
    />
  );
}

function PinAnnotation({ ann, onContextMenu }) {
  return (
    <Marker
      position={ann.positions[0]}
      icon={makePinIcon(ann.label)}
      eventHandlers={{ contextmenu: onContextMenu }}
    />
  );
}

function ArrowAnnotation({ ann, onContextMenu }) {
  const [start, end] = ann.positions;
  const head = arrowHead(start, end);
  return (
    <>
      <Polyline
        positions={ann.positions}
        pathOptions={{ color: INDIGO, weight: 2.5, opacity: 0.85 }}
        eventHandlers={{ contextmenu: onContextMenu }}
      />
      <Polyline
        positions={head}
        pathOptions={{ color: INDIGO, weight: 2.5, opacity: 0.85 }}
      />
    </>
  );
}

function CircleAnnotation({ ann, onContextMenu }) {
  return (
    <Circle
      center={ann.positions[0]}
      radius={ann.radius}
      pathOptions={{ color: INDIGO, fillColor: INDIGO, fillOpacity: 0.08, weight: 1.5 }}
      eventHandlers={{ contextmenu: onContextMenu }}
    />
  );
}

const RENDERERS = { text: TextAnnotation, pin: PinAnnotation, arrow: ArrowAnnotation, circle: CircleAnnotation };

export default function MapAnnotations() {
  const annotations = useMapStore((s) => s.annotations);
  const removeAnnotation = useMapStore((s) => s.removeAnnotation);

  const handleContextMenu = useCallback((id) => (e) => {
    e.originalEvent?.preventDefault?.();
    removeAnnotation(id);
  }, [removeAnnotation]);

  return (
    <>
      <AnnotationHandler />
      {annotations.map((ann) => {
        const Renderer = RENDERERS[ann.type];
        if (!Renderer) return null;
        return <Renderer key={ann.id} ann={ann} onContextMenu={handleContextMenu(ann.id)} />;
      })}
    </>
  );
}
