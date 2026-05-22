import MapView from '../map/MapView';
import AlertBar from '../telemetry/AlertBar';

export default function FullMapView() {
  return (
    <div className="h-full flex flex-col">
      <AlertBar />
      <div className="flex-1 min-h-0 p-3">
        <MapView />
      </div>
    </div>
  );
}
