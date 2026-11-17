import { distanceBetween } from './coordinates';

/**
 * Check if a single drone's telemetry triggers a rule.
 * Returns { triggered: boolean, message: string } for each check.
 */
function checkBatteryLow(drone, config) {
  const pct = drone.battery_percentage;
  if (!Number.isFinite(pct) || !Number.isFinite(config.threshold)) return { triggered: false };
  if (pct < config.threshold) {
    return { triggered: true, message: `${drone.drone_id} battery at ${pct}%` };
  }
  return { triggered: false };
}

function checkSignalWeak(drone, config) {
  const sig = drone.signal_strength;
  if (!Number.isFinite(sig) || !Number.isFinite(config.threshold)) return { triggered: false };
  if (sig < config.threshold) {
    return { triggered: true, message: `${drone.drone_id} signal at ${sig}%` };
  }
  return { triggered: false };
}

function checkAltitudeLimit(drone, config) {
  const alt = drone.altitude;
  if (!Number.isFinite(alt) || !Number.isFinite(config.maxAlt)) return { triggered: false };
  if (alt > config.maxAlt) {
    return { triggered: true, message: `${drone.drone_id} altitude ${alt.toFixed(0)}m exceeds ${config.maxAlt}m` };
  }
  return { triggered: false };
}

function checkSpeedLimit(drone, config) {
  const spd = drone.ground_speed;
  if (!Number.isFinite(spd) || !Number.isFinite(config.maxSpeed)) return { triggered: false };
  if (spd > config.maxSpeed) {
    return { triggered: true, message: `${drone.drone_id} speed ${spd.toFixed(1)} m/s exceeds ${config.maxSpeed}` };
  }
  return { triggered: false };
}

function validPosition(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function checkGeofenceBreach(drone, config, geofences) {
  if (!validPosition(drone.gps?.latitude, drone.gps?.longitude)) return { triggered: false };
  const { latitude, longitude } = drone.gps;
  const fences = config.geofenceId
    ? geofences.filter((g) => g && g.id === config.geofenceId)
    : geofences;

  for (const fence of fences) {
    if (!fence || fence.active === false || fence.type !== 'circle' || !validPosition(fence.center?.lat, fence.center?.lng)
        || !Number.isFinite(fence.radius) || fence.radius <= 0) continue;
    const dist = distanceBetween(latitude, longitude, fence.center.lat, fence.center.lng);
    if (dist > fence.radius) {
      return { triggered: true, message: `${drone.drone_id} breached geofence (${Math.round(dist)}m)` };
    }
  }
  return { triggered: false };
}

function checkProximity(drone, config, _geofences, entities) {
  if (!validPosition(drone.gps?.latitude, drone.gps?.longitude)) return { triggered: false };
  const target = entities.find((e) => e && e.id === config.entityId);
  if (!Array.isArray(target?.coordinates) || !validPosition(target.coordinates[0], target.coordinates[1])) {
    return { triggered: false };
  }

  const dist = distanceBetween(
    drone.gps.latitude, drone.gps.longitude,
    target.coordinates[0], target.coordinates[1],
  );
  const radius = config.radiusM ?? 500;
  if (!Number.isFinite(radius) || radius <= 0) return { triggered: false };
  if (dist < radius) {
    return { triggered: true, message: `${drone.drone_id} within ${Math.round(dist)}m of ${target.name}` };
  }
  return { triggered: false };
}

const CHECKERS = {
  battery_low: checkBatteryLow,
  signal_weak: checkSignalWeak,
  altitude_limit: checkAltitudeLimit,
  speed_limit: checkSpeedLimit,
  geofence_breach: checkGeofenceBreach,
  proximity: checkProximity,
};

/**
 * Evaluate a single rule against a drone's telemetry.
 * @returns {{ triggered: boolean, message?: string }}
 */
export function evaluateRule(rule, drone, geofences, entities) {
  if (!rule || !drone || !Object.hasOwn(CHECKERS, rule.type)) return { triggered: false };
  const config = rule.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return { triggered: false };
  return CHECKERS[rule.type](drone, config,
    Array.isArray(geofences) ? geofences : [], Array.isArray(entities) ? entities : []);
}
