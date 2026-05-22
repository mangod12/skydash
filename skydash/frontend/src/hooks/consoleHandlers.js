import { useIntelStore } from '../stores/intelStore';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useMapStore } from '../stores/mapStore';
import { useUIStore } from '../stores/uiStore';
import { useMissionStore } from '../stores/missionStore';
import useNotificationStore from '../stores/notificationStore';
import {
  generateGeoJSON, generateCSV, generateKML, downloadFile,
} from '../utils/exportGenerators';
import { format } from 'date-fns';

const THREAT_LABELS = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };
const SEP = '-'.repeat(32);
const SEP_LONG = '-'.repeat(40);

export const COMMANDS = [
  { name: 'help', desc: 'List available commands' },
  { name: 'status', desc: 'Show system status (drones, entities, connections)' },
  { name: 'entity', desc: 'Search and display entity info', usage: 'entity <name>' },
  { name: 'fly', desc: 'Navigate map to entity location', usage: 'fly <entity name>' },
  { name: 'alert', desc: 'Create a manual alert notification', usage: 'alert <message>' },
  { name: 'export', desc: 'Trigger data export', usage: 'export <geojson|csv|kml>' },
  { name: 'theme', desc: 'Switch UI theme', usage: 'theme <midnight|tactical|arctic>' },
  { name: 'clear', desc: 'Clear console output' },
  { name: 'drone', desc: 'Send drone command (simulated)', usage: 'drone <id> <orbit|rtl|hover|grid>' },
  { name: 'entities', desc: 'List all tracked entities' },
  { name: 'missions', desc: 'List missions' },
  { name: 'goto', desc: 'Navigate to a view', usage: 'goto <dashboard|map|intel|telemetry|missions|analytics|settings>' },
];

export const COMMAND_NAMES = COMMANDS.map((c) => c.name);

export function findEntity(entities, query) {
  const q = query.toLowerCase().trim();
  return entities.find((e) => e.name.toLowerCase() === q || e.id.toLowerCase() === q)
    || entities.find((e) => e.name.toLowerCase().includes(q));
}

function ts(val) {
  try { return format(val, 'yyyy-MM-dd HH:mm:ss'); }
  catch { return 'N/A'; }
}

export function handleHelp() {
  return [
    '  SKYDASH CONSOLE v1.0',
    '  ' + SEP_LONG,
    ...COMMANDS.map((c) => `  ${(c.usage || c.name).padEnd(32)} ${c.desc}`),
    '',
    '  Tab to autocomplete. Up/Down for history. Esc to close.',
  ];
}

export function handleStatus() {
  const { isConnected, fleet, data, latency } = useTelemetryStore.getState();
  const entities = useIntelStore.getState().entities;
  const missions = useMissionStore.getState().missions;
  const { unreadCount } = useNotificationStore.getState();

  return [
    '  SYSTEM STATUS', '  ' + SEP,
    `  Connection:   ${isConnected ? 'ONLINE' : 'OFFLINE'}`,
    `  Latency:      ${latency}ms`,
    `  Drones:       ${fleet.length || (data ? 1 : 0)} active`,
    `  Active Drone: ${data?.drone_id || 'N/A'}`,
    `  Altitude:     ${data?.altitude?.toFixed(1) || 'N/A'}m`,
    `  Battery:      ${data?.battery_voltage?.toFixed(1) || 'N/A'}V`,
    `  Entities:     ${entities.length} tracked`,
    `  Missions:     ${missions.length} loaded`,
    `  Alerts:       ${unreadCount} unread`,
    `  Theme:        ${useUIStore.getState().theme.toUpperCase()}`,
  ];
}

export function handleEntity(args) {
  if (!args.trim()) return ['  Usage: entity <name or id>'];
  const entities = useIntelStore.getState().entities;
  const match = findEntity(entities, args);
  if (!match) return [`  Entity not found: "${args}"`];

  const rels = useIntelStore.getState().getEntityRelationships(match.id);
  const lines = [
    `  ENTITY: ${match.name}`, '  ' + SEP,
    `  ID:         ${match.id}`,
    `  Type:       ${match.type.toUpperCase()}`,
    `  Threat:     ${THREAT_LABELS[match.threatLevel] || 'NONE'}`,
    `  Confidence: ${match.confidence}%`,
    `  Source:     ${match.source}`,
    `  Tags:       ${(match.tags || []).join(', ') || 'none'}`,
  ];

  if (match.coordinates) lines.push(`  Location:   ${match.coordinates[0].toFixed(6)}, ${match.coordinates[1].toFixed(6)}`);
  if (match.firstSeen) lines.push(`  First Seen: ${ts(match.firstSeen)}`);
  if (match.lastSeen) lines.push(`  Last Seen:  ${ts(match.lastSeen)}`);

  if (Object.keys(match.properties || {}).length > 0) {
    lines.push('', '  PROPERTIES');
    Object.entries(match.properties).forEach(([k, v]) => {
      lines.push(`    ${k.padEnd(14)} ${v}`);
    });
  }

  if (rels.length > 0) {
    lines.push('', `  RELATIONSHIPS (${rels.length})`);
    rels.forEach((r) => {
      const isFrom = r.from === match.id;
      const target = entities.find((e) => e.id === (isFrom ? r.to : r.from))?.name || (isFrom ? r.to : r.from);
      lines.push(`    ${isFrom ? '-->' : '<--'} ${r.type.toUpperCase()} ${target}`);
    });
  }

  return lines;
}

