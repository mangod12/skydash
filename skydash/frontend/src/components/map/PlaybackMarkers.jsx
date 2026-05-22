import { useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { usePlaybackStore } from '../../stores/playbackStore';

const GHOST_COLORS = {
  'DRONE-01': '#6366f1',
  'DRONE-02': '#22d3ee',
  'DRONE-03': '#f59e0b',
};

function createGhostIcon(color, heading = 0) {
  return L.divIcon({
    className: '',
    html: `
      <div style="width:40px;height:40px;position:relative;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:50%;border:1px dashed ${color}50;animation:ghostPulse 2s ease-out infinite;"></div>
        <div style="width:28px;height:28px;border-radius:50%;border:1.5px solid ${color}70;display:flex;align-items:center;justify-content:center;background:rgba(9,9,11,0.6);box-shadow:0 0 14px ${color}30;">
          <svg width="16" height="16" viewBox="0 0 16 16" style="transform:rotate(${heading}deg);opacity:0.8;">
            <polygon points="8,2 5,12 8,10 11,12" fill="${color}" stroke="rgba(255,255,255,0.25)" stroke-width="0.4"/>
          </svg>
        </div>
      </div>
      <style>@keyframes ghostPulse{0%{transform:scale(1);opacity:0.4}100%{transform:scale(1.8);opacity:0}}</style>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function formatAlt(alt) {
  return alt != null ? `${alt.toFixed(0)}m` : '--';
}

function formatBat(bat) {
  return bat != null ? `${bat.toFixed(1)}V` : '--';
}

export default function PlaybackMarkers() {
  const active = usePlaybackStore((s) => s.active);
  const _isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const getCurrentSnapshot = usePlaybackStore((s) => s.getCurrentSnapshot);

  const snapshot = useMemo(() => {
    if (!active) return null;
    return getCurrentSnapshot();
  }, [active, currentTime, getCurrentSnapshot]);

  if (!active || !snapshot) return null;

  return (
    <>
      {snapshot.positions.map((pos) => {
        const color = GHOST_COLORS[pos.droneId] || '#6366f1';
        const icon = createGhostIcon(color, pos.heading ?? 0);

        return (
          <Marker
            key={`pb-${pos.droneId}`}
            position={[pos.lat, pos.lng]}
            icon={icon}
          >
            <Tooltip direction="top" offset={[0, -22]} permanent={false}>
              <div className="text-[10px] font-mono">
                <div className="font-bold opacity-70">
                  {pos.droneId} <span className="text-[8px]">(PLAYBACK)</span>
                </div>
                <div>
                  {formatAlt(pos.alt)} | {formatBat(pos.battery)} | {pos.speed?.toFixed(1)}m/s
                </div>
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
