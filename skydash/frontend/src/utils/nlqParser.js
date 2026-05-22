/**
 * Client-side natural language query parser for entity filtering.
 * Parses simple queries like "vehicles near warehouse" or "high threat entities"
 */
export function parseQuery(query, entities) {
  const q = query.toLowerCase().trim();
  if (!q) return entities;

  let results = [...entities];

  const typeMap = {
    vehicle: ['vehicle', 'vehicles', 'car', 'cars', 'suv'],
    person: ['person', 'people', 'persons', 'individual'],
    building: ['building', 'buildings', 'warehouse', 'structure'],
    device: ['device', 'devices', 'signal', 'rf', 'electronic'],
    event: ['event', 'events', 'alert', 'alerts', 'breach'],
  };

  for (const [type, keywords] of Object.entries(typeMap)) {
    if (keywords.some((k) => q.includes(k))) {
      results = results.filter((e) => e.type === type);
    }
  }

  if (q.includes('high threat') || q.includes('dangerous') || q.includes('critical')) {
    results = results.filter((e) => e.threatLevel === 'high' || e.threatLevel === 'critical');
  }
  if (q.includes('low threat') || q.includes('safe')) {
    results = results.filter((e) => e.threatLevel === 'low' || e.threatLevel === 'none');
  }
  if (q.includes('suspicious')) {
    results = results.filter((e) => e.tags?.includes('suspicious') || e.threatLevel === 'medium');
  }

  if (q.includes('high confidence') || q.includes('confirmed')) {
    results = results.filter((e) => e.confidence >= 80);
  }
  if (q.includes('low confidence') || q.includes('uncertain')) {
    results = results.filter((e) => e.confidence < 60);
  }

  if (q.includes('last hour') || q.includes('recent')) {
    const oneHourAgo = Date.now() - 3600000;
    results = results.filter((e) => e.lastSeen >= oneHourAgo);
  }
  if (q.includes('last 24') || q.includes('today')) {
    const oneDayAgo = Date.now() - 86400000;
    results = results.filter((e) => e.lastSeen >= oneDayAgo);
  }

  if (results.length === entities.length) {
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 0) {
      results = results.filter((e) =>
        words.some((w) =>
          e.name.toLowerCase().includes(w) ||
          e.type.includes(w) ||
          e.tags?.some((t) => t.includes(w)) ||
          Object.values(e.properties || {}).some((v) => String(v).toLowerCase().includes(w))
        )
      );
    }
  }

  return results;
}
