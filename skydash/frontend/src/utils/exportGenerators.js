import { format } from 'date-fns';
import { escapeXml } from './sanitize';

const TIMESTAMP = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const SEPARATOR = '='.repeat(60);
const DASH = '-'.repeat(60);

const THREAT_KML_COLORS = {
  none: 'ff00ff00',
  low: 'ff00ffff',
  medium: 'ff00a5ff',
  high: 'ff0000ff',
  critical: 'ff0000ff',
};

// Text that starts with = + - @ is read as a formula by Excel and Sheets.
// Plain numbers (negative coordinates) are left alone.
export function neutraliseFormula(val) {
  if (typeof val !== 'string') return String(val ?? '');
  if (/^[=+\-@\t\r]/.test(val) && !/^-?\d+(\.\d+)?$/.test(val)) return `'${val}`;
  return val;
}

function escapeCsv(val) {
  const str = neutraliseFormula(val);
  return str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')
    ? `"${str.replace(/"/g, '""')}"` : str;
}

function hasValidPosition(entity) {
  const coords = entity?.coordinates;
  return Array.isArray(coords) && coords.length >= 2
    && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
    && Math.abs(coords[0]) <= 90 && Math.abs(coords[1]) <= 180;
}

export function generateGeoJSON(entities) {
  const features = (Array.isArray(entities) ? entities : [])
    .filter(hasValidPosition)
    .map((e) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [e.coordinates[1], e.coordinates[0]],
      },
      properties: {
        ...e.properties,
        id: e.id,
        name: e.name,
        type: e.type,
        threatLevel: e.threatLevel,
        confidence: e.confidence,
        source: e.source,
        tags: e.tags,
      },
    }));

  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

