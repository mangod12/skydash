import { useMemo } from 'react';
import { Circle, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import { useScenarioStore } from '../../stores/scenarioStore';
import { buildScenarioFrame } from '../../utils/scenarioEngine';

const SEVERITY = {
  info: { color: '#22d3ee', radius: 7 },
  warning: { color: '#f59e0b', radius: 9 },
  critical: { color: '#ef4444', radius: 11 },
};

function useScenarioFrame() {
  const activeScenarioId = useScenarioStore((s) => s.activeScenarioId);
  const selectedFleetPresetId = useScenarioStore((s) => s.selectedFleetPresetId);
  const elapsedSeconds = useScenarioStore((s) => s.elapsedSeconds);
  const injectedEvents = useScenarioStore((s) => s.injectedEvents);

  return useMemo(
    () => buildScenarioFrame({ activeScenarioId, selectedFleetPresetId, elapsedSeconds, injectedEvents }),
    [activeScenarioId, selectedFleetPresetId, elapsedSeconds, injectedEvents],
  );
}

export default function ScenarioOverlay({ frame: providedFrame, showIdle = false, compact = false }) {
  const status = useScenarioStore((s) => s.status);
  const storeFrame = useScenarioFrame();
  const frame = providedFrame || storeFrame;

  if (!showIdle && status === 'idle') return null;

  const { scenario, fleet, paths, events } = frame;

  return (
    <>
      <Circle
        center={scenario.center}
        radius={scenario.radiusM}
        pathOptions={{
          color: scenario.accent,
          fillColor: scenario.accent,
          fillOpacity: compact ? 0.035 : 0.025,
          weight: compact ? 1 : 1.5,
          opacity: 0.55,
          dashArray: '6 8',
        }}
      />

      {paths.map((path) => (
        <Polyline
          key={`scenario-path-${path.droneId}`}
          positions={path.points}
          pathOptions={{
            color: path.color,
            weight: compact ? 2 : 3,
            opacity: compact ? 0.45 : 0.55,
            dashArray: '8 10',
          }}
        />
      ))}

      {fleet.map((drone) => {
        const position = [drone.gps.latitude, drone.gps.longitude];
        return (
          <span key={drone.drone_id}>
            <Circle
              center={position}
              radius={drone.sensorRadiusM}
              pathOptions={{
                color: drone.color,
                fillColor: drone.color,
                fillOpacity: compact ? 0.035 : 0.045,
                weight: 1,
                opacity: 0.35,
              }}
            />
            <CircleMarker
              center={position}
              radius={compact ? 6 : 8}
              pathOptions={{
                color: drone.color,
                fillColor: drone.color,
                fillOpacity: 0.85,
                weight: 2,
                opacity: 0.95,
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} permanent={false}>
                <div className="text-[10px] font-mono space-y-0.5">
                  <div className="font-bold text-[11px]">{drone.drone_id}</div>
                  <div style={{ color: drone.color }}>{drone.profileName}</div>
                  <div className="text-zinc-500">
                    {drone.battery_percentage}% BAT | {drone.signal_strength}% SIG
                  </div>
                  <div className="text-zinc-600">{drone.payload}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          </span>
        );
      })}

      {events.map((event) => {
        const style = SEVERITY[event.severity] || SEVERITY.info;
        return (
          <CircleMarker
            key={`scenario-event-${event.id}`}
            center={event.coordinates}
            radius={compact ? Math.max(5, style.radius - 2) : style.radius}
            pathOptions={{
              color: style.color,
              fillColor: style.color,
              fillOpacity: event.injected ? 0.55 : 0.35,
              weight: event.injected ? 3 : 2,
              opacity: 0.95,
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} permanent={false}>
              <div className="text-[10px] font-mono space-y-0.5">
                <div className="font-bold text-[11px]">{event.label}</div>
                <div style={{ color: style.color }}>
                  {event.type.toUpperCase()} | {event.severity.toUpperCase()}
                </div>
                <div className="text-zinc-500">
                  T+{String(Math.round(event.time)).padStart(3, '0')}s
                  {event.injected ? ' | INJECTED' : ''}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
