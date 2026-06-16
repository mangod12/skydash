export const SIMULATION_STEP_SECONDS = 5;
export const SCENARIO_SPEEDS = [1, 2, 4];

export const DRONE_TYPES = {
  recon_quad: {
    id: 'recon_quad',
    name: 'Recon Quad',
    shortName: 'Recon',
    color: '#22d3ee',
    speedMps: 18,
    enduranceMin: 32,
    sensorRadiusM: 280,
    payload: 'EO camera',
    pattern: 'orbit',
    powerDraw: 1.0,
  },
  thermal_search: {
    id: 'thermal_search',
    name: 'Thermal Search',
    shortName: 'Thermal',
    color: '#f59e0b',
    speedMps: 13,
    enduranceMin: 28,
    sensorRadiusM: 360,
    payload: 'Thermal array',
    pattern: 'grid',
    powerDraw: 1.15,
  },
  fixed_wing: {
    id: 'fixed_wing',
    name: 'Fixed Wing',
    shortName: 'Wing',
    color: '#818cf8',
    speedMps: 32,
    enduranceMin: 52,
    sensorRadiusM: 420,
    payload: 'Wide-area scan',
    pattern: 'waypoint',
    powerDraw: 0.85,
  },
  heavy_lift: {
    id: 'heavy_lift',
    name: 'Heavy Lift',
    shortName: 'Lift',
    color: '#34d399',
    speedMps: 10,
    enduranceMin: 38,
    sensorRadiusM: 220,
    payload: 'Supply pod',
    pattern: 'orbit',
    powerDraw: 1.25,
  },
};

export const FLEET_PRESETS = [
  {
    id: 'rapid-recon',
    name: 'Rapid Recon',
    summary: 'Fast first-look coverage for uncertain incidents.',
    drones: ['recon_quad', 'recon_quad', 'fixed_wing'],
    coverageMultiplier: 1.0,
    responseBias: 1.12,
  },
  {
    id: 'thermal-search',
    name: 'Thermal Search',
    summary: 'Heat-signature sweep for rescue and wildfire work.',
    drones: ['thermal_search', 'thermal_search', 'recon_quad'],
    coverageMultiplier: 1.08,
    responseBias: 0.96,
  },
  {
    id: 'wide-area',
    name: 'Wide Area Sweep',
    summary: 'Long-range fixed-wing coverage over a broad AO.',
    drones: ['fixed_wing', 'fixed_wing', 'recon_quad'],
    coverageMultiplier: 1.18,
    responseBias: 1.04,
  },
  {
    id: 'relief-lift',
    name: 'Relief Lift',
    summary: 'Search support plus supply delivery capacity.',
    drones: ['heavy_lift', 'thermal_search', 'recon_quad'],
    coverageMultiplier: 0.9,
    responseBias: 0.88,
  },
];

