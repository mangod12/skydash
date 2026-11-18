import { normalizeTelemetry } from './telemetryReadings';
import { isValidCoordinate } from './coordinates';

const THREAT_LABELS = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', none: 'NONE' };
const THREAT_PRIORITY = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };

function threatLabel(value) {
  return Object.hasOwn(THREAT_LABELS, value) ? THREAT_LABELS[value] : 'UNKNOWN';
}

/**
 * Returns current Zulu time formatted string.
 */
export function getBriefingTimestamp() {
  return toDTG(Date.now());
}

/**
 * Returns a DTG (Date-Time Group) from a timestamp.
 */
function toDTG(ts) {
  if (ts == null || ts === '') return 'N/A';
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return 'N/A';
  const pad = (value) => String(value).padStart(2, '0');
  const month = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][date.getUTCMonth()];
  return `${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}Z ${month} ${date.getUTCFullYear()}`;
}

/**
 * Generates a structured briefing object from mission data.
 */
export function generateBriefing(mission, entities, telemetry) {
  const linkedEntities = entities.filter((e) =>
    (mission.entityIds || []).includes(e.id),
  );

  const threats = linkedEntities
    .filter((e) => threatLabel(e.threatLevel) !== 'UNKNOWN' && e.threatLevel !== 'none')
    .sort((a, b) => (THREAT_PRIORITY[b.threatLevel] || 0) - (THREAT_PRIORITY[a.threatLevel] || 0));

  const maxThreat = threats.length > 0 ? threats[0].threatLevel : 'none';

  const situation = buildSituation(linkedEntities, threats, maxThreat, mission);
  const missionSection = buildMission(mission, linkedEntities);
  const execution = buildExecution(mission, linkedEntities);
  const visualDebrief = buildVisualDebrief(mission);
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
    visualDebrief,
    sustainment,
    command,
  };
}

function buildSituation(entities, threats, maxThreat, mission) {
  const unknownThreats = entities.filter(e => threatLabel(e.threatLevel) === 'UNKNOWN').length;
  const unknownAssessment = `${unknownThreats} linked entity threat classification(s) unknown. Analyst review required.`;
  const knownAssessment = threats.length > 0
    ? `${threats.length} tracked threat(s) identified within AO. Maximum threat level: ${THREAT_LABELS[maxThreat]}. Primary threats include ${threats.slice(0, 3).map((t) => t.name).join(', ')}.`
    : unknownThreats > 0 ? '' : 'No active threats identified within area of operations.';
  const threatAssessment = [knownAssessment, unknownThreats > 0 ? unknownAssessment : ''].filter(Boolean).join(' ');

  const confidences = entities.map(e => e.confidence).filter(value => Number.isFinite(value) && value >= 0 && value <= 100);
  const confidenceSummary = confidences.length > 0
    ? `${Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length)}% (${confidences.length}/${entities.length} known)`
    : 'UNKNOWN';
  const entitySummary = entities.length > 0
    ? `${entities.length} entities linked for operational monitoring. Types: ${[...new Set(entities.map((e) => e.type || 'UNKNOWN'))].join(', ')}. Average confidence: ${confidenceSummary}.`
    : 'No entities currently linked to this mission.';

  const located = Number.isFinite(mission.center_lat) && Number.isFinite(mission.center_lng)
    && Math.abs(mission.center_lat) <= 90 && Math.abs(mission.center_lng) <= 180;
  const areaOfOps = located
    ? `AO centered at ${Math.abs(mission.center_lat).toFixed(4)}${mission.center_lat >= 0 ? 'N' : 'S'}, ${Math.abs(mission.center_lng).toFixed(4)}${mission.center_lng >= 0 ? 'E' : 'W'}. Zoom level ${mission.zoom_level ?? 'N/A'}.`
    : 'Area of operations not yet defined. Recommend establishing map context.';

  return { threatAssessment, entitySummary, areaOfOps };
}

