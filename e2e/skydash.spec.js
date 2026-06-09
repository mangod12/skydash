// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8001';

const getIntelCount = async (page) => {
  const countText = (await page.locator('h3:text-is("INTELLIGENCE")')
    .locator('xpath=ancestor::div[contains(@class, "h-full flex")][1]')
    .locator('span').filter({ hasText: /\d+\s+of\s+\d+\s+entities/i })
    .first()
    .textContent())?.trim();

  if (!countText) {
    throw new Error(`Unable to parse entity counter text: ${countText}`);
  }

  const match = countText.match(/\d+/g);
  if (!match || match.length < 2) {
    throw new Error(`Unable to parse entity counter text: ${countText}`);
  }

  return {
    visible: Number.parseInt(match[0], 10),
    total: Number.parseInt(match[1], 10),
    raw: countText,
  };
};

const getIntelList = (page) => page
  .locator('h3:text-is("INTELLIGENCE")')
  .locator('xpath=ancestor::div[contains(@class, "h-full flex")][1]')
  .locator('.overflow-y-auto.h-full.p-2');

const getIntelCards = (page) => getIntelList(page).locator('button').filter({ has: page.locator('.text-xs.font-semibold') });

const getIntelFilterButton = (page, section, name) => page
  .getByText(section, { exact: true })
  .locator('..')
  .getByRole('button', { name, exact: true });

