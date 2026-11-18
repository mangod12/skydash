/** Helpers for scrubbing through recorded telemetry samples. */
import { finiteReading, nonNegativeReading, percentReading } from './telemetryReadings';
import { isValidCoordinate } from './coordinates';

export function normalizeFrames(samples) {
  if (!Array.isArray(samples)) return [];
  return samples
    .filter((s) => {
      const time = s?.timestamp;
      const numeric = typeof time === 'number' || (typeof time === 'string' && time.trim() !== '');
      return numeric && Number.isFinite(Number(time) * 1000);
    })
    .map((s) => {
      const located = isValidCoordinate(s.gps?.latitude, s.gps?.longitude);
      return {
        t: Number(s.timestamp) * 1000,
        altitude: finiteReading(s.altitude) ? s.altitude : null,
        battery: nonNegativeReading(s.battery_voltage) ? s.battery_voltage : null,
        speed: nonNegativeReading(s.ground_speed) ? s.ground_speed : null,
        signal: percentReading(s.signal_strength) ? s.signal_strength : null,
        lat: located ? s.gps.latitude : null,
        lng: located ? s.gps.longitude : null,
      };
    })
    .sort((a, b) => a.t - b.t);
}

export function clampIndex(index, length) {
  if (!length) return 0;
  return Math.min(Math.max(Math.round(Number(index) || 0), 0), length - 1);
}

export function nextIndex(index, length) {
  if (!length) return 0;
  return index >= length - 1 ? 0 : index + 1;
}

export function formatOffset(frames, index) {
  if (!frames.length) return '0s';
  const i = clampIndex(index, frames.length);
  const secondsBack = Math.round((frames[frames.length - 1].t - frames[i].t) / 1000);
  return secondsBack === 0 ? 'now' : `-${secondsBack}s`;
}
