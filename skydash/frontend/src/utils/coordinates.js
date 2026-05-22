/**
 * Coordinate conversion utilities
 * Supports: Decimal Degrees, DMS, UTM, MGRS
 */

export function toDMS(lat, lng) {
  const formatDMS = (dd, isLat) => {
    const dir = isLat ? (dd >= 0 ? 'N' : 'S') : (dd >= 0 ? 'E' : 'W');
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(1);
    return `${deg}\u00B0${String(min).padStart(2, '0')}'${String(sec).padStart(4, '0')}"${dir}`;
  };
  return `${formatDMS(lat, true)} ${formatDMS(lng, false)}`;
}

export function toUTM(lat, lng) {
  const zone = Math.floor((lng + 180) / 6) + 1;
  const letter = lat >= 0 ? 'N' : 'S';

  // Simplified UTM projection (WGS84)
  const a = 6378137;
  const f = 1 / 298.257223563;
  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e / (1 - e * e);
  const n = f / (2 - f);
  const k0 = 0.9996;

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const lng0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;

  const N = a / Math.sqrt(1 - e * e * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = e2 * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lngRad - lng0);

  const M = a * (
    (1 - e * e / 4 - 3 * e * e * e * e / 64) * latRad
    - (3 * e * e / 8 + 3 * e * e * e * e / 32) * Math.sin(2 * latRad)
    + (15 * e * e * e * e / 256) * Math.sin(4 * latRad)
  );

  const easting = k0 * N * (A + (1 - T + C) * A * A * A / 6) + 500000;
  const northing = k0 * (M + N * Math.tan(latRad) * (A * A / 2 + (5 - T + 9 * C) * A * A * A * A / 24));

  return {
    zone,
    letter,
    easting: Math.round(easting),
    northing: Math.round(lat >= 0 ? northing : northing + 10000000),
    formatted: `${zone}${letter} ${Math.round(easting)} ${Math.round(lat >= 0 ? northing : northing + 10000000)}`,
  };
}

const MGRS_LETTERS_100K_E = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MGRS_LETTERS_100K_N = 'ABCDEFGHJKLMNPQRSTUV';

export function toMGRS(lat, lng) {
  const utm = toUTM(lat, lng);
  const setNumber = ((utm.zone - 1) % 6);

  const e100k = Math.floor(utm.easting / 100000);
  const n100k = Math.floor(utm.northing / 100000) % 20;

  const colIdx = (e100k - 1 + setNumber * 8) % 24;
  const rowIdx = n100k % 20;

  const col = MGRS_LETTERS_100K_E[colIdx] || '?';
  const row = MGRS_LETTERS_100K_N[rowIdx] || '?';

  const bandLetters = 'CDEFGHJKLMNPQRSTUVWX';
  const bandIdx = Math.floor((lat + 80) / 8);
  const band = bandLetters[Math.min(bandIdx, bandLetters.length - 1)] || '?';

  const e5 = String(Math.round(utm.easting % 100000)).padStart(5, '0');
  const n5 = String(Math.round(utm.northing % 100000)).padStart(5, '0');

  return `${utm.zone}${band} ${col}${row} ${e5} ${n5}`;
}

export function formatDecimal(lat, lng) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function distanceBetween(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function bearingBetween(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1R = lat1 * Math.PI / 180;
  const lat2R = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}
