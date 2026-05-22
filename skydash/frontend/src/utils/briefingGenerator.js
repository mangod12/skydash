import { format } from 'date-fns';

const THREAT_LABELS = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', none: 'NONE' };
const THREAT_PRIORITY = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };

/**
 * Returns current Zulu time formatted string.
 */
export function getBriefingTimestamp() {
  return format(new Date(), "ddHHmm'Z' MMM yyyy").toUpperCase();
}

/**
 * Returns a DTG (Date-Time Group) from a timestamp.
 */
function toDTG(ts) {
  if (!ts) return 'N/A';
  return format(new Date(ts), "ddHHmm'Z' MMM yyyy").toUpperCase();
}

/**
 * Generates a structured briefing object from mission data.
 */
export function generateBriefing(mission, entities, telemetry) {
  const linkedEntities = entities.filter((e) =>
    (mission.entityIds || []).includes(e.id),
  );

  const threats = linkedEntities
    .filter((e) => e.threatLevel && e.threatLevel !== 'none')
    .sort((a, b) => (THREAT_PRIORITY[b.threatLevel] || 0) - (THREAT_PRIORITY[a.threatLevel] || 0));

  const maxThreat = threats.length > 0 ? threats[0].threatLevel : 'none';

  const situation = buildSituation(linkedEntities, threats, maxThreat, mission);
  const missionSection = buildMission(mission, linkedEntities);
  const execution = buildExecution(mission, linkedEntities);
  const sustainment = buildSustainment(telemetry);
  const command = buildCommand(mission);

  return {
    header: {
      classification: 'UNCLASSIFIED // FOUO',
      missionName: mission.name,
      dtg: getBriefingTimestamp(),
      status: mission.status?.toUpperCase() || 'ACTIVE',
    },
    situation,
    mission: missionSection,
    execution,
    sustainment,
    command,
  };
}

function buildSituation(entities, threats, maxThreat, mission) {
  const threatAssessment = threats.length > 0
    ? `${threats.length} tracked threat(s) identified within AO. Maximum threat level: ${THREAT_LABELS[maxThreat]}. Primary threats include ${threats.slice(0, 3).map((t) => t.name).join(', ')}.`
    : 'No active threats identified within area of operations.';

  const entitySummary = entities.length > 0
    ? `${entities.length} entities under surveillance. Types: ${[...new Set(entities.map((e) => e.type))].join(', ')}. Average confidence: ${Math.round(entities.reduce((s, e) => s + (e.confidence || 0), 0) / entities.length)}%.`
    : 'No entities currently linked to this mission.';

  const areaOfOps = mission.center_lat != null
    ? `AO centered at ${mission.center_lat.toFixed(4)}N, ${Math.abs(mission.center_lng).toFixed(4)}${mission.center_lng >= 0 ? 'E' : 'W'}. Zoom level ${mission.zoom_level || 'N/A'}.`
    : 'Area of operations not yet defined. Recommend establishing map context.';

  return { threatAssessment, entitySummary, areaOfOps };
}

function buildMission(mission, entities) {
  const objective = mission.description
    ? mission.description
    : `Conduct surveillance and intelligence gathering operations for mission ${mission.name}.`;

  const parameters = [
    `Mission ID: ${mission.id}`,
    `Status: ${mission.status?.toUpperCase() || 'ACTIVE'}`,
    `Linked Entities: ${entities.length}`,
    `Created: ${toDTG(mission.created_at)}`,
    `Last Updated: ${toDTG(mission.updated_at)}`,
  ];

  return { objective, parameters };
}

function buildExecution(mission, entities) {
  const timeline = [
    { dtg: toDTG(mission.created_at), event: 'Mission initiated' },
    ...(mission.notes || []).slice(0, 5).map((n) => ({
      dtg: toDTG(n.created_at),
      event: `Analyst note: ${n.content?.slice(0, 60) || 'N/A'}`,
    })),
  ].filter((t) => t.dtg !== 'N/A');

  const assignedEntities = entities.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    threatLevel: THREAT_LABELS[e.threatLevel] || 'UNKNOWN',
  }));

  const waypoints = entities
    .filter((e) => e.coordinates)
    .map((e) => ({
      name: e.name,
      lat: e.coordinates[0]?.toFixed(6),
      lng: e.coordinates[1]?.toFixed(6),
    }));

  return { timeline, assignedEntities, waypoints };
}

function buildSustainment(telemetry) {
  const fleet = telemetry?.fleet || [];
  const primary = telemetry?.data;

  const fleetStatus = fleet.length > 0
    ? fleet.map((d) => ({
        id: d.drone_id || d.id,
        status: d.mode?.toUpperCase() || 'UNKNOWN',
        battery: d.battery_voltage ? `${d.battery_voltage.toFixed(1)}V` : 'N/A',
        signal: d.signal_strength ? `${d.signal_strength}%` : 'N/A',
      }))
    : primary
      ? [{ id: primary.drone_id || 'PRIMARY', status: primary.mode?.toUpperCase() || 'ACTIVE', battery: `${primary.battery_voltage?.toFixed(1) || 'N/A'}V`, signal: `${primary.signal_strength || 'N/A'}%` }]
      : [];

  const overallBattery = primary?.battery_voltage
    ? primary.battery_voltage >= 15.5 ? 'GREEN' : primary.battery_voltage >= 14.5 ? 'AMBER' : 'RED'
    : 'UNKNOWN';

  const overallSignal = primary?.signal_strength
    ? primary.signal_strength >= 70 ? 'GREEN' : primary.signal_strength >= 50 ? 'AMBER' : 'RED'
    : 'UNKNOWN';

  return { fleetStatus, overallBattery, overallSignal };
}