export function handleFly(args) {
  if (!args.trim()) return ['  Usage: fly <entity name>'];
  const entities = useIntelStore.getState().entities;
  const match = findEntity(entities, args);
  if (!match) return [`  Entity not found: "${args}"`];
  if (!match.coordinates) return [`  Entity "${match.name}" has no coordinates`];

  useMapStore.getState().flyTo(match.coordinates, 17);
  useUIStore.getState().setActiveView('map');
  useIntelStore.getState().selectEntity(match.id);
  return [`  Flying to ${match.name} [${match.coordinates[0].toFixed(4)}, ${match.coordinates[1].toFixed(4)}]`];
}

export function handleAlert(args) {
  if (!args.trim()) return ['  Usage: alert <message>'];
  useNotificationStore.getState().addNotification({
    type: 'alert', title: 'Manual Alert', message: args.trim(), severity: 'warning',
  });
  return [`  Alert created: ${args.trim()}`];
}

export function handleExport(args) {
  const fmt = args.trim().toLowerCase();
  const valid = ['geojson', 'csv', 'kml'];
  if (!valid.includes(fmt)) return [`  Usage: export <${valid.join('|')}>`];

  const { entities, relationships } = useIntelStore.getState();
  const stamp = format(new Date(), 'yyyyMMdd-HHmm');

  if (fmt === 'geojson') downloadFile(generateGeoJSON(entities), `skydash-${stamp}.geojson`, 'application/geo+json');
  else if (fmt === 'csv') downloadFile(generateCSV(entities, relationships), `skydash-${stamp}.csv`, 'text/csv');
  else if (fmt === 'kml') downloadFile(generateKML(entities), `skydash-${stamp}.kml`, 'application/vnd.google-earth.kml+xml');

  return [`  Exported ${entities.length} entities as ${fmt.toUpperCase()}`];
}

export function handleTheme(args) {
  const name = args.trim().toLowerCase();
  const valid = ['midnight', 'tactical', 'arctic'];
  if (!valid.includes(name)) return [`  Usage: theme <${valid.join('|')}>`, `  Current: ${useUIStore.getState().theme}`];
  useUIStore.getState().setTheme(name);
  return [`  Theme switched to ${name.toUpperCase()}`];
}

export function handleDrone(args) {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 2) return ['  Usage: drone <id> <orbit|rtl|hover|grid>'];
  const [droneId, cmd] = parts;
  const valid = ['orbit', 'rtl', 'hover', 'grid'];
  if (!valid.includes(cmd.toLowerCase())) return [`  Unknown drone command. Valid: ${valid.join(', ')}`];
  return [
    `  CMD >> ${droneId.toUpperCase()}: ${cmd.toUpperCase()}`,
    `  Drone ${droneId} acknowledged command: ${cmd.toUpperCase()}`,
    '  [SIM] Pattern change will take effect next telemetry cycle',
  ];
}

export function handleEntities() {
  const entities = useIntelStore.getState().entities;
  if (entities.length === 0) return ['  No entities tracked'];
  const lines = [`  TRACKED ENTITIES (${entities.length})`, '  ' + SEP_LONG];
  entities.forEach((e) => {
    const threat = (THREAT_LABELS[e.threatLevel] || 'NONE').padEnd(9);
    lines.push(`  ${e.id.padEnd(12)} ${e.name.padEnd(24)} ${threat} ${e.confidence}%`);
  });
  return lines;
}

export function handleMissions() {
  const missions = useMissionStore.getState().missions;
  if (missions.length === 0) return ['  No missions loaded'];
  const lines = [`  MISSIONS (${missions.length})`, '  ' + SEP_LONG];
  missions.forEach((m) => {
    const status = (m.status || 'draft').toUpperCase().padEnd(10);
    lines.push(`  ${String(m.id).padEnd(6)} ${(m.name || 'Unnamed').padEnd(24)} ${status}`);
  });
  return lines;
}

export function handleGoto(args) {
  const view = args.trim().toLowerCase();
  const valid = ['dashboard', 'map', 'intel', 'telemetry', 'missions', 'analytics', 'settings'];
  if (!valid.includes(view)) return [`  Usage: goto <${valid.join('|')}>`];
  useUIStore.getState().setActiveView(view);
  return [`  Navigated to ${view.toUpperCase()}`];
}
