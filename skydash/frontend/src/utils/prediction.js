const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Point reached from (lat, lng) travelling distanceM along bearingDeg (great circle). */
export function destinationPoint(lat, lng, bearingDeg, distanceM) {
  const d = distanceM / R;
  const b = toRad(bearingDeg);
  const p1 = toRad(lat);
  const l1 = toRad(lng);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [toDeg(p2), ((toDeg(l2) + 540) % 360) - 180];
}

/** Straight-line predicted track: positions at each step seconds ahead, at constant speed/heading. */
export function predictTrack(pos, speedMps, headingDeg, horizonS = 120, stepS = 30) {
  if (!pos || !Number.isFinite(speedMps) || speedMps < 0.5) return [];
  const pts = [[pos.lat, pos.lng]];
  for (let t = stepS; t <= horizonS; t += stepS) {
    pts.push(destinationPoint(pos.lat, pos.lng, headingDeg || 0, speedMps * t));
  }
  return pts;
}

export const RANGE_RING_RADII_M = [250, 500, 1000];
