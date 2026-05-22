import { format } from 'date-fns';
import { escapeHtml } from './sanitize';

const TIMESTAMP = () => format(new Date(), 'yyyy-MM-dd HH:mm:ss');
const SEPARATOR = '='.repeat(60);
const DASH = '-'.repeat(60);

const THREAT_KML_COLORS = {
  none: 'ff00ff00',
  low: 'ff00ffff',
  medium: 'ff00a5ff',
  high: 'ff0000ff',
  critical: 'ff0000ff',
};

function escapeXml(str) {
  return escapeHtml(String(str));
}

function escapeCsv(val) {
  const str = String(val ?? '');
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"` : str;
}

export function generateGeoJSON(entities) {
  const features = entities
    .filter((e) => e.coordinates)
    .map((e) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [e.coordinates[1], e.coordinates[0]],
      },
      properties: {
        id: e.id,
        name: e.name,
        type: e.type,
        threatLevel: e.threatLevel,
        confidence: e.confidence,
        source: e.source,
        tags: e.tags,
        ...e.properties,
      },
    }));

  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

export function generateKML(entities) {
  const dateStr = format(new Date(), 'yyyy-MM-dd HH:mm');
  const groups = {};
  entities.forEach((e) => {
    const key = e.type.charAt(0).toUpperCase() + e.type.slice(1) + 's';
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  const styles = Object.entries(THREAT_KML_COLORS)
    .map(([level, color]) =>
      `    <Style id="threat-${level}"><IconStyle><color>${color}</color></IconStyle></Style>`)
    .join('\n');

  const folders = Object.entries(groups).map(([name, ents]) => {
    const placemarks = ents.map((e) => {
      const lon = e.coordinates?.[1] ?? 0;
      const lat = e.coordinates?.[0] ?? 0;
      const desc = `Threat: ${(e.threatLevel || 'none').toUpperCase()} | Confidence: ${e.confidence}%`;
      return `      <Placemark>
        <name>${escapeXml(e.name)}</name>
        <description>${escapeXml(desc)}</description>
        <styleUrl>#threat-${e.threatLevel || 'none'}</styleUrl>
        <Point><coordinates>${lon},${lat},0</coordinates></Point>
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

export function generateCSV(entities, relationships) {
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
      e.coordinates?.[0] ?? '', e.coordinates?.[1] ?? '',
      (e.tags || []).join(';'),
      e.firstSeen ? format(e.firstSeen, 'yyyy-MM-dd HH:mm:ss') : '',
      e.lastSeen ? format(e.lastSeen, 'yyyy-MM-dd HH:mm:ss') : '',
      props, rels,
    ].map(escapeCsv).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function generateDossier(entity, relationships, events, allEntities) {
  const resolve = (id) => allEntities.find((e) => e.id === id)?.name || id;
  let doc = `ENTITY DOSSIER: ${entity.name}
${SEPARATOR}
Generated: ${TIMESTAMP()} UTC
Classification: UNCLASSIFIED

IDENTIFICATION
${DASH}
ID:          ${entity.id}
Name:        ${entity.name}
Type:        ${entity.type.toUpperCase()}
Threat:      ${(entity.threatLevel || 'none').toUpperCase()}
Confidence:  ${entity.confidence}%
Source:      ${entity.source}
`;

  if (entity.coordinates) {
    doc += `Location:    ${entity.coordinates[0].toFixed(6)}, ${entity.coordinates[1].toFixed(6)}\n`;
  }

  doc += `Tags:        ${(entity.tags || []).join(', ') || 'none'}\n`;

  if (entity.firstSeen) {
    doc += `First Seen:  ${format(entity.firstSeen, 'yyyy-MM-dd HH:mm:ss')}\n`;
  }
  if (entity.lastSeen) {
    doc += `Last Seen:   ${format(entity.lastSeen, 'yyyy-MM-dd HH:mm:ss')}\n`;
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
      doc += `  ${dir} ${r.type.toUpperCase()} ${target} (conf: ${r.confidence}%)\n`;
    });
  }

  if (events.length > 0) {
    doc += `\nTIMELINE EVENTS (${events.length})\n${DASH}\n`;
    events.forEach((evt) => {
      doc += `  ${format(evt.time, 'yyyy-MM-dd HH:mm:ss')} [${evt.severity.toUpperCase()}] ${evt.description}\n`;
    });
  }

  doc += `\n${SEPARATOR}\nEND OF DOSSIER\n`;
  return doc;
}

export function generateMissionBrief(mission, entities, events, notes) {
  let doc = `MISSION BRIEF: ${mission.name}
${SEPARATOR}
Generated: ${TIMESTAMP()} UTC
Classification: UNCLASSIFIED

MISSION OVERVIEW
${DASH}
Name:        ${mission.name}
Status:      ${(mission.status || 'active').toUpperCase()}
`;

  if (mission.description) {
    doc += `Description: ${mission.description}\n`;
  }
  if (mission.created_at) {
    doc += `Created:     ${format(new Date(mission.created_at), 'yyyy-MM-dd HH:mm:ss')}\n`;
  }

  doc += `\nLINKED ENTITIES (${entities.length})\n${DASH}\n`;
  if (entities.length === 0) {
    doc += '  (none)\n';
  } else {
    entities.forEach((e, i) => {
      doc += `  ${i + 1}. ${e.name} [${e.type.toUpperCase()}] — Threat: ${(e.threatLevel || 'none').toUpperCase()}, Confidence: ${e.confidence}%\n`;
      if (e.coordinates) {
        doc += `     Location: ${e.coordinates[0].toFixed(6)}, ${e.coordinates[1].toFixed(6)}\n`;
      }
    });
  }

  if (notes.length > 0) {
    doc += `\nMISSION NOTES (${notes.length})\n${DASH}\n`;
    notes.forEach((n) => {
      const ts = n.created_at ? format(new Date(n.created_at), 'yyyy-MM-dd HH:mm') : 'N/A';
      doc += `  [${ts}] ${n.content}\n`;
    });
  }

  const missionEvents = events.filter((evt) =>
    entities.some((e) => e.id === evt.entityId),
  );
  if (missionEvents.length > 0) {
    doc += `\nRELATED EVENTS (${missionEvents.length})\n${DASH}\n`;
    missionEvents.forEach((evt) => {
      doc += `  ${format(evt.time, 'yyyy-MM-dd HH:mm:ss')} [${evt.severity.toUpperCase()}] ${evt.description}\n`;
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
