import TelemetryPanel from '../telemetry/TelemetryPanel';
import DroneCommandPanel from '../telemetry/DroneCommandPanel';
import MapView from '../map/MapView';
import AlertBar from '../telemetry/AlertBar';

export default function TelemetryView() {
  return (
    <div className="h-full flex flex-col">
      <AlertBar />
      <div className="flex-1 flex min-h-0">
        {/* Map (smaller) */}
        <div className="flex-1 min-w-0 p-3 pr-0">
          <MapView />
        </div>

        {/* Telemetry + Command panel */}
        <div className="w-[380px] shrink-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <TelemetryPanel />
          </div>
          <div className="p-3 pt-0">
            <DroneCommandPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
