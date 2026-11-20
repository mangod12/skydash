import { useTelemetryStore } from '../../stores/telemetryStore';
import { finiteReading, percentReading } from '../../utils/telemetryReadings';

// No per-drone received history is kept by this component. Never invent one from a snapshot
// or repeat the selected drone's voltage/altitude trail under other aircraft identities.
export default function FleetSparklines({ limit = null }) {
  const fleet = useTelemetryStore(state => state.fleet);
  const connected = useTelemetryStore(state => state.isConnected);
  const shown = limit === null ? fleet : fleet.slice(0, limit);
  return <section aria-label="Latest fleet snapshot readings" className="space-y-2 text-xs text-zinc-400">
    <p className="text-[10px]">Latest received fleet snapshot, not history or a recorded-flight review. Values may be stale. No synthetic trend or voltage-to-percentage conversion.</p>
    {!connected && <p className="text-amber-300">Disconnected. Retained snapshot is not current telemetry.</p>}
    {!fleet.length && <p>No received fleet readings. No placeholder aircraft or readings.</p>}
    {shown.length < fleet.length && <p>Showing first {shown.length} of {fleet.length} snapshot entries.</p>}
    <div className="space-y-2">{shown.map((drone, index) => <div key={`${drone.drone_id}-${index}`} className="rounded border border-white/10 p-2 space-y-1 min-w-0" aria-label={`Fleet snapshot ${drone.drone_id}`}>
      <h4 className="font-mono text-cyan-200 break-all">{drone.drone_id}</h4>
      <div className="flex flex-wrap gap-x-4 gap-y-1"><span>Source altitude: {finiteReading(drone.altitude) ? `${drone.altitude.toFixed(1)}m` : 'unknown'}</span><span>Battery: {percentReading(drone.battery_percentage) ? `${drone.battery_percentage.toFixed(1)}%` : 'unknown'}</span></div>
      <p className="text-[10px] break-words">Source timestamp (unverified units/time basis): {finiteReading(drone.timestamp) ? String(drone.timestamp) : 'unknown'}. Altitude datum unverified.</p>
    </div>)}</div>
  </section>;
}
