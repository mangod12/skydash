import MapView from '../map/MapView';
import TelemetryPanel from '../telemetry/TelemetryPanel';
import AlertBar from '../telemetry/AlertBar';

export default function DashboardView() {
  return (
    <div className="h-full flex flex-col">
      <AlertBar />
      <div className="flex-1 flex min-h-0">
        {/* Map: takes most space */}
        <div className="flex-1 min-w-0 p-3 pr-0">
          <MapView />
        </div>

        {/* Telemetry sidebar */}
        <div className="w-[320px] shrink-0">
          <TelemetryPanel />
        </div>
      </div>
    </div>
  );
}
