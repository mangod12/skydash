import { forward as mgrsForward } from 'mgrs';

/**
 * Coordinate conversion utilities
 * Supports: Decimal Degrees, DMS, UTM, MGRS
 */

export function isValidCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function toDMS(lat, lng) {
  if (!isValidCoordinate(lat, lng)) return 'N/A';
  const formatDMS = (dd, isLat) => {
    const dir = isLat ? (dd >= 0 ? 'N' : 'S') : (dd >= 0 ? 'E' : 'W');
    const abs = Math.abs(dd);
    const tenths = Math.round(abs * 36000);
    const deg = Math.floor(tenths / 36000);
    const min = Math.floor((tenths % 36000) / 600);
    const sec = ((tenths % 600) / 10).toFixed(1);
    return `${deg}\u00B0${String(min).padStart(2, '0')}'${String(sec).padStart(4, '0')}"${dir}`;
  };
  return `${formatDMS(lat, true)} ${formatDMS(lng, false)}`;
}

export function toUTM(lat, lng) {
  if (!isValidCoordinate(lat, lng) || lat < -80 || lat > 84) return null;
  let zone = Math.min(60, Math.floor((lng + 180) / 6) + 1);
  if (lat >= 56 && lat < 64 && lng >= 3 && lng < 12) zone = 32;
  if (lat >= 72 && lat < 84 && lng >= 0 && lng < 42) {
    zone = lng < 9 ? 31 : lng < 21 ? 33 : lng < 33 ? 35 : 37;
  }
  const letter = lat >= 0 ? 'N' : 'S';

  // WGS84 transverse Mercator series through A^6 (metre-level display).
  const a = 6378137;
  const f = 1 / 298.257223563;
  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e / (1 - e * e);
  const k0 = 0.9996;

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const lng0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;

  const N = a / Math.sqrt(1 - e * e * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = e2 * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lngRad - lng0);

  const M = a * (
    (1 - e ** 2 / 4 - 3 * e ** 4 / 64 - 5 * e ** 6 / 256) * latRad
    - (3 * e ** 2 / 8 + 3 * e ** 4 / 32 + 45 * e ** 6 / 1024) * Math.sin(2 * latRad)
    + (15 * e ** 4 / 256 + 45 * e ** 6 / 1024) * Math.sin(4 * latRad)
    - (35 * e ** 6 / 3072) * Math.sin(6 * latRad)
  );

  const easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * e2) * A ** 5 / 120) + 500000;
  const northing = k0 * (M + N * Math.tan(latRad) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * e2) * A ** 6 / 720));

  return {
    zone,
    letter,
    easting: Math.round(easting),
    northing: Math.round(lat >= 0 ? northing : northing + 10000000),
    formatted: `${zone}${letter} ${Math.round(easting)} ${Math.round(lat >= 0 ? northing : northing + 10000000)}`,
  };
}

/** Full MGRS grid lettering and truncation from proj4js/mgrs (MIT). */
export function toMGRS(lat, lng) {
  if (!isValidCoordinate(lat, lng)) return 'N/A';
  if (lat < -80 || lat > 84) return 'N/A (polar region)';
  const grid = mgrsForward([lng, lat], 5);
  return grid.replace(/^(\d{1,2}[C-X])([A-Z]{2})(\d{5})(\d{5})$/, '$1 $2 $3 $4');
}

export function formatDecimal(lat, lng) {
  if (!isValidCoordinate(lat, lng)) return 'N/A';
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function distanceBetween(lat1, lng1, lat2, lng2) {
  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) return NaN;
  const R = 6371000; // Earth radius meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const haversine = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return R * c;
}
