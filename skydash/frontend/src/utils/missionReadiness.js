import { isValidCoordinate } from './coordinates';
import { finiteReading, percentReading, validDroneRecord } from './telemetryReadings';

export const READINESS_FRESH_MS = 5000;
export const READINESS_SCOPE = 'Simulation / training assessment. Hardware, airspace, weather and flight authorization are not verified. This is not clearance to fly.';
const text = (value) => typeof value === 'string' && Boolean(value.trim());

/** An evidence snapshot, not a flight-safety decision. No default readings or hidden pass. */
export function assessMissionReadiness({ mission, entities, telemetry, connectors, now = Date.now() }) {
  const checks = [];
  const add = (id, label, state, evidence, action) => checks.push({ id, label, state, evidence, action });
  const knownEntities = Array.isArray(entities) ? entities : [];
  const linkedIds = Array.isArray(mission?.entityIds) ? [...new Set(mission.entityIds)] : null;
  const linked = linkedIds?.filter(id => knownEntities.some(entity => entity?.id === id));
  add('objective', 'Mission objective', text(mission?.description) ? 'pass' : 'warn',
    text(mission?.description) ? mission.description : 'No mission description saved.', 'Add a clear objective in the mission details.');
  add('status', 'Mission status', mission?.status === 'active' ? 'pass' : 'warn',
    `Status: ${text(mission?.status) ? mission.status : 'unknown'}.`, 'Use an active mission for a training run.');
  const mapped = isValidCoordinate(mission?.center_lat, mission?.center_lng);
  add('area', 'Saved area of operations', mapped ? 'pass' : 'warn',
    mapped ? `${mission.center_lat.toFixed(4)}, ${mission.center_lng.toFixed(4)}` : 'No valid saved map center.', 'Open MAP and save the intended area.');
  add('entities', 'Linked evidence', linkedIds === null ? 'unknown' : linked.length > 0 && linked.length === linkedIds.length ? 'pass' : 'warn',
    linkedIds === null ? 'Mission entity details have not loaded.' : `${linked.length}/${linkedIds.length} linked entities available in the current intelligence data.`,
    'Load mission details and link the evidence needed for this mission.');

  const data = telemetry?.data;
  const age = finiteReading(telemetry?.dataReceivedAt) ? now - telemetry.dataReceivedAt : null;
  const identified = validDroneRecord(data) && data.drone_id === telemetry?.activeDroneId;
  const fresh = telemetry?.isConnected === true && identified && finiteReading(age) && age >= 0 && age <= READINESS_FRESH_MS;
  add('freshness', 'Selected drone telemetry', fresh ? 'pass' : 'unknown',
    identified && age !== null && age >= 0 ? `${data.drone_id}; last received ${(age / 1000).toFixed(1)}s ago${fresh ? '' : '; disconnected or stale'}.` : 'No current identified drone sample.',
    'Select a drone and restore the telemetry stream. Samples older than 5s are unknown.');
  const located = fresh && isValidCoordinate(data?.gps?.latitude, data?.gps?.longitude);
  add('position', 'Current drone position', located ? 'pass' : 'unknown',
    located ? `${data.gps.latitude.toFixed(5)}, ${data.gps.longitude.toFixed(5)}` : 'No fresh, valid latitude/longitude pair.', 'Check the selected drone GPS and telemetry freshness.');
  const battery = fresh && percentReading(data?.battery_percentage) ? data.battery_percentage : null;
  add('battery', 'Battery training threshold', battery === null ? 'unknown' : battery >= 20 ? 'pass' : 'warn',
    battery === null ? 'No fresh battery percentage. Voltage alone is not a verified capacity estimate.' : `${battery}% remaining. Training preset: at least 20%; not an aircraft-specific limit.`,
    'Verify the aircraft-specific reserve and battery health outside this checklist.');
  const signal = fresh && percentReading(data?.signal_strength) ? data.signal_strength : null;
  add('signal', 'Signal training threshold', signal === null ? 'unknown' : signal >= 50 ? 'pass' : 'warn',
    signal === null ? 'No fresh signal percentage.' : `${signal}% signal. Training preset: at least 50%.`, 'Check the link and the aircraft-specific operating requirements.');

  const config = connectors?.data;
  const connectorFresh = connectors?.state === 'loaded' && finiteReading(connectors.checkedAt)
    && now >= connectors.checkedAt && now - connectors.checkedAt <= 60000;
  const modesKnown = config?.opensky?.available === true && typeof config?.shodan?.available === 'boolean'
    && ['live', 'mock'].includes(config?.shodan?.mode);
  add('connectors', 'Connector configuration', !connectorFresh || !modesKnown ? 'unknown' : config.shodan.mode === 'mock' ? 'warn' : 'pass',
    !connectorFresh || !modesKnown ? 'Connector status unavailable or older than 60s.' : `OpenSky supported; Shodan ${config.shodan.mode}. Configuration only, not proof of live feed coverage or freshness.`,
    'Refresh connector status. Verify source coverage and freshness before relying on external intelligence.');
  const counts = { pass: 0, warn: 0, unknown: 0 };
  checks.forEach(check => { counts[check.state] += 1; });
  return { version: 1, assessedAt: now, missionId: mission?.id ?? null, missionName: mission?.name || 'Unnamed mission',
    droneId: identified ? data.drone_id : null, scope: READINESS_SCOPE, checks, counts,
    result: counts.warn || counts.unknown ? 'Review required' : 'Training checks complete' };
}

export function formatReadinessReport(report) {
  return ['SKYDASH MISSION READINESS CHECK', `Mission: ${report.missionName} (${report.missionId})`,
    `Assessed: ${new Date(report.assessedAt).toISOString()}`, `Selected drone: ${report.droneId || 'unknown'}`,
    report.scope, '', `${report.result}: ${report.counts.pass} pass, ${report.counts.warn} warn, ${report.counts.unknown} unknown.`,
    'Snapshot only. Re-run after mission, source or telemetry changes.', '',
    ...report.checks.flatMap(check => [`[${check.state.toUpperCase()}] ${check.label}`, `Evidence: ${check.evidence}`,
      ...(check.state === 'pass' ? [] : [`Next: ${check.action}`]), '']),
  ].join('\n');
}