export const SCENARIOS = [
  {
    id: 'wildfire-search',
    name: 'Wildfire Search',
    tag: 'SAFETY',
    icon: 'fire',
    objective: 'Locate heat signatures and map a safe responder corridor before winds shift.',
    location: 'Santa Cruz Mountains',
    center: [37.1624, -122.1486],
    zoom: 13,
    durationSeconds: 180,
    radiusM: 1150,
    baseRisk: 72,
    targetCoverage: 82,
    accent: '#f97316',
    events: [
      { id: 'wf-smoke', time: 20, label: 'Smoke column detected', type: 'detection', severity: 'warning', offset: [260, -420] },
      { id: 'wf-hotspot', time: 55, label: 'Thermal hotspot isolated', type: 'detection', severity: 'critical', offset: [-180, 260] },
      { id: 'wf-corridor', time: 95, label: 'Responder corridor mapped', type: 'relief', severity: 'info', offset: [520, 180] },
    ],
  },
  {
    id: 'disaster-relief',
    name: 'Disaster Relief',
    tag: 'RESPONSE',
    icon: 'relief',
    objective: 'Prioritize blocked streets, supply drop zones, and safe landing corridors.',
    location: 'Oakland Emergency Grid',
    center: [37.8044, -122.2712],
    zoom: 13,
    durationSeconds: 180,
    radiusM: 980,
    baseRisk: 66,
    targetCoverage: 78,
    accent: '#22c55e',
    events: [
      { id: 'dr-road', time: 25, label: 'Road obstruction confirmed', type: 'hazard', severity: 'warning', offset: [-240, -320] },
      { id: 'dr-med', time: 70, label: 'Medical supply zone cleared', type: 'relief', severity: 'info', offset: [380, 250] },
      { id: 'dr-roof', time: 120, label: 'Rooftop signal spotted', type: 'detection', severity: 'critical', offset: [120, -580] },
    ],
  },
  {
    id: 'airport-safety',
    name: 'Airport Airspace Safety',
    tag: 'AIRSPACE',
    icon: 'airspace',
    objective: 'Monitor controlled airspace and deconflict emergency response traffic.',
    location: 'SFO Perimeter',
    center: [37.6213, -122.3790],
    zoom: 13,
    durationSeconds: 170,
    radiusM: 1350,
    baseRisk: 69,
    targetCoverage: 84,
    accent: '#38bdf8',
    events: [
      { id: 'ap-approach', time: 30, label: 'Approach lane checked', type: 'airspace', severity: 'info', offset: [-620, 120] },
      { id: 'ap-object', time: 72, label: 'Foreign object report', type: 'hazard', severity: 'warning', offset: [260, 540] },
      { id: 'ap-deconflict', time: 118, label: 'Response lane deconflicted', type: 'relief', severity: 'info', offset: [620, -260] },
    ],
  },
  {
    id: 'missing-hiker',
    name: 'Missing Hiker Search',
    tag: 'RESCUE',
    icon: 'rescue',
    objective: 'Sweep ridge trails, identify heat signatures, and guide ground teams.',
    location: 'Mount Tamalpais Trail',
    center: [37.9235, -122.5965],
    zoom: 13,
    durationSeconds: 190,
    radiusM: 1250,
    baseRisk: 74,
    targetCoverage: 80,
    accent: '#a78bfa',
    events: [
      { id: 'mh-pack', time: 35, label: 'Trail marker anomaly found', type: 'detection', severity: 'warning', offset: [420, -280] },
      { id: 'mh-thermal', time: 88, label: 'Possible thermal signature', type: 'detection', severity: 'critical', offset: [-360, 380] },
      { id: 'mh-team', time: 135, label: 'Ground team routed', type: 'relief', severity: 'info', offset: [180, 650] },
    ],
  },
];

export const INJECTION_EVENTS = [
  { id: 'wind-shift', label: 'Wind Shift', severity: 'warning', type: 'weather', coveragePenalty: 9, riskPenalty: 7, batteryPenalty: 3, signalPenalty: 0, offset: [720, -420] },
  { id: 'signal-loss', label: 'Signal Loss', severity: 'warning', type: 'comms', coveragePenalty: 5, riskPenalty: 8, batteryPenalty: 0, signalPenalty: 34, offset: [-680, 120] },
  { id: 'new-detection', label: 'New Detection', severity: 'critical', type: 'detection', coveragePenalty: 0, riskPenalty: -10, batteryPenalty: 1, signalPenalty: 0, offset: [120, 760] },
  { id: 'battery-drain', label: 'Battery Drain', severity: 'warning', type: 'fleet', coveragePenalty: 4, riskPenalty: 6, batteryPenalty: 13, signalPenalty: 0, offset: [-220, -720] },
];

export const DEFAULT_SCENARIO_ID = SCENARIOS[0].id;
export const DEFAULT_FLEET_PRESET_ID = 'thermal-search';

export function getScenarioById(id) {
  return SCENARIOS.find((scenario) => scenario.id === id) || SCENARIOS[0];
}

export function getFleetPresetById(id) {
  return FLEET_PRESETS.find((preset) => preset.id === id) || FLEET_PRESETS[0];
}

