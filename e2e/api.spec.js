// @ts-check
const { test, expect } = require('@playwright/test');

const API = 'http://localhost:8001';

test.describe('Backend API Deep Tests', () => {

  // ─── FLEET TELEMETRY ─────────────────────────────────────

  test('individual drone telemetry returns valid data', async ({ request }) => {
    for (const id of ['ALPHA-1', 'BRAVO-2', 'CHARLIE-3']) {
      const res = await request.get(`${API}/telemetry/${id}`);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.drone_id).toBe(id);
      expect(body.data.altitude).toBeGreaterThan(0);
      expect(body.data.gps.latitude).toBeDefined();
    }
    console.log('Individual drone telemetry: all 3 drones return valid data');
  });

  test('nonexistent drone returns 404', async ({ request }) => {
    const res = await request.get(`${API}/telemetry/FAKE-99`);
    expect(res.status()).toBe(404);
  });

  test('each drone has correct flight pattern', async ({ request }) => {
    const res = await request.get(`${API}/telemetry`);
    const drones = (await res.json()).data;

    const patterns = {};
    drones.forEach(d => patterns[d.drone_id] = d.pattern);

    expect(patterns['ALPHA-1']).toBe('orbit');
    expect(patterns['BRAVO-2']).toBe('grid');
    expect(patterns['CHARLIE-3']).toBe('waypoint');
    console.log('Drone patterns: orbit, grid, waypoint — correct');
  });

  test('telemetry values change over time', async ({ request }) => {
    const res1 = await request.get(`${API}/telemetry/ALPHA-1`);
    const d1 = (await res1.json()).data;

    // Wait 1 second
    await new Promise(r => setTimeout(r, 1000));

    const res2 = await request.get(`${API}/telemetry/ALPHA-1`);
    const d2 = (await res2.json()).data;

    // Timestamp should advance
    expect(d2.timestamp).toBeGreaterThan(d1.timestamp);

    // Position should change (orbit pattern)
    const posDiff = Math.abs(d2.gps.latitude - d1.gps.latitude) + Math.abs(d2.gps.longitude - d1.gps.longitude);
    expect(posDiff).toBeGreaterThan(0);

    // Battery should drain slightly
    expect(d2.battery_voltage).toBeLessThanOrEqual(d1.battery_voltage);

    console.log(`Telemetry changes: ts +${(d2.timestamp - d1.timestamp).toFixed(1)}s, pos delta=${posDiff.toFixed(6)}`);
  });

  test('wind data is present for each drone', async ({ request }) => {
    const res = await request.get(`${API}/telemetry`);
    const drones = (await res.json()).data;

    for (const d of drones) {
      expect(d.wind).toBeDefined();
      expect(d.wind.speed).toBeGreaterThanOrEqual(0);
      expect(d.wind.direction).toBeGreaterThanOrEqual(0);
      expect(d.wind.direction).toBeLessThan(360);
    }
    console.log('Wind data: present for all drones');
  });

  // ─── SIMULATION RESET ────────────────────────────────────

  test('POST /reset resets simulation state', async ({ request }) => {
    // Get current timestamp
    const before = await request.get(`${API}/telemetry/ALPHA-1`);
    const tsBefore = (await before.json()).data.timestamp;
    expect(tsBefore).toBeGreaterThan(0);

    // Reset
    const resetRes = await request.post(`${API}/reset`);
    expect(resetRes.ok()).toBeTruthy();
    const resetBody = await resetRes.json();
    expect(resetBody.success).toBe(true);

    // After reset, timestamp should be near 0
    await new Promise(r => setTimeout(r, 200));
    const after = await request.get(`${API}/telemetry/ALPHA-1`);
    const tsAfter = (await after.json()).data.timestamp;
    expect(tsAfter).toBeLessThan(tsBefore);

    console.log(`Reset: ts ${tsBefore.toFixed(1)}s -> ${tsAfter.toFixed(1)}s`);
  });

  // ─── ENTITY CRUD DEEP ────────────────────────────────────

  test('entity list supports type filter', async ({ request }) => {
    const all = await request.get(`${API}/api/entities`);
    const allCount = (await all.json()).data.length;

    const vehicles = await request.get(`${API}/api/entities?type=vehicle`);
    const vehicleData = (await vehicles.json()).data;
    vehicleData.forEach(e => expect(e.type).toBe('vehicle'));
    expect(vehicleData.length).toBeLessThan(allCount);

    console.log(`Entity filter: all=${allCount}, vehicles=${vehicleData.length}`);
  });

  test('entity list supports threat filter', async ({ request }) => {
    const high = await request.get(`${API}/api/entities?threat=high`);
    const highData = (await high.json()).data;
    highData.forEach(e => expect(e.threatLevel).toBe('high'));

    console.log(`Threat filter: high=${highData.length}`);
  });

  test('entity update modifies fields', async ({ request }) => {
    // Create
    const createRes = await request.post(`${API}/api/entities`, {
      data: { type: 'device', name: 'TEST-UPDATE', confidence: 50, threatLevel: 'low' },
    });
    const entity = (await createRes.json()).data;

    // Update
    const updateRes = await request.put(`${API}/api/entities/${entity.id}`, {
      data: { confidence: 95, threatLevel: 'high' },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = (await updateRes.json()).data;
    expect(updated.confidence).toBe(95);
    expect(updated.threatLevel).toBe('high');
    expect(updated.name).toBe('TEST-UPDATE'); // unchanged field preserved

    // Cleanup
    await request.delete(`${API}/api/entities/${entity.id}`);
    console.log('Entity update: confidence 50->95, threat low->high — works');
  });

  test('entity update on nonexistent returns 404', async ({ request }) => {
    const res = await request.put(`${API}/api/entities/NONEXISTENT`, {
      data: { name: 'should-fail' },
    });
    expect(res.status()).toBe(404);
  });

  // ─── RELATIONSHIPS ───────────────────────────────────────

  test('create relationship between entities', async ({ request }) => {
    // Create two entities
    const e1 = (await (await request.post(`${API}/api/entities`, {
      data: { type: 'person', name: 'REL-TEST-A' },
    })).json()).data;
    const e2 = (await (await request.post(`${API}/api/entities`, {
      data: { type: 'building', name: 'REL-TEST-B' },
    })).json()).data;

    // Create relationship
    const relRes = await request.post(`${API}/api/entities/${e1.id}/relate`, {
      data: { to_entity: e2.id, type: 'located_at', confidence: 85 },
    });
    expect(relRes.ok()).toBeTruthy();
    const rel = (await relRes.json()).data;
    expect(rel.from).toBe(e1.id);
    expect(rel.to).toBe(e2.id);
    expect(rel.type).toBe('located_at');

    // Get graph
    const graphRes = await request.get(`${API}/api/entities/${e1.id}/graph`);
    const graph = (await graphRes.json()).data;
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBeGreaterThanOrEqual(1);

    // Cleanup
    await request.delete(`${API}/api/entities/${e1.id}`);
    await request.delete(`${API}/api/entities/${e2.id}`);
    console.log('Relationships: create + graph query — works');
  });

  // ─── TIMELINE & EVENTS ───────────────────────────────────

  test('timeline returns events sorted by time', async ({ request }) => {
    const res = await request.get(`${API}/api/timeline`);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    // Should be reverse-chronological
    for (let i = 1; i < body.data.length; i++) {
      expect(body.data[i - 1].time).toBeGreaterThanOrEqual(body.data[i].time);
    }
    console.log(`Timeline: ${body.data.length} events, sorted desc`);
  });

  test('timeline pagination works', async ({ request }) => {
    const page1 = await request.get(`${API}/api/timeline?limit=2&offset=0`);
    const page2 = await request.get(`${API}/api/timeline?limit=2&offset=2`);
    const data1 = (await page1.json()).data;
    const data2 = (await page2.json()).data;

    expect(data1.length).toBeLessThanOrEqual(2);
    expect(data2.length).toBeLessThanOrEqual(2);

    // Pages should not overlap
    if (data1.length > 0 && data2.length > 0) {
      const ids1 = data1.map(e => e.id);
      const ids2 = data2.map(e => e.id);
      const overlap = ids1.filter(id => ids2.includes(id));
      expect(overlap.length).toBe(0);
    }
    console.log('Timeline pagination: page1 and page2 non-overlapping');
  });

  test('create event via API', async ({ request }) => {
    const res = await request.post(`${API}/api/events`, {
      data: {
        type: 'test',
        description: 'E2E test event',
        entityId: null,
        severity: 'info',
      },
    });
    expect(res.ok()).toBeTruthy();
    const evt = (await res.json()).data;
    expect(evt.id).toBeTruthy();
    expect(evt.description).toBe('E2E test event');
    expect(evt.time).toBeGreaterThan(0);
    console.log(`Event created: ${evt.id}`);
  });

  // ─── GEOJSON EXPORT ──────────────────────────────────────

  test('GeoJSON coordinates are in correct lng,lat order', async ({ request }) => {
    const res = await request.post(`${API}/api/export/geojson`);
    const geojson = await res.json();

    for (const feature of geojson.features) {
      const [lng, lat] = feature.geometry.coordinates;
      // San Francisco area: lat ~37.77, lng ~-122.41
      expect(lat).toBeGreaterThan(37);
      expect(lat).toBeLessThan(38);
      expect(lng).toBeLessThan(-122);
      expect(lng).toBeGreaterThan(-123);
    }
    console.log('GeoJSON: coordinates in correct [lng, lat] order');
  });
});
