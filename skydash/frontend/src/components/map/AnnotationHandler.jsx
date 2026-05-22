import { useState, useEffect, useCallback } from 'react';
import { Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useMapStore } from '../../stores/mapStore';
import { sanitizeLabel } from '../../utils/sanitize';

const INDIGO = '#6366f1';

function makeTempIcon(char) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:${INDIGO};border:2px solid #a5b4fc;
      color:#fff;font-size:11px;font-weight:700;
      font-family:'JetBrains Mono','monospace';
      display:flex;align-items:center;justify-content:center;
      pointer-events:auto;box-shadow:0 0 8px rgba(99,102,241,0.4);
    ">${sanitizeLabel(String(char))}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function TextInput({ position, onSubmit, onCancel }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const icon = L.divIcon({
    className: '',
    html: '<div style="pointer-events:auto;"></div>',
    iconAnchor: [0, 0],
  });

  return (
    <>
      <Marker position={position} icon={icon} />
      <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 pointer-events-none">
        <form
          className="pointer-events-auto bg-zinc-950/90 backdrop-blur-xl border border-indigo-500/30 rounded-lg px-3 py-2 flex gap-2 items-center"
          onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); }}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Label text..."
            className="bg-transparent text-sm text-zinc-200 outline-none w-40 placeholder-zinc-600"
          />
          <button type="submit" className="text-[10px] tracking-wider font-semibold text-indigo-400 hover:text-indigo-300">
            PLACE
          </button>
        </form>
      </div>
    </>
  );
}

export default function AnnotationHandler() {
  const { annotationMode, addAnnotation, annotations } = useMapStore();
  const [arrowStart, setArrowStart] = useState(null);
  const [circleCenter, setCircleCenter] = useState(null);
  const [textPos, setTextPos] = useState(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        useMapStore.getState().setAnnotationMode(null);
        setArrowStart(null);
        setCircleCenter(null);
        setTextPos(null);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  useMapEvents({
    click(e) {
      if (!annotationMode) return;
      const pt = [e.latlng.lat, e.latlng.lng];

      if (annotationMode === 'text') { setTextPos(pt); return; }

      if (annotationMode === 'pin') {
        const pinCount = annotations.filter((a) => a.type === 'pin').length;
        addAnnotation({ type: 'pin', positions: [pt], label: String(pinCount + 1), color: INDIGO });
        return;
      }

      if (annotationMode === 'arrow') {
        if (!arrowStart) { setArrowStart(pt); } else {
          addAnnotation({ type: 'arrow', positions: [arrowStart, pt], color: INDIGO });
          setArrowStart(null);
        }
        return;
      }

      if (annotationMode === 'circle') {
        if (!circleCenter) { setCircleCenter(pt); } else {
          const R = 6371000;
          const dLat = (pt[0] - circleCenter[0]) * Math.PI / 180;
          const dLng = (pt[1] - circleCenter[1]) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(circleCenter[0] * Math.PI / 180) * Math.cos(pt[0] * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
          const radius = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          addAnnotation({ type: 'circle', positions: [circleCenter], radius: Math.round(radius), color: INDIGO });
          setCircleCenter(null);
        }
      }
    },
  });

  const handleTextSubmit = useCallback((label) => {
    if (textPos) useMapStore.getState().addAnnotation({ type: 'text', positions: [textPos], label, color: INDIGO });
    setTextPos(null);
  }, [textPos]);

  const handleTextCancel = useCallback(() => setTextPos(null), []);

  return (
    <>
      {textPos && <TextInput position={textPos} onSubmit={handleTextSubmit} onCancel={handleTextCancel} />}
      {arrowStart && <Marker position={arrowStart} icon={makeTempIcon('A')} interactive={false} />}
      {circleCenter && <Marker position={circleCenter} icon={makeTempIcon('C')} interactive={false} />}
    </>
  );
}