export function getInjectionById(id) {
  return INJECTION_EVENTS.find((event) => event.id === id) || null;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function coordinateFromOffset(center, northM, eastM) {
  const lat = center[0] + northM / 111320;
  const lng = center[1] + eastM / (111320 * Math.cos((center[0] * Math.PI) / 180));
  return [Number(lat.toFixed(6)), Number(lng.toFixed(6))];
}

function offsetForScenarioEvent(scenario, event) {
  const [northM, eastM] = event.offset;
  return coordinateFromOffset(scenario.center, northM, eastM);
}

function buildInjectedEvent(scenario, injectedEvent) {
  const config = getInjectionById(injectedEvent.id);
  if (!config) return null;
  const [northM, eastM] = config.offset;
  return {
    ...config,
    id: `${config.id}-${injectedEvent.injectedAt}`,
    sourceId: config.id,
    time: injectedEvent.injectedAt,
    coordinates: coordinateFromOffset(scenario.center, northM, eastM),
    injected: true,
  };
}

function routePosition(scenario, profile, droneIndex, droneCount, elapsedSeconds) {
  const duration = scenario.durationSeconds;
  const progress = clamp(elapsedSeconds / duration, 0, 1);
  const lapFactor = 0.72 + profile.speedMps / 45;
  const angle = progress * Math.PI * 2 * lapFactor + (droneIndex * Math.PI * 2) / Math.max(1, droneCount);
  const sweep = scenario.radiusM * (0.45 + droneIndex * 0.09);
  const north = Math.sin(angle) * sweep + Math.sin(progress * Math.PI * (droneIndex + 1)) * 180;
  const east = Math.cos(angle) * sweep * 1.18 + Math.cos(progress * Math.PI * 0.5) * (droneIndex - 1) * 120;
  return coordinateFromOffset(scenario.center, north, east);
}

function headingBetween(prev, next) {
  const dy = next[0] - prev[0];
  const dx = next[1] - prev[1];
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}

function buildDrone(scenario, preset, typeId, index, elapsedSeconds, injectedEvents) {
  const profile = DRONE_TYPES[typeId] || DRONE_TYPES.recon_quad;
  const position = routePosition(scenario, profile, index, preset.drones.length, elapsedSeconds);
  const previous = routePosition(scenario, profile, index, preset.drones.length, Math.max(0, elapsedSeconds - 5));
  const progress = clamp(elapsedSeconds / scenario.durationSeconds, 0, 1);
  const batteryPenalty = injectedEvents.reduce((sum, item) => sum + (getInjectionById(item.id)?.batteryPenalty || 0), 0);
  const signalPenalty = injectedEvents.reduce((sum, item) => sum + (getInjectionById(item.id)?.signalPenalty || 0), 0);
  const batteryPercentage = clamp(Math.round(100 - progress * (42 + profile.powerDraw * 11) - index * 3 - batteryPenalty), 8, 100);
  const signalStrength = clamp(Math.round(96 - progress * 9 - signalPenalty - index * 2), 18, 99);
  const batteryVoltage = Number((13.8 + batteryPercentage * 0.034).toFixed(1));

  return {
    drone_id: `SCN-${String(index + 1).padStart(2, '0')}`,
    profileId: profile.id,
    profileName: profile.name,
    payload: profile.payload,
    color: profile.color,
    gps: { latitude: position[0], longitude: position[1], satellites: signalStrength > 40 ? 12 : 7 },
    altitude: Math.round(72 + index * 18 + (profile.speedMps > 25 ? 45 : 0)),
    ground_speed: Number((profile.speedMps * (0.82 + progress * 0.12)).toFixed(1)),
    battery_percentage: batteryPercentage,
    battery_voltage: batteryVoltage,
    signal_strength: signalStrength,
    flight_mode: elapsedSeconds >= scenario.durationSeconds ? 'COMPLETE' : 'AUTO',
    pattern: profile.pattern,
    attitude: { yaw: headingBetween(previous, position) },
    sensorRadiusM: profile.sensorRadiusM,
    scenario: true,
  };
}

function buildDronePath(scenario, preset, typeId, index, elapsedSeconds) {
  const profile = DRONE_TYPES[typeId] || DRONE_TYPES.recon_quad;
  const sampleEvery = 15;
  const sampleCount = Math.max(1, Math.floor(elapsedSeconds / sampleEvery));
  const points = [];
  for (let i = 0; i <= sampleCount; i += 1) {
    points.push(routePosition(scenario, profile, index, preset.drones.length, i * sampleEvery));
  }
  if (elapsedSeconds > 0) {
    const latest = routePosition(scenario, profile, index, preset.drones.length, elapsedSeconds);
    const last = points[points.length - 1];
    if (!last || last[0] !== latest[0] || last[1] !== latest[1]) points.push(latest);
  }
  return { droneId: `SCN-${String(index + 1).padStart(2, '0')}`, color: profile.color, points };
}

function visibleScenarioEvents(scenario, elapsedSeconds) {
  return scenario.events
    .filter((event) => event.time <= elapsedSeconds)
    .map((event) => ({
      ...event,
      coordinates: offsetForScenarioEvent(scenario, event),
      injected: false,
    }));
}

function calculateScorecard(scenario, preset, fleet, events, injectedEvents, elapsedSeconds) {
  const progress = clamp(elapsedSeconds / scenario.durationSeconds, 0, 1);
  const avgSensor = fleet.reduce((sum, drone) => sum + drone.sensorRadiusM, 0) / Math.max(1, fleet.length);
  const coveragePenalty = injectedEvents.reduce((sum, item) => sum + (getInjectionById(item.id)?.coveragePenalty || 0), 0);
  const riskPenalty = injectedEvents.reduce((sum, item) => sum + (getInjectionById(item.id)?.riskPenalty || 0), 0);
  const coverage = clamp(Math.round(progress * 100 * preset.coverageMultiplier + avgSensor / 28 - coveragePenalty), 0, 100);
  const batteryReserve = Math.round(fleet.reduce((sum, drone) => sum + drone.battery_percentage, 0) / Math.max(1, fleet.length));
  const detections = events.filter((event) => event.type === 'detection').length;
  const responseTime = events.length > 0 ? Math.min(...events.map((event) => event.time)) : null;
  const riskReduced = clamp(Math.round(coverage * 0.58 + detections * 7 + preset.responseBias * 10 - riskPenalty), 0, 100);
  const success = coverage >= scenario.targetCoverage && batteryReserve >= 22 && riskReduced >= 65;

  return {
    coverage,
    batteryReserve,
    detections,
    responseTime,
    riskReduced,
    success,
    grade: riskReduced >= 82 && coverage >= 85 ? 'A' : riskReduced >= 70 ? 'B' : riskReduced >= 55 ? 'C' : 'D',
  };
}

export function buildScenarioFrame(state) {
  const scenario = getScenarioById(state.activeScenarioId);
  const preset = getFleetPresetById(state.selectedFleetPresetId);
  const elapsedSeconds = clamp(state.elapsedSeconds || 0, 0, scenario.durationSeconds);
  const injectedEvents = state.injectedEvents || [];
  const fleet = preset.drones.map((typeId, index) => buildDrone(scenario, preset, typeId, index, elapsedSeconds, injectedEvents));
  const plannedEvents = visibleScenarioEvents(scenario, elapsedSeconds);
  const injected = injectedEvents.map((event) => buildInjectedEvent(scenario, event)).filter(Boolean);
  const events = [...plannedEvents, ...injected].sort((a, b) => a.time - b.time);
  const paths = preset.drones.map((typeId, index) => buildDronePath(scenario, preset, typeId, index, elapsedSeconds));
  const scorecard = calculateScorecard(scenario, preset, fleet, events, injectedEvents, elapsedSeconds);
  const primary = fleet[0] || null;

  return {
    scenario,
    preset,
    elapsedSeconds,
    remainingSeconds: Math.max(0, scenario.durationSeconds - elapsedSeconds),
    progress: scenario.durationSeconds > 0 ? Math.round((elapsedSeconds / scenario.durationSeconds) * 100) : 0,
    fleet,
    paths,
    events,
    scorecard,
    primaryTelemetry: primary ? {
      drone_id: primary.drone_id,
      timestamp: elapsedSeconds,
      altitude: primary.altitude,
      ground_speed: primary.ground_speed,
      battery_voltage: primary.battery_voltage,
      battery_percentage: primary.battery_percentage,
      signal_strength: primary.signal_strength,
      flight_mode: primary.flight_mode,
      attitude: primary.attitude,
      gps: primary.gps,
    } : null,
  };
}

export function formatScenarioTime(seconds) {
  const total = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
