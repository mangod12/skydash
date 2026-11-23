import { PanelBoundary } from '../common/ErrorBoundary';
import TelemetryPanel from '../telemetry/TelemetryPanel';
import DroneCommandPanel from '../telemetry/DroneCommandPanel';
import MapView from '../map/MapView';
import AlertBar from '../telemetry/AlertBar';
import ReplayBar from '../telemetry/ReplayBar';

export default function TelemetryView() {
  return (
    <div className="h-full flex flex-col">
      <AlertBar />
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto md:overflow-visible">
        {/* Map (smaller) */}
        <div className="h-64 shrink-0 md:h-auto md:shrink md:flex-1 min-w-0 p-3 md:pr-0">
          <PanelBoundary name="Map">
            <MapView variant="telemetry" />
          </PanelBoundary>
        </div>

        {/* Telemetry + Command panel */}
        <div className="w-full md:w-[380px] shrink-0 flex flex-col md:overflow-y-auto">
          <div className="shrink-0">
            <PanelBoundary name="Telemetry">
              <TelemetryPanel />
            </PanelBoundary>
            <div className="px-3 pb-3">
              <PanelBoundary name="Replay">
                <ReplayBar />
              </PanelBoundary>
            </div>
          </div>
          <div className="p-3 pt-0">
            <PanelBoundary name="Drone Command">
              <DroneCommandPanel />
            </PanelBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