export function generateKML(entities) {
  const dateStr = format(new Date(), 'yyyy-MM-dd HH:mm');
  const groups = new Map();
  (Array.isArray(entities) ? entities : []).filter((e) => e && typeof e === 'object').forEach((e) => {
    const type = typeof e.type === 'string' && e.type ? e.type : 'event';
    const key = type.charAt(0).toUpperCase() + type.slice(1) + 's';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });

  const styles = Object.entries(THREAT_KML_COLORS)
    .map(([level, color]) =>
      `    <Style id="threat-${level}"><IconStyle><color>${color}</color></IconStyle></Style>`)
    .join('\n');

  const folders = [...groups].map(([name, ents]) => {
    const placemarks = ents.map((e) => {
      const lat = e.coordinates?.[0];
      const lon = e.coordinates?.[1];
      const located = hasValidPosition(e);
      const geometry = located ? `<Point><coordinates>${lon},${lat},0</coordinates></Point>` : '';
      const threat = Object.hasOwn(THREAT_KML_COLORS, e.threatLevel) ? e.threatLevel : 'none';
      const desc = `Threat: ${threat.toUpperCase()} | Confidence: ${e.confidence}%`;
      return `      <Placemark>
        <name>${escapeXml(e.name)}</name>
        <description>${escapeXml(desc)}</description>
        <styleUrl>#threat-${threat}</styleUrl>
        ${geometry}
      </Placemark>`;
    }).join('\n');

    return `    <Folder>\n      <name>${escapeXml(name)}</name>\n${placemarks}\n    </Folder>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>SkyDash Export - ${dateStr}</name>
${styles}
${folders}
  </Document>
</kml>`;
}

function records(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function exportDate(value, pattern = 'yyyy-MM-dd HH:mm:ss') {
  if (value == null || value === '' || !['string', 'number'].includes(typeof value)) return 'N/A';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? format(date, pattern) : 'N/A';
}

export function generateCSV(entities, relationships) {
  entities = records(entities);
  relationships = records(relationships);
  const headers = [
    'ID', 'Name', 'Type', 'Threat', 'Confidence', 'Source',
    'Latitude', 'Longitude', 'Tags', 'First Seen', 'Last Seen',
    'Properties', 'Related Entities',
  ];

  const rows = entities.map((e) => {
    const rels = relationships
      .filter((r) => r.from === e.id || r.to === e.id)
      .map((r) => {
        const targetId = r.from === e.id ? r.to : r.from;
        return `${targetId}(${r.type})`;
      })
      .join(';');

    const props = e.properties
      ? Object.entries(e.properties).map(([k, v]) => `${k}=${v}`).join(';')
      : '';

    return [
      e.id, e.name, e.type, e.threatLevel, e.confidence, e.source,
      hasValidPosition(e) ? e.coordinates[0] : '', hasValidPosition(e) ? e.coordinates[1] : '',
      Array.isArray(e.tags) ? e.tags.join(';') : '',
      e.firstSeen != null ? exportDate(e.firstSeen) : '',
      e.lastSeen != null ? exportDate(e.lastSeen) : '',
      props, rels,
    ].map(escapeCsv).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function generateDossier(entity, relationships, events, allEntities) {
  relationships = records(relationships);
  events = records(events);
  allEntities = records(allEntities);
  const resolve = (id) => allEntities.find((e) => e.id === id)?.name || id;
  let doc = `ENTITY DOSSIER: ${entity.name}
${SEPARATOR}
Generated: ${TIMESTAMP()} UTC
Classification: UNCLASSIFIED

IDENTIFICATION
${DASH}
ID:          ${entity.id}
Name:        ${entity.name}
Type:        ${String(entity.type || 'event').toUpperCase()}
Threat:      ${String(entity.threatLevel || 'none').toUpperCase()}
Confidence:  ${entity.confidence}%
Source:      ${entity.source}
`;

  if (hasValidPosition(entity)) {
    doc += `Location:    ${entity.coordinates[0].toFixed(6)}, ${entity.coordinates[1].toFixed(6)}\n`;
  }

  doc += `Tags:        ${(Array.isArray(entity.tags) ? entity.tags : []).join(', ') || 'none'}\n`;

  if (entity.firstSeen != null) {
    doc += `First Seen:  ${exportDate(entity.firstSeen)}\n`;
  }
  if (entity.lastSeen != null) {
    doc += `Last Seen:   ${exportDate(entity.lastSeen)}\n`;
  }

  if (entity.properties && Object.keys(entity.properties).length > 0) {
    doc += `\nPROPERTIES\n${DASH}\n`;
    Object.entries(entity.properties).forEach(([k, v]) => {
      doc += `${k.padEnd(14)} ${v}\n`;
    });
  }

  if (relationships.length > 0) {
    doc += `\nRELATIONSHIPS (${relationships.length})\n${DASH}\n`;
    relationships.forEach((r) => {
      const isFrom = r.from === entity.id;
      const target = resolve(isFrom ? r.to : r.from);
      const dir = isFrom ? '-->' : '<--';
      doc += `  ${dir} ${String(r.type || 'unknown').toUpperCase()} ${target} (conf: ${r.confidence}%)\n`;
    });
  }

  if (events.length > 0) {
    doc += `\nTIMELINE EVENTS (${events.length})\n${DASH}\n`;
    events.forEach((evt) => {
      doc += `  ${exportDate(evt.time)} [${String(evt.severity || 'info').toUpperCase()}] ${evt.description}\n`;
    });
  }

  doc += `\n${SEPARATOR}\nEND OF DOSSIER\n`;
  return doc;
}

export function generateMissionBrief(mission, entities, events, notes) {
  entities = records(entities);
  events = records(events);
  notes = records(notes);
  let doc = `MISSION BRIEF: ${mission.name}
${SEPARATOR}
Generated: ${TIMESTAMP()} UTC
Classification: UNCLASSIFIED

MISSION OVERVIEW
${DASH}
Name:        ${mission.name}
Status:      ${String(mission.status || 'active').toUpperCase()}
`;

  if (mission.description) {
    doc += `Description: ${mission.description}\n`;
  }
  if (mission.created_at) {
    doc += `Created:     ${exportDate(mission.created_at)}\n`;
  }

  doc += `\nLINKED ENTITIES (${entities.length})\n${DASH}\n`;
  if (entities.length === 0) {
    doc += '  (none)\n';
  } else {
    entities.forEach((e, i) => {
      doc += `  ${i + 1}. ${e.name} [${String(e.type || 'event').toUpperCase()}] — Threat: ${String(e.threatLevel || 'none').toUpperCase()}, Confidence: ${e.confidence}%\n`;
      if (hasValidPosition(e)) {
        doc += `     Location: ${e.coordinates[0].toFixed(6)}, ${e.coordinates[1].toFixed(6)}\n`;
      }
    });
  }

  if (notes.length > 0) {
    doc += `\nMISSION NOTES (${notes.length})\n${DASH}\n`;
    notes.forEach((n) => {
      const ts = n.created_at ? exportDate(n.created_at, 'yyyy-MM-dd HH:mm') : 'N/A';
      doc += `  [${ts}] ${n.content}\n`;
    });
  }

  const missionEvents = events.filter((evt) =>
    entities.some((e) => e.id === evt.entityId),
  );
  if (missionEvents.length > 0) {
    doc += `\nRELATED EVENTS (${missionEvents.length})\n${DASH}\n`;
    missionEvents.forEach((evt) => {
      doc += `  ${exportDate(evt.time)} [${String(evt.severity || 'info').toUpperCase()}] ${evt.description}\n`;
    });
  }

  doc += `\n${SEPARATOR}\nEND OF BRIEF\n`;
  return doc;
}

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
