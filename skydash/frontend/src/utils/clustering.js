/**
 * Grid-based spatial clustering for map entity markers.
 * No external dependencies — pure coordinate math.
 */

const THREAT_RANK = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** Degrees-per-meter at a given latitude (approximate). */
function degPerMeter(lat) {
  const latRad = (lat * Math.PI) / 180;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(latRad);
  return { lat: 1 / mPerDegLat, lng: 1 / Math.max(mPerDegLng, 1) };
}

/** Pick grid size in meters based on zoom level. */
function gridSizeForZoom(zoom) {
  if (zoom > 14) return 0;       // no clustering
  if (zoom >= 10) return 500;    // ~500 m cells
  return 2000;                   // ~2 km cells
}

/**
 * Cluster entities into grid cells.
 *
 * @param {Array<{id,lat?,lng?,coordinates?,type,threatLevel}>} entities
 * @param {number} zoom   current map zoom level
 * @param {number} [gridOverride]  optional grid size in meters
 * @returns {Array<{lat,lng,count,entities,maxThreat,types}>}
 */
export function clusterEntities(entities, zoom, gridOverride) {
  const gridMeters = gridOverride ?? gridSizeForZoom(zoom);

  // Normalise coordinates — support both {lat,lng} and [lat,lng] forms
  const items = entities.map((e) => {
    const lat = e.lat ?? e.coordinates?.[0] ?? null;
    const lng = e.lng ?? e.coordinates?.[1] ?? null;
    return { ...e, _lat: lat, _lng: lng };
  }).filter((e) => e._lat != null && e._lng != null);

  // No clustering at high zoom — return individual "clusters" of 1
  if (gridMeters === 0 || items.length === 0) {
    return items.map((e) => ({
      lat: e._lat,
      lng: e._lng,
      count: 1,
      entities: [e],
      maxThreat: e.threatLevel || 'none',
      types: [e.type].filter(Boolean),
    }));
  }

  // Compute grid cell size in degrees (use centre-ish latitude)
  const avgLat = items.reduce((s, e) => s + e._lat, 0) / items.length;
  const dpm = degPerMeter(avgLat);
  const cellLat = dpm.lat * gridMeters;
  const cellLng = dpm.lng * gridMeters;

  // Bucket entities into cells
  const buckets = {};
  for (const entity of items) {
    const row = Math.floor(entity._lat / cellLat);
    const col = Math.floor(entity._lng / cellLng);
    const key = `${row}:${col}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(entity);
  }

  // Build cluster objects from buckets
  return Object.values(buckets).map((group) => {
    const lat = group.reduce((s, e) => s + e._lat, 0) / group.length;
    const lng = group.reduce((s, e) => s + e._lng, 0) / group.length;

    let maxThreat = 'none';
    const typeSet = new Set();

    for (const e of group) {
      const level = e.threatLevel || 'none';
      if ((THREAT_RANK[level] ?? 0) > (THREAT_RANK[maxThreat] ?? 0)) {
        maxThreat = level;
      }
      if (e.type) typeSet.add(e.type);
    }

    return {
      lat,
      lng,
      count: group.length,
      entities: group,
      maxThreat,
      types: [...typeSet],
    };
  });
}

export default clusterEntities;