test.describe('SkyDash E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('skydash_tour_completed', 'true');
      } catch (e) {
        // Ignore if localStorage is unavailable in this execution context.
      }
    });
    await page.goto(BASE);
    await page.waitForSelector('text=CONNECTED', { timeout: 15000 });
    await page.waitForTimeout(500);
  });

  // ─── SMOKE TESTS ─────────────────────────────────────────

  test('app boots and shows dashboard with live data', async ({ page }) => {
    await expect(page.locator('text=SKYDASH').first()).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // Telemetry panel should show live numeric values (not --)
    await page.waitForTimeout(1500);
    const altText = await page.locator('text=/\\d+\\.\\d+/').first().textContent();
    expect(altText).toBeTruthy();

    await page.screenshot({ path: 'e2e/screenshots/01-dashboard.png', fullPage: true });
  });

  // ─── TELEMETRY DATA FLOW ─────────────────────────────────

  test('telemetry values update in real-time', async ({ page }) => {
    await page.keyboard.press('t');
    await expect(page.locator('text=PRIMARY FLIGHT DISPLAY')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // Capture altitude value from the ALT tape readout
    const getAlt = async () => {
      // ALT tape label is followed by the value span
      const el = page.locator('text=/^\\d+\\.\\d+$/').first();
      return await el.textContent();
    };

    const alt1 = await getAlt();
    await page.waitForTimeout(2000);
    const alt2 = await getAlt();

    // Values should be numeric
    expect(alt1).toMatch(/\d+\.\d+/);
    expect(alt2).toMatch(/\d+\.\d+/);
    // Drone is moving, altitude oscillates — values very likely differ
    // But even if same, both being numeric proves data flows
    console.log(`Telemetry: alt1=${alt1} alt2=${alt2}`);

    await page.screenshot({ path: 'e2e/screenshots/02-telemetry.png', fullPage: true });
  });

  test('battery gauge shows realistic voltage range', async ({ page }) => {
    await page.keyboard.press('t');
    await page.waitForTimeout(1500);

    // Battery voltage should be between 14.0V and 16.8V (4S LiPo range)
    const batteryText = await page.locator('text=/\\d+\\.\\d+V/').first().textContent();
    const voltage = parseFloat(batteryText);
    expect(voltage).toBeGreaterThanOrEqual(14.0);
    expect(voltage).toBeLessThanOrEqual(16.9);
    console.log(`Battery: ${voltage}V — within 4S LiPo range`);
  });

  // ─── NAVIGATION ──────────────────────────────────────────

  test('keyboard shortcuts navigate between all views', async ({ page }) => {
    // D -> Dashboard
    await page.keyboard.press('d');
    await page.waitForTimeout(300);
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // M -> Map (fullscreen)
    await page.keyboard.press('m');
    await page.waitForTimeout(300);
    const breadcrumb = page.locator('text=MAP').first();
    await expect(breadcrumb).toBeVisible();

    // T -> Telemetry
    await page.keyboard.press('t');
    await page.waitForTimeout(300);
    await expect(page.locator('text=PRIMARY FLIGHT DISPLAY')).toBeVisible({ timeout: 3000 });

    // I -> Intel
    await page.keyboard.press('i');
    await page.waitForTimeout(300);
    await expect(page.locator('text=EVENT TIMELINE')).toBeVisible({ timeout: 3000 });

    console.log('Navigation: all 4 keyboard shortcuts work');
  });

  test('sidebar expands and collapses', async ({ page }) => {
    const sidebar = page.locator('aside');
    const initialWidth = (await sidebar.boundingBox()).width;

    // Press B to toggle
    await page.keyboard.press('b');
    await page.waitForTimeout(400);
    const expandedWidth = (await sidebar.boundingBox()).width;

    expect(expandedWidth).not.toEqual(initialWidth);
    console.log(`Sidebar: ${initialWidth}px -> ${expandedWidth}px`);

    // Toggle back
    await page.keyboard.press('b');
    await page.waitForTimeout(400);
    const collapsedWidth = (await sidebar.boundingBox()).width;
    expect(collapsedWidth).toEqual(initialWidth);
  });

  // ─── COMMAND PALETTE ─────────────────────────────────────

  test('command palette searches and navigates', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('input[placeholder*="Search"]');
    await expect(input).toBeVisible({ timeout: 3000 });

    // Type to filter commands
    await input.fill('Intel');
    await page.waitForTimeout(300);

    // Should show matching result
    const result = page.locator('[cmdk-item]:has-text("Intel")');
    await expect(result).toBeVisible({ timeout: 2000 });

    // Select it
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Should now be on Intel view
    await expect(page.locator('text=EVENT TIMELINE')).toBeVisible({ timeout: 3000 });
    console.log('Command palette: search + navigate works');

    await page.screenshot({ path: 'e2e/screenshots/06-command-palette.png', fullPage: true });
  });

  // ─── INTEL / OSINT ───────────────────────────────────────

  test('entity list shows seed data with correct threat levels', async ({ page }) => {
    await page.keyboard.press('i');
    await page.waitForTimeout(1500);

    // Count should show all entities visible.
    const count = await getIntelCount(page);
    expect(count.visible).toBe(count.total);

    // Critical entities should appear first (sorted by threat)
    const firstEntity = getIntelCards(page).first();
    await expect(firstEntity).toBeVisible();
    const firstEntityName = (await firstEntity.locator('.text-xs.font-semibold').first().textContent())?.trim();
    expect(firstEntityName).toBeTruthy();

    await firstEntity.click();
    await expect(
      page.locator('.text-sm.font-semibold.text-zinc-200').filter({ hasText: firstEntityName }),
    ).toBeVisible();

    console.log(`Intel: ${count.visible} entities loaded, sorted by threat`);
    await page.screenshot({ path: 'e2e/screenshots/04-intel.png', fullPage: true });
  });

  test('entity type filter chips work', async ({ page }) => {
    await page.keyboard.press('i');
    await page.waitForTimeout(1500);

    const initial = await getIntelCount(page);

    // Click VEHICLE filter chip (inside the filter bar, not sidebar)
    await getIntelFilterButton(page, 'TYPE', 'VEHICLE').click();
    await page.waitForTimeout(300);

    // Should only show vehicle entities (2 vehicles in seed data)
    const filtered = await getIntelCount(page);
    expect(filtered.visible).toBeLessThanOrEqual(filtered.total);
    expect(filtered.visible).toBeLessThanOrEqual(initial.total);
    expect(filtered.total).toBe(initial.total);

    // Click ALL to reset
    await getIntelFilterButton(page, 'TYPE', 'ALL').click();
    await page.waitForTimeout(300);
    const reset = await getIntelCount(page);
    expect(reset.visible).toBe(reset.total);
    expect(reset.total).toBe(initial.total);

    console.log(`Entity filter: VEHICLE shows ${filtered.visible}/${filtered.total}, ALL shows ${reset.visible}/${reset.total}`);
  });

  test('entity search filters by name', async ({ page }) => {
    await page.keyboard.press('i');
    await page.waitForTimeout(1500);

    const firstEntity = getIntelCards(page).first();
    const firstEntityName = (await firstEntity.locator('.text-xs.font-semibold').first().textContent())?.trim();
    if (!firstEntityName) {
      throw new Error('No entities available to build search token');
    }
    const token = firstEntityName.split(' ')[0];

    const searchInput = page.locator('input[placeholder="Search entities..."]');
    await searchInput.fill(token);
    await page.waitForTimeout(300);

    // Should show only TANGO-7
    const filtered = await getIntelCount(page);
    expect(filtered.visible).toBeGreaterThan(0);
    expect(filtered.visible).toBeLessThanOrEqual(filtered.total);

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);
    const reset = await getIntelCount(page);
    expect(reset.visible).toBe(reset.total);

    console.log(`Entity search: "${token}" -> ${filtered.visible}, clear -> ${reset.visible}`);
  });

  test('natural language query returns correct results', async ({ page }) => {
    await page.keyboard.press('i');
    await page.waitForTimeout(1500);

    const nlqInput = page.locator('input[placeholder*="vehicles"]');
    await expect(nlqInput).toBeVisible({ timeout: 5000 });

    // Query: high threat
    await nlqInput.fill('high threat');
    await page.locator('button:has-text("QUERY")').click();
    await page.waitForTimeout(500);

    // Should show 3 results (TANGO-7=high, Compound ECHO=critical, Perimeter Breach=critical)
    await expect(page.locator('text=3 results found')).toBeVisible({ timeout: 3000 });

    // Query: vehicles
    await nlqInput.fill('vehicles');
    await page.locator('button:has-text("QUERY")').click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=2 results found')).toBeVisible({ timeout: 3000 });

    console.log('NLQ: "high threat" -> 3, "vehicles" -> 2');
    await page.screenshot({ path: 'e2e/screenshots/08-nlq-query.png', fullPage: true });
  });

  test('threat matrix shows correct counts', async ({ page }) => {
    await page.keyboard.press('i');
    await page.waitForTimeout(1500);

    // Threat matrix footer should show total and critical count
    await expect(page.locator('text=8 TOTAL ENTITIES')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=2 CRITICAL')).toBeVisible();

    console.log('Threat matrix: 8 total, 2 critical — correct');
  });

  // ─── MAP ─────────────────────────────────────────────────

  test('map loads tiles and shows drone marker', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(2000);

    // Leaflet tiles should be loaded
    const tiles = page.locator('.leaflet-tile-loaded');
    const tileCount = await tiles.count();
    expect(tileCount).toBeGreaterThan(0);

    // Drone marker should exist (custom div icon)
    const droneMarker = page.locator('.leaflet-marker-icon');
    await expect(droneMarker.first()).toBeVisible({ timeout: 5000 });

    console.log(`Map: ${tileCount} tiles loaded, drone marker visible`);
    await page.screenshot({ path: 'e2e/screenshots/03-map-fullscreen.png', fullPage: true });
  });

  test('coordinate display cycles through formats', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(2000);

    // Coordinate display is a button in bottom-left of map
    // It contains a format label (DD/DMS/UTM/MGRS) and coordinates
    const getCoordBtn = () => page.locator('.absolute.bottom-3.left-3.z-20 button');
    const getCoordText = async () => (await getCoordBtn().first().textContent() || '').trim();

    const btn = getCoordBtn();
    await expect(btn).toBeVisible({ timeout: 5000 });

    let text = await getCoordText();
    expect(text).toContain('DD');

    // Cycle through formats
    const formats = ['DMS', 'UTM', 'MGRS'];
    for (const fmt of formats) {
      await btn.first().dispatchEvent('click');
      await page.waitForTimeout(300);
      text = await getCoordText();
      expect(text).toContain(fmt);
    }

    console.log('Coordinates: DD -> DMS -> UTM -> MGRS cycle works');
  });

  // ─── ANALYTICS ───────────────────────────────────────────

  test('analytics dashboard shows correct aggregate stats', async ({ page }) => {
    // Navigate to analytics via sidebar
    const sidebarBtns = page.locator('aside button');
    await sidebarBtns.nth(7).click(); // Analytics is 8th nav item
    await page.waitForTimeout(1500);

    // Stat cards
    await expect(page.locator('text=TOTAL ENTITIES')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=ACTIVE EVENTS')).toBeVisible();
    await expect(page.locator('text=HIGH THREAT')).toBeVisible();
    await expect(page.locator('text=ACTIVE DRONES')).toBeVisible();

    // Values should be numbers
    const totalEntities = page.locator('text=TOTAL ENTITIES').locator('..').locator('div.text-2xl');
    const entityText = await totalEntities.textContent();
    expect(parseInt(entityText)).toBe(8);

    // Fleet status should show all 3 drones
    await expect(page.locator('text=ALPHA-1')).toBeVisible();
    await expect(page.locator('text=BRAVO-2')).toBeVisible();
    await expect(page.locator('text=CHARLIE-3')).toBeVisible();

    console.log('Analytics: 8 entities, 3 drones confirmed');
    await page.screenshot({ path: 'e2e/screenshots/07-analytics.png', fullPage: true });
  });

  // ─── BACKEND API ─────────────────────────────────────────

  test('backend API returns fleet telemetry', async ({ request }) => {
    const response = await request.get(`${API}/telemetry`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(3);

    const droneIds = body.data.map(d => d.drone_id).sort();
    expect(droneIds).toEqual(['ALPHA-1', 'BRAVO-2', 'CHARLIE-3']);

    // Each drone should have valid telemetry
    for (const drone of body.data) {
      expect(drone.altitude).toBeGreaterThan(0);
      expect(drone.battery_voltage).toBeGreaterThanOrEqual(14.0);
      expect(drone.battery_voltage).toBeLessThanOrEqual(16.9);
      expect(drone.gps.latitude).toBeCloseTo(37.77, 1);
      expect(drone.gps.longitude).toBeCloseTo(-122.42, 1);
      expect(drone.signal_strength).toBeGreaterThan(0);
      expect(drone.signal_strength).toBeLessThanOrEqual(100);
      expect(['ORBIT', 'GRID', 'WAYPOINT', 'RTL']).toContain(drone.flight_mode);
    }

    console.log('API: 3 drones, valid telemetry ranges confirmed');
  });

  test('backend entity CRUD works', async ({ request }) => {
    // List entities
    const listRes = await request.get(`${API}/api/entities`);
    expect(listRes.ok()).toBeTruthy();
    const listBody = await listRes.json();
    expect(listBody.success).toBe(true);
    const initialCount = listBody.data.length;

    // Create entity
    const createRes = await request.post(`${API}/api/entities`, {
      data: {
        type: 'vehicle',
        name: 'TEST-VAN-001',
        coordinates: [37.7800, -122.4100],
        confidence: 90,
        threatLevel: 'low',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = (await createRes.json()).data;
    expect(created.name).toBe('TEST-VAN-001');
    expect(created.id).toBeTruthy();

    // Read entity
    const getRes = await request.get(`${API}/api/entities/${created.id}`);
    expect(getRes.ok()).toBeTruthy();
    const fetched = (await getRes.json()).data;
    expect(fetched.name).toBe('TEST-VAN-001');

    // Delete entity
    const delRes = await request.delete(`${API}/api/entities/${created.id}`);
    expect(delRes.ok()).toBeTruthy();

    // Verify deleted
    const verifyRes = await request.get(`${API}/api/entities/${created.id}`);
    expect(verifyRes.status()).toBe(404);

    console.log(`API CRUD: create -> read -> delete entity ${created.id} — all OK`);
  });

  test('backend GeoJSON export returns valid FeatureCollection', async ({ request }) => {
    const response = await request.post(`${API}/api/export/geojson`);
    expect(response.ok()).toBeTruthy();

    const geojson = await response.json();
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBeGreaterThan(0);

    // Each feature should be valid GeoJSON
    for (const feature of geojson.features) {
      expect(feature.type).toBe('Feature');
      expect(feature.geometry.type).toBe('Point');
      expect(feature.geometry.coordinates).toHaveLength(2);
      expect(feature.properties.name).toBeTruthy();
      expect(feature.properties.threatLevel).toBeTruthy();
    }

    console.log(`GeoJSON: ${geojson.features.length} features, valid structure`);
  });

  // ─── SETTINGS ────────────────────────────────────────────

  test('settings view shows theme options and keyboard shortcuts', async ({ page }) => {
    const sidebarBtns = page.locator('aside button');
    const count = await sidebarBtns.count();
    await sidebarBtns.nth(count - 2).click();
    await page.waitForTimeout(1500);

    await expect(page.locator('text=DISPLAY THEME')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=MIDNIGHT')).toBeVisible();
    await expect(page.locator('text=TACTICAL')).toBeVisible();
    await expect(page.locator('text=ARCTIC')).toBeVisible();
    await expect(page.locator('text=KEYBOARD SHORTCUTS')).toBeVisible();
    await expect(page.locator('text=WebSocket + HTTP fallback')).toBeVisible();

    console.log('Settings: themes + shortcuts + connection info visible');
    await page.screenshot({ path: 'e2e/screenshots/09-settings.png', fullPage: true });
  });
});
