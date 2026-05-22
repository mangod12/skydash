import { useCallback } from 'react';
import { useMapEvents, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import { useMapStore } from '../../stores/mapStore';
import { calculateBearing, calculateDistance, midpoint, formatBearing, formatDistance } from '../../utils/bearing';

/**
 * BearingTool — map event handler for drawing bearing lines
 * Click two points to create a bearing line. Max 5 lines.
 */
export default function BearingTool({ active, pendingPoint, onSetPending }) {
  const addBearingLine = useMapStore((s) => s.addBearingLine);
  const bearingLines = useMapStore((s) => s.bearingLines);
  const removeBearingLine = useMapStore((s) => s.removeBearingLine);

  useMapEvents({
    click(e) {
      if (!active) return;
      const point = { lat: e.latlng.lat, lng: e.latlng.lng };

      if (!pendingPoint) {
        onSetPending(point);
      } else {
        if (bearingLines.length >= 5) return;
        addBearingLine({ start: pendingPoint, end: point });
        onSetPending(null);
      }
    },
  });

  const handleContextMenu = useCallback((id) => (e) => {
    e.originalEvent?.preventDefault?.();
    removeBearingLine(id);
  }, [removeBearingLine]);

  if (!active && bearingLines.length === 0) return null;

  return (
    <>
      {/* Pending point marker */}
      {active && pendingPoint && (
        <CircleMarker
          center={[pendingPoint.lat, pendingPoint.lng]}
          radius={5}
          pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]} className="bearing-tooltip">
            <span className="font-mono text-[10px]">START</span>
          </Tooltip>
        </CircleMarker>
      )}

      {/* Rendered bearing lines */}
      {bearingLines.map((line) => {
        const { start, end, id } = line;
        const mid = midpoint(start.lat, start.lng, end.lat, end.lng);
        const bearing = calculateBearing(start.lat, start.lng, end.lat, end.lng);
        const dist = calculateDistance(start.lat, start.lng, end.lat, end.lng, 'km');

        return (
          <BearingLineOverlay
            key={id}
            start={start}
            end={end}
            mid={mid}
            bearing={bearing}
            distance={dist}
            onContextMenu={handleContextMenu(id)}
          />
        );
      })}
    </>
  );
}

function BearingLineOverlay({ start, end, mid, bearing, distance, onContextMenu }) {
  return (
    <>
      {/* Dashed line */}
      <Polyline
        positions={[[start.lat, start.lng], [end.lat, end.lng]]}
        pathOptions={{
          color: '#06b6d4',
          weight: 2,
          dashArray: '8 6',
          opacity: 0.85,
        }}
        eventHandlers={{ contextmenu: onContextMenu }}
      />

      {/* Arrowhead at end */}
      <ArrowHead start={start} end={end} />

      {/* Start marker */}
      <CircleMarker
        center={[start.lat, start.lng]}
        radius={4}
        pathOptions={{ color: '#06b6d4', fillColor: '#0e7490', fillOpacity: 1, weight: 2 }}
      >
        <Tooltip permanent direction="bottom" offset={[0, 6]} className="bearing-tooltip">
          <span className="font-mono text-[9px]">
            {start.lat.toFixed(4)}, {start.lng.toFixed(4)}
          </span>
        </Tooltip>
      </CircleMarker>

      {/* End marker */}
      <CircleMarker
        center={[end.lat, end.lng]}
        radius={4}
        pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 1, weight: 2 }}
      >
        <Tooltip permanent direction="bottom" offset={[0, 6]} className="bearing-tooltip">
          <span className="font-mono text-[9px]">
            {end.lat.toFixed(4)}, {end.lng.toFixed(4)}
          </span>
        </Tooltip>
      </CircleMarker>

      {/* Midpoint label */}
      <CircleMarker
        center={[mid.lat, mid.lng]}
        radius={0}
        pathOptions={{ opacity: 0, fillOpacity: 0 }}
      >
        <Tooltip permanent direction="top" offset={[0, -4]} className="bearing-tooltip">
          <span className="font-mono text-[10px] font-bold">
            {formatBearing(bearing)} | {formatDistance(distance, 'km')}
          </span>
        </Tooltip>
      </CircleMarker>
    </>
  );
}

function ArrowHead({ start, end }) {
  const bearing = calculateBearing(start.lat, start.lng, end.lat, end.lng);
  const rad = (bearing * Math.PI) / 180;
  const arrowLen = 0.0008; // degrees offset for arrowhead

  const tip = [end.lat, end.lng];
  const left = [
    end.lat - arrowLen * Math.cos(rad - Math.PI / 6),
    end.lng - arrowLen * Math.sin(rad - Math.PI / 6),
  ];
  const right = [
    end.lat - arrowLen * Math.cos(rad + Math.PI / 6),
    end.lng - arrowLen * Math.sin(rad + Math.PI / 6),
  ];

  return (
    <Polyline
      positions={[left, tip, right]}
      pathOptions={{
        color: '#06b6d4',
        weight: 2,
        opacity: 0.9,
        fill: false,
      }}
    />
  );
}
