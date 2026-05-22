/**
 * Bearing & distance utilities for tactical navigation
 * All calculations use WGS84 spherical approximation
 */

const EARTH_RADIUS_KM = 6371.009;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Calculate true bearing from point 1 to point 2
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateBearing(lat1, lng1, lat2, lng2) {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;

  const x = Math.sin(dLambda) * Math.cos(phi2);
  const y = Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  const theta = Math.atan2(x, y);
  return (theta * RAD_TO_DEG + 360) % 360;
}

/**
 * Calculate distance between two points
 * @param {string} unit - 'km' | 'nm' | 'mi'
 * @returns {number} Distance in specified unit
 */
export function calculateDistance(lat1, lng1, lat2, lng2, unit = 'km') {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dPhi = (lat2 - lat1) * DEG_TO_RAD;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;

  const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = EARTH_RADIUS_KM * c;

  switch (unit) {
    case 'nm': return km / 1.852;
    case 'mi': return km / 1.60934;
    default: return km;
  }
}

/**
 * Simplified magnetic declination estimate based on IGRF model approximation
 * Returns offset to subtract from true bearing to get magnetic bearing
 * @returns {number} Declination in degrees (positive = east)
 */
export function magneticDeclination(lat, lng) {
  // Simplified dipole model — adequate for display purposes
  // Based on approximate 2025 IGRF coefficients
  const latRad = lat * DEG_TO_RAD;
  const lngRad = lng * DEG_TO_RAD;

  // Magnetic pole approx position (2025): 86.5N, 162.8W
  const poleLatRad = 86.5 * DEG_TO_RAD;
  const poleLngRad = -162.8 * DEG_TO_RAD;

  const cosDelta = Math.sin(latRad) * Math.sin(poleLatRad) +
    Math.cos(latRad) * Math.cos(poleLatRad) * Math.cos(lngRad - poleLngRad);
  const sinDelta = Math.sqrt(1 - cosDelta * cosDelta);

  if (sinDelta < 0.001) return 0;

  const sinDecl = Math.cos(poleLatRad) * Math.sin(lngRad - poleLngRad) / sinDelta;
  const cosDecl = (Math.sin(poleLatRad) - Math.sin(latRad) * cosDelta) /
    (Math.cos(latRad) * sinDelta);

  return Math.atan2(sinDecl, cosDecl) * RAD_TO_DEG;
}

/**
 * Estimate travel time given distance and speed
 * @returns {string} Formatted time string (e.g. "2h 15m" or "45m 30s")
 */
export function estimateTravelTime(distanceKm, speedKph) {
  if (!speedKph || speedKph <= 0) return '--';

  const hours = distanceKm / speedKph;
  const totalSeconds = Math.round(hours * 3600);

  if (totalSeconds < 60) return `${totalSeconds}s`;

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

/**
 * Calculate geographic midpoint between two coordinates
 * @returns {{ lat: number, lng: number }}
 */
export function midpoint(lat1, lng1, lat2, lng2) {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const lambda1 = lng1 * DEG_TO_RAD;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;

  const bx = Math.cos(phi2) * Math.cos(dLambda);
  const by = Math.cos(phi2) * Math.sin(dLambda);

  const phi3 = Math.atan2(
    Math.sin(phi1) + Math.sin(phi2),
    Math.sqrt((Math.cos(phi1) + bx) * (Math.cos(phi1) + bx) + by * by)
  );
  const lambda3 = lambda1 + Math.atan2(by, Math.cos(phi1) + bx);

  return {
    lat: phi3 * RAD_TO_DEG,
    lng: ((lambda3 * RAD_TO_DEG) + 540) % 360 - 180,
  };
}

/**
 * Format bearing as degrees string
 */
export function formatBearing(degrees) {
  return `${degrees.toFixed(1)}\u00B0`;
}

/**
 * Format distance with unit label
 */
export function formatDistance(value, unit) {
  if (value < 0.01) return `${(value * 1000).toFixed(0)} m`;
  return `${value.toFixed(2)} ${unit}`;
}
