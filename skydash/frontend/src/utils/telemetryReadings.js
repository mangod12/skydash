export const finiteReading = (value) => typeof value === 'number' && Number.isFinite(value);
export const nonNegativeReading = (value) => finiteReading(value) && value >= 0;
export const percentReading = (value) => nonNegativeReading(value) && value <= 100;
export const satelliteReading = (value) => Number.isSafeInteger(value) && value >= 0;
export const formatReading = (value, digits = 1) => finiteReading(value) ? value.toFixed(digits) : '--';

const objectRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const validDroneRecord = (value) => objectRecord(value)
  && typeof value.drone_id === 'string' && Boolean(value.drone_id.trim());

/** Preserve missing readings as unknown, never as confirmed zero telemetry. */
export function normalizeTelemetry(record) {
  if (!validDroneRecord(record)) return null;
  const data = { ...record };
  for (const field of ['timestamp', 'altitude']) {
    data[field] = finiteReading(record[field]) ? record[field] : null;
  }
  for (const field of ['battery_voltage', 'ground_speed']) {
    data[field] = nonNegativeReading(record[field]) ? record[field] : null;
  }
  for (const field of ['battery_percentage', 'signal_strength']) {
    data[field] = percentReading(record[field]) ? record[field] : null;
  }
  for (const field of ['status', 'flight_mode', 'pattern']) {
    data[field] = typeof record[field] === 'string' ? record[field] : null;
  }
  data.armed = typeof record.armed === 'boolean' ? record.armed : null;
  const attitude = objectRecord(record.attitude) ? record.attitude : {};
  data.attitude = Object.fromEntries(['roll', 'pitch', 'yaw'].map(
    (field) => [field, finiteReading(attitude[field]) ? attitude[field] : null],
  ));
  const gps = objectRecord(record.gps) ? record.gps : {};
  const located = finiteReading(gps.latitude) && Math.abs(gps.latitude) <= 90
    && finiteReading(gps.longitude) && Math.abs(gps.longitude) <= 180;
  data.gps = {
    ...gps,
    latitude: located ? gps.latitude : null,
    longitude: located ? gps.longitude : null,
    altitude: finiteReading(gps.altitude) ? gps.altitude : null,
    satellites: satelliteReading(gps.satellites) ? gps.satellites : null,
  };
  return data;
}
