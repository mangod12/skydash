import TelemetryPanel from '../telemetry/TelemetryPanel';
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

        {/* Telemetry (wider) */}
        <div className="w-[380px] shrink-0">
          <TelemetryPanel />
        </div>
      </div>
    </div>
  );
}
