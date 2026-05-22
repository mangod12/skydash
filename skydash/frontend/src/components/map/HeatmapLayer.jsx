import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useIntelStore } from '../../stores/intelStore';

const DEFAULT_GRADIENT = {
  0.0: 'rgba(0, 0, 255, 0)',
  0.2: 'rgba(0, 0, 255, 0.3)',
  0.4: 'rgba(0, 255, 255, 0.5)',
  0.6: 'rgba(0, 255, 0, 0.5)',
  0.8: 'rgba(255, 255, 0, 0.6)',
  1.0: 'rgba(255, 0, 0, 0.7)',
};

const DEFAULTS = { radius: 25, blur: 15, maxOpacity: 0.6 };

const THREAT_INTENSITY = {
  critical: 1.0, high: 0.8, medium: 0.5, low: 0.3, none: 0.15,
};

function buildGradientData(gradient) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  Object.entries(gradient).forEach(([stop, color]) => grad.addColorStop(+stop, color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, 256);
  return ctx.getImageData(0, 0, 1, 256).data;
}

function generateEntityHeatPoints(entities, events) {
  const points = [];
  const eventCounts = {};
  events.forEach((e) => {
    if (e.entityId) eventCounts[e.entityId] = (eventCounts[e.entityId] || 0) + 1;
  });

  entities.filter((e) => e.coordinates).forEach((entity) => {
    const base = THREAT_INTENSITY[entity.threatLevel] ?? 0.2;
    const evtBoost = Math.min((eventCounts[entity.id] || 0) * 0.08, 0.3);
    const intensity = Math.min(base + evtBoost, 1.0);
    const [lat, lng] = entity.coordinates;
    points.push({ lat, lng, intensity });

    // Scatter points around entity for density effect
    const count = Math.floor(intensity * 8) + 2;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = (0.0005 + Math.random() * 0.001) * (1 + intensity);
      points.push({
        lat: lat + Math.cos(angle) * dist,
        lng: lng + Math.sin(angle) * dist,
        intensity: intensity * (0.3 + Math.random() * 0.4),
      });
    }
  });

  return points;
}

export default function HeatmapLayer({ visible = true, points: externalPoints, options = {} }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const debounceRef = useRef(null);
  const entities = useIntelStore((s) => s.entities);
  const events = useIntelStore((s) => s.events);

  const config = { ...DEFAULTS, ...options };
  const gradient = options.gradient || DEFAULT_GRADIENT;
  const gradientDataRef = useRef(null);

  const points = externalPoints || generateEntityHeatPoints(entities, events);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map || points.length === 0) return;

    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.width = size.x + 'px';
    canvas.style.height = size.y + 'px';

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size.x, size.y);

    // Draw intensity circles to offscreen shadow canvas
    const shadow = document.createElement('canvas');
    shadow.width = size.x;
    shadow.height = size.y;
    const sCtx = shadow.getContext('2d');

    points.forEach((pt) => {
      const px = map.latLngToContainerPoint([pt.lat, pt.lng]);
      const r = config.radius + config.blur;
      const grad = sCtx.createRadialGradient(px.x, px.y, config.radius * 0.1, px.x, px.y, r);
      grad.addColorStop(0, `rgba(0,0,0,${pt.intensity})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sCtx.globalCompositeOperation = 'lighter';
      sCtx.fillStyle = grad;
      sCtx.beginPath();
      sCtx.arc(px.x, px.y, r, 0, Math.PI * 2);
      sCtx.fill();
    });

    // Colorize using gradient lookup
    if (!gradientDataRef.current) {
      gradientDataRef.current = buildGradientData(gradient);
    }
    const gData = gradientDataRef.current;
    const imgData = sCtx.getImageData(0, 0, size.x, size.y);
    const pixels = imgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha === 0) continue;
      const idx = Math.min(alpha, 255) * 4;
      pixels[i] = gData[idx];
      pixels[i + 1] = gData[idx + 1];
      pixels[i + 2] = gData[idx + 2];
      pixels[i + 3] = Math.min(alpha * config.maxOpacity * 2, 255);
    }

    ctx.putImageData(imgData, 0, 0);
  }, [map, points, config.radius, config.blur, config.maxOpacity, gradient]);

  const debouncedDraw = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      rafRef.current = requestAnimationFrame(draw);
    }, 60);
  }, [draw]);

  // Set up canvas overlay
  useEffect(() => {
    if (!visible) return;

    const pane = map.getPane('overlayPane');
    const canvas = L.DomUtil.create('canvas', 'heatmap-canvas', pane);
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '250';
    canvasRef.current = canvas;

    const reposition = () => {
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);
    };

    reposition();
    draw();

    map.on('moveend', reposition);
    map.on('moveend', debouncedDraw);
    map.on('zoomend', debouncedDraw);
    map.on('resize', debouncedDraw);

    return () => {
      map.off('moveend', reposition);
      map.off('moveend', debouncedDraw);
      map.off('zoomend', debouncedDraw);
      map.off('resize', debouncedDraw);
      clearTimeout(debounceRef.current);
      cancelAnimationFrame(rafRef.current);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvasRef.current = null;
    };
  }, [map, visible, draw, debouncedDraw]);

  return null;
}
