// Cursor on Target (CoT) XML interop for ATAK / WinTAK / TAK Server.
// Export: one <event> per geo-located entity. Import: one entity per <event> with a valid point.

const TYPE_TO_COT = {
  vehicle: 'G-E-V',
  person: 'G-U-C',
  building: 'G-I',
  device: 'G-E-S',
};

const STALE_MS = 15 * 60 * 1000;

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Hostile for high/critical threats, unknown for medium, neutral otherwise. */
export function affiliationFor(threatLevel) {
  if (threatLevel === 'critical' || threatLevel === 'high') return 'h';
  if (threatLevel === 'medium') return 'u';
  return 'n';
}

export function cotTypeFor(entity) {
  const dim = TYPE_TO_COT[entity.type] || 'G';
  return `a-${affiliationFor(entity.threatLevel)}-${dim}`;
}

export function generateCoT(entities, now = Date.now()) {
  const events = (entities || [])
    .filter((e) => Array.isArray(e.coordinates)
      && Number.isFinite(e.coordinates[0]) && Number.isFinite(e.coordinates[1]))
    .map((e) => {
      const time = new Date(now).toISOString();
      const stale = new Date(now + STALE_MS).toISOString();
      const remarks = [e.source && `source: ${e.source}`, Number.isFinite(e.confidence) && `confidence: ${e.confidence}%`,
        e.threatLevel && `threat: ${e.threatLevel}`, e.tags?.length && `tags: ${e.tags.join(', ')}`]
        .filter(Boolean).join('; ');
      return `  <event version="2.0" uid="${esc(e.id)}" type="${cotTypeFor(e)}" how="h-e" time="${time}" start="${time}" stale="${stale}">
    <point lat="${e.coordinates[0]}" lon="${e.coordinates[1]}" hae="9999999.0" ce="9999999.0" le="9999999.0"/>
    <detail>
      <contact callsign="${esc(e.name || e.id)}"/>
      <remarks>${esc(remarks)}</remarks>
      <skydash type="${esc(e.type)}" threat="${esc(e.threatLevel)}" confidence="${esc(e.confidence)}"/>
    </detail>
  </event>`;
    });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<events>\n${events.join('\n')}\n</events>\n`;
}

function entityTypeFromCot(cotType) {
  const parts = cotType.split('-');
  const rest = parts.slice(2).join('-');
  if (rest.startsWith('G-E-V') || rest.startsWith('G-V')) return 'vehicle';
  if (rest.startsWith('G-U')) return 'person';
  if (rest.startsWith('G-I')) return 'building';
  return 'device';
}

function threatFromAffiliation(aff) {
  if (aff === 'h') return 'high';
  if (aff === 'j' || aff === 's') return 'high';
  if (aff === 'u' || aff === 'p' || aff === 'a') return 'medium';
  return 'low';
}

/**
 * Parse CoT XML (a single <event> or an <events> wrapper) into SkyDash entities.
 * Returns { entities, skipped }; events without a valid point or non-atom types are skipped.
 */
export function parseCoT(xml, { parser = new DOMParser() } = {}) {
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid CoT XML');
  }
  const entities = [];
  let skipped = 0;
  for (const ev of Array.from(doc.getElementsByTagName('event'))) {
    const type = ev.getAttribute('type') || '';
    const point = ev.getElementsByTagName('point')[0];
    const lat = point ? parseFloat(point.getAttribute('lat')) : NaN;
    const lon = point ? parseFloat(point.getAttribute('lon')) : NaN;
    if (!type.startsWith('a-') || !Number.isFinite(lat) || !Number.isFinite(lon)
      || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      skipped += 1;
      continue;
    }
    const uid = ev.getAttribute('uid') || `cot-${entities.length}`;
    const callsign = ev.getElementsByTagName('contact')[0]?.getAttribute('callsign');
    const sd = ev.getElementsByTagName('skydash')[0];
    const aff = type.split('-')[1];
    const conf = parseFloat(sd?.getAttribute('confidence'));
    const time = Date.parse(ev.getAttribute('time') || '');
    entities.push({
      id: `cot-${uid}`.replace(/[^A-Za-z0-9_.-]/g, '_'),
      type: sd?.getAttribute('type') || entityTypeFromCot(type),
      name: callsign || uid,
      coordinates: [lat, lon],
      properties: { cot_type: type, cot_uid: uid },
      confidence: Number.isFinite(conf) ? conf : 50,
      source: 'CoT import',
      firstSeen: Number.isFinite(time) ? time : Date.now(),
      lastSeen: Number.isFinite(time) ? time : Date.now(),
      tags: ['cot-import'],
      threatLevel: sd?.getAttribute('threat') || threatFromAffiliation(aff),
    });
  }
  return { entities, skipped };
}