function buildMission(mission, entities) {
  const objective = mission.description
    ? mission.description
    : `Conduct lawful situational-awareness and intelligence review for mission ${mission.name}.`;

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
    threatLevel: threatLabel(e.threatLevel),
  }));

  const waypoints = entities
    .filter((e) => Array.isArray(e.coordinates)
      && isValidCoordinate(e.coordinates[0], e.coordinates[1]))
    .map((e) => ({
      name: e.name,
      lat: e.coordinates[0].toFixed(6),
      lng: e.coordinates[1].toFixed(6),
    }));

  return { timeline, assignedEntities, waypoints };
}

function buildVisualDebrief(mission) {
  const runs = mission.detections || [];
  const objectCounts = {};
  let totalObjects = 0;

  runs.forEach((run) => {
    Object.entries(run.summary?.labels || {}).forEach(([label, count]) => {
      objectCounts[label] = (objectCounts[label] || 0) + count;
      totalObjects += count;
    });
  });

  return {
    runs: runs.map((run) => ({
      source: run.source_name,
      model: run.model,
      createdAt: toDTG(run.created_at),
      total: run.summary?.total || 0,
      labels: run.summary?.labels || {},
      topDetections: (run.detections || []).slice(0, 5).map((detection) => ({
        label: detection.label,
        confidence: `${Math.round((detection.confidence || 0) * 100)}%`,
      })),
    })),
    totalObjects,
    objectCounts,
  };
}

function buildSustainment(telemetry) {
  const fleet = Array.isArray(telemetry?.fleet)
    ? telemetry.fleet.map(normalizeTelemetry).filter(Boolean) : [];
  const primary = normalizeTelemetry(telemetry?.data);
  const drones = fleet.length > 0 ? fleet : primary ? [primary] : [];
  const fleetStatus = drones.map((d) => ({
    id: d.drone_id,
    status: d.flight_mode?.trim().toUpperCase() || 'UNKNOWN',
    battery: d.battery_voltage !== null ? `${d.battery_voltage.toFixed(1)}V` : 'N/A',
    signal: d.signal_strength !== null ? `${d.signal_strength}%` : 'N/A',
  }));

  const overallBattery = primary?.battery_voltage != null
    ? primary.battery_voltage >= 15.5 ? 'GREEN' : primary.battery_voltage >= 14.5 ? 'AMBER' : 'RED'
    : 'UNKNOWN';
  const overallSignal = primary?.signal_strength != null
    ? primary.signal_strength >= 70 ? 'GREEN' : primary.signal_strength >= 50 ? 'AMBER' : 'RED'
    : 'UNKNOWN';
  return { fleetStatus, overallBattery, overallSignal };
}

function buildCommand(_mission) {
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

  // 4. VISUAL DEBRIEF
  lines.push('4. VISUAL DEBRIEF');
  lines.push(DASH);
  lines.push('');
  if (briefing.visualDebrief.runs.length > 0) {
    lines.push(`  RT-DETR Analysis Runs: ${briefing.visualDebrief.runs.length}`);
    lines.push(`  Total Objects Detected: ${briefing.visualDebrief.totalObjects}`);
    lines.push('');
    lines.push('  Object Counts:');
    Object.entries(briefing.visualDebrief.objectCounts).forEach(([label, count]) =>
      lines.push(`    - ${label}: ${count}`),
    );
    lines.push('');
    lines.push('  Recent Runs:');
    briefing.visualDebrief.runs.slice(0, 5).forEach((run) => {
      lines.push(`    - ${run.source} [${run.model}] ${run.createdAt}: ${run.total} object(s)`);
      run.topDetections.forEach((detection) =>
        lines.push(`      * ${detection.label} (${detection.confidence})`),
      );
    });
  } else {
    lines.push('  No RT-DETR frame analysis attached to this mission.');
  }
  lines.push('');

  // 5. SUSTAINMENT
  lines.push('5. SUSTAINMENT');
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

  // 6. COMMAND AND SIGNAL
  lines.push('6. COMMAND AND SIGNAL');
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
