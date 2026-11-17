/** Helpers for scrubbing through recorded telemetry samples. */

export function normalizeFrames(samples) {
  if (!Array.isArray(samples)) return [];
  return samples
    .filter((s) => {
      const time = s?.timestamp;
      const numeric = typeof time === 'number' || (typeof time === 'string' && time.trim() !== '');
      return numeric && Number.isFinite(Number(time) * 1000);
    })
    .map((s) => ({
      t: Number(s.timestamp) * 1000,
      altitude: s.altitude ?? null,
      battery: s.battery_voltage ?? null,
      speed: s.ground_speed ?? null,
      signal: s.signal_strength ?? null,
      lat: s.gps?.latitude ?? null,
      lng: s.gps?.longitude ?? null,
    }))
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
