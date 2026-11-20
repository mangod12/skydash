import { satelliteReading } from '../../utils/telemetryReadings';
import { useTelemetryStore } from '../../stores/telemetryStore';

// A count alone cannot establish satellite locations, signal strength or navigation quality.
export default function GpsSkyView() {
  const data = useTelemetryStore(state => state.data);
  const connected = useTelemetryStore(state => state.isConnected);
  const count = data?.gps?.satellites;
  return <section aria-label="Reported GPS satellite count" className="space-y-2">
    <div className="flex flex-wrap justify-between items-baseline gap-2">
      <span className="text-[10px] font-semibold tracking-widest text-zinc-500">GPS REPORTED COUNT</span>
      <span className="text-xs font-mono text-cyan-200">{satelliteReading(count) ? count : '--'} SATS</span>
    </div>
    <p className="text-[10px] text-zinc-400 break-words">{data?.drone_id ? `Source: ${data.drone_id}. ` : 'No selected source. '}Count from latest received snapshot; may be stale. No per-satellite positions or signal measurements supplied, so no sky plot is shown. Count alone does not verify fix quality, accuracy or navigation integrity.</p>
    {!connected && <p className="text-[10px] text-amber-300">Disconnected. Retained count is not current telemetry.</p>}
  </section>;
}
