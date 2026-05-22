import { useMemo } from 'react';
import { clsx } from 'clsx';
import { AlertOctagon, TrendingUp, TrendingDown } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';

/**
 * Simple anomaly detection on telemetry history.
 * Flags values outside 2 standard deviations from rolling mean.
 */
function detectAnomalies(history) {
  if (history.length < 10) return [];

  const anomalies = [];
  const fields = ['altitude', 'speed', 'battery', 'signal'];

  for (const field of fields) {
    const values = history.map((h) => h[field]).filter((v) => v != null);
    if (values.length < 10) continue;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const latest = values[values.length - 1];
    const deviation = Math.abs(latest - mean) / (stdDev || 1);

    if (deviation > 2) {
      anomalies.push({
        field,
        value: latest,
        mean: mean.toFixed(1),
        deviation: deviation.toFixed(1),
        direction: latest > mean ? 'high' : 'low',
      });
    }

    // Trend detection (monotonic change over last 10 samples)
    const recent = values.slice(-10);
    let increasing = 0;
    let decreasing = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] > recent[i - 1]) increasing++;
      if (recent[i] < recent[i - 1]) decreasing++;
    }
    if (increasing >= 8) {
      anomalies.push({ field, type: 'trend', direction: 'rising', count: increasing });
    }
    if (decreasing >= 8) {
      anomalies.push({ field, type: 'trend', direction: 'falling', count: decreasing });
    }
  }

  return anomalies;
}

const FIELD_LABELS = {
  altitude: 'ALTITUDE',
  speed: 'SPEED',
  battery: 'BATTERY',
  signal: 'SIGNAL',
};

export default function AnomalyDetector() {
  const history = useTelemetryStore((s) => s.history);

  const anomalies = useMemo(() => detectAnomalies(history), [history]);

  if (anomalies.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 flex items-center gap-1.5">
          <AlertOctagon size={10} /> ANOMALY DETECTION
        </h4>
        <div className="text-[10px] text-zinc-600 text-center py-3">
          No anomalies detected
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 flex items-center gap-1.5">
        <AlertOctagon size={10} className="text-amber-400" /> ANOMALIES ({anomalies.length})
      </h4>
      <div className="space-y-1.5">
        {anomalies.map((a, i) => (
          <div
            key={i}
            className={clsx(
              'flex items-center gap-2 p-2 rounded-lg text-[10px] border',
              a.type === 'trend'
                ? 'bg-blue-500/5 border-blue-500/20 text-blue-400'
                : 'bg-amber-500/5 border-amber-500/20 text-amber-400',
            )}
          >
            {a.direction === 'high' || a.direction === 'rising' ? (
              <TrendingUp size={12} className="shrink-0" />
            ) : (
              <TrendingDown size={12} className="shrink-0" />
            )}
            <div className="flex-1">
              {a.type === 'trend' ? (
                <span>{FIELD_LABELS[a.field]} steadily {a.direction}</span>
              ) : (
                <span>
                  {FIELD_LABELS[a.field]} {a.direction} — {a.value} (mean: {a.mean}, {a.deviation}σ)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