function buildCommand(mission) {
  return {
    channels: [
      { name: 'PRIMARY', freq: 'WebSocket Ch.1 — Real-time Telemetry' },
      { name: 'SECONDARY', freq: 'REST API — Mission Data Sync' },
      { name: 'EMERGENCY', freq: 'Alert Engine — Auto-escalation' },
    ],
    escalation: [
      'Level 1: Automated alert via notification system',
      'Level 2: Analyst review — threat confirmation required',
      'Level 3: Mission commander notification — response authorization',
      'Level 4: Full platform lockdown — emergency protocols engaged',
    ],
  };
}

/**
 * Formats a briefing object into plaintext OPORD format.
 */
export function formatBriefingText(briefing) {
  const SEP = '='.repeat(64);
  const DASH = '-'.repeat(64);
  const lines = [];

  lines.push(SEP);
  lines.push(`  ${briefing.header.classification}`);
  lines.push(SEP);
  lines.push('');
  lines.push(`  MISSION BRIEFING: ${briefing.header.missionName}`);
  lines.push(`  DTG: ${briefing.header.dtg}`);
  lines.push(`  STATUS: ${briefing.header.status}`);
  lines.push('');
  lines.push(SEP);

  // 1. SITUATION
  lines.push('');
  lines.push('1. SITUATION');
  lines.push(DASH);
  lines.push('');
  lines.push('  a. Threat Assessment:');
  lines.push(`     ${briefing.situation.threatAssessment}`);
  lines.push('');
  lines.push('  b. Entity Summary:');
  lines.push(`     ${briefing.situation.entitySummary}`);
  lines.push('');
  lines.push('  c. Area of Operations:');
  lines.push(`     ${briefing.situation.areaOfOps}`);
  lines.push('');

  // 2. MISSION
  lines.push('2. MISSION');
  lines.push(DASH);
  lines.push('');
  lines.push(`  Objective: ${briefing.mission.objective}`);
  lines.push('');
  lines.push('  Parameters:');
  briefing.mission.parameters.forEach((p) => lines.push(`    - ${p}`));
  lines.push('');

  // 3. EXECUTION
  lines.push('3. EXECUTION');
  lines.push(DASH);
  lines.push('');
  lines.push('  a. Timeline:');
  if (briefing.execution.timeline.length > 0) {
    briefing.execution.timeline.forEach((t) =>
      lines.push(`    [${t.dtg}] ${t.event}`),
    );
  } else {
    lines.push('    No timeline events recorded.');
  }
  lines.push('');
  lines.push('  b. Assigned Entities:');
  if (briefing.execution.assignedEntities.length > 0) {
    briefing.execution.assignedEntities.forEach((e) =>
      lines.push(`    - ${e.name} (${e.type}) — Threat: ${e.threatLevel}`),
    );
  } else {
    lines.push('    None assigned.');
  }
  lines.push('');
  lines.push('  c. Key Waypoints:');
  if (briefing.execution.waypoints.length > 0) {
    briefing.execution.waypoints.forEach((w) =>
      lines.push(`    - ${w.name}: ${w.lat}, ${w.lng}`),
    );
  } else {
    lines.push('    No waypoints defined.');
  }
  lines.push('');

  // 4. SUSTAINMENT
  lines.push('4. SUSTAINMENT');
  lines.push(DASH);
  lines.push('');
  lines.push(`  Battery Status: ${briefing.sustainment.overallBattery}`);
  lines.push(`  Signal Status: ${briefing.sustainment.overallSignal}`);
  lines.push('');
  lines.push('  Fleet:');
  if (briefing.sustainment.fleetStatus.length > 0) {
    briefing.sustainment.fleetStatus.forEach((f) =>
      lines.push(`    - ${f.id}: ${f.status} | Battery: ${f.battery} | Signal: ${f.signal}`),
    );
  } else {
    lines.push('    No fleet data available.');
  }
  lines.push('');

  // 5. COMMAND AND SIGNAL
  lines.push('5. COMMAND AND SIGNAL');
  lines.push(DASH);
  lines.push('');
  lines.push('  a. Communications:');
  briefing.command.channels.forEach((c) =>
    lines.push(`    - ${c.name}: ${c.freq}`),
  );
  lines.push('');
  lines.push('  b. Escalation Procedures:');
  briefing.command.escalation.forEach((e) => lines.push(`    ${e}`));
  lines.push('');

  lines.push(SEP);
  lines.push(`  ${briefing.header.classification}`);
  lines.push(`  Generated: ${briefing.header.dtg}`);
  lines.push(SEP);

  return lines.join('\n');
}
