import { distanceBetween } from './coordinates';

/**
 * Check if a single drone's telemetry triggers a rule.
 * Returns { triggered: boolean, message: string } for each check.
 */
function checkBatteryLow(drone, config) {
  const pct = drone.battery_percentage ?? 0;
  if (pct < config.threshold) {
    return { triggered: true, message: `${drone.drone_id} battery at ${pct}%` };
  }
  return { triggered: false };
}

function checkSignalWeak(drone, config) {
  const sig = drone.signal_strength ?? 100;
  if (sig < config.threshold) {
    return { triggered: true, message: `${drone.drone_id} signal at ${sig}%` };
  }
  return { triggered: false };
}

function checkAltitudeLimit(drone, config) {
  const alt = drone.altitude ?? 0;
  if (alt > config.maxAlt) {
    return { triggered: true, message: `${drone.drone_id} altitude ${alt.toFixed(0)}m exceeds ${config.maxAlt}m` };
  }
  return { triggered: false };
}

function checkSpeedLimit(drone, config) {
  const spd = drone.ground_speed ?? 0;
  if (spd > config.maxSpeed) {
    return { triggered: true, message: `${drone.drone_id} speed ${spd.toFixed(1)} m/s exceeds ${config.maxSpeed}` };
  }
  return { triggered: false };
}

function checkGeofenceBreach(drone, config, geofences) {
  if (!drone.gps) return { triggered: false };
  const { latitude, longitude } = drone.gps;
  const fences = config.geofenceId
    ? geofences.filter((g) => g.id === config.geofenceId)
    : geofences;

  for (const fence of fences) {
    if (fence.type !== 'circle' || !fence.center) continue;
    const dist = distanceBetween(latitude, longitude, fence.center.lat, fence.center.lng);
    if (dist > fence.radius) {
      return { triggered: true, message: `${drone.drone_id} breached geofence (${Math.round(dist)}m)` };
    }
  }
  return { triggered: false };
}

function checkProximity(drone, config, entities) {
  if (!drone.gps) return { triggered: false };
  const target = entities.find((e) => e.id === config.entityId);
  if (!target?.coordinates) return { triggered: false };

  const dist = distanceBetween(
    drone.gps.latitude, drone.gps.longitude,
    target.coordinates[0], target.coordinates[1],
  );
  const radius = config.radiusM ?? 500;
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
  const checker = CHECKERS[rule.type];
  if (!checker) return { triggered: false };
  return checker(drone, rule.config, geofences, entities);
}
