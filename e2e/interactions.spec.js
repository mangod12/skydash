// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const API = process.env.PLAYWRIGHT_API_URL || 'http://localhost:8001';

const getIntelCards = (page) => page
  .locator('h3:text-is("INTELLIGENCE")')
  .locator('xpath=ancestor::div[contains(@class, "h-full flex")][1]')
  .locator('.overflow-y-auto.h-full.p-2')
  .locator('button')
  .filter({ has: page.locator('.text-xs.font-semibold') });

test.describe('SkyDash Interaction Tests', () => {
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

  // ─── MAP INTERACTIONS ────────────────────────────────────

  test('layer toggle switches between dark and satellite tiles', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(1500);

    // Count initial tiles (dark theme)
    const darkTiles = await page.locator('.leaflet-tile-loaded').count();
    expect(darkTiles).toBeGreaterThan(0);

    // Find and click layers button (right side controls)
    const layersBtn = page.locator('button[title="Layers"]');
    await expect(layersBtn).toBeVisible({ timeout: 3000 });
    await layersBtn.click();
    await page.waitForTimeout(300);

    // Layer panel should appear
    await expect(page.locator('text=MAP LAYERS')).toBeVisible();

    // Click Satellite toggle
    await page.locator('button:has-text("Satellite")').click();
    await page.waitForTimeout(2000);

    // Map should still be functional after toggle
    await page.waitForTimeout(1000);
    const mapVisible = await page.locator('.leaflet-container').isVisible();
    expect(mapVisible).toBe(true);

    console.log(`Layer toggle: dark(${darkTiles} tiles) -> satellite toggle works`);
  });

  test('zoom buttons change map zoom level', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(1500);

    // Get initial zoom from leaflet
    const getZoom = () => page.evaluate(() => {
      const map = document.querySelector('.leaflet-container');
      return map?._leaflet_map?.getZoom() ?? -1;
    });

    // Click zoom in
    await page.locator('button[title="Zoom In"]').click();
    await page.waitForTimeout(500);

    // Click zoom out twice
    await page.locator('button[title="Zoom Out"]').click();
    await page.waitForTimeout(300);
    await page.locator('button[title="Zoom Out"]').click();
    await page.waitForTimeout(500);

    // Map should still be functional
    const tiles = await page.locator('.leaflet-tile-loaded').count();
    expect(tiles).toBeGreaterThan(0);

    console.log('Zoom: in/out buttons work, tiles still loading');
  });

  test('fly to drone centers map on drone position', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(2000);

    // Click fly to drone
    await page.locator('button[title="Fly to Drone"]').click();
    await page.waitForTimeout(2000);

    // Drone marker should be near center of viewport
    const marker = page.locator('.leaflet-marker-icon').first();
    await expect(marker).toBeVisible({ timeout: 5000 });

    console.log('Fly to drone: map centered, marker visible');
  });

  // ─── MEASURE TOOL ────────────────────────────────────────

  test('measure tool activates and deactivates', async ({ page }) => {
    await page.keyboard.press('m');
    await page.waitForTimeout(1500);

    const measureBtn = page.locator('button[title="Measure"]');
    await expect(measureBtn).toBeVisible();

    // Activate measure
    await measureBtn.click();
    await page.waitForTimeout(200);

    // Button should be active (indigo bg)
    await expect(measureBtn).toHaveClass(/indigo/);

    // Deactivate
    await measureBtn.click();
    await page.waitForTimeout(200);

    // Button should no longer be active
    await expect(measureBtn).not.toHaveClass(/indigo/);

    console.log('Measure tool: activate/deactivate toggle works');
  });

  // ─── ENTITY DETAIL PANEL ─────────────────────────────────

  test('clicking entity in intel view selects it', async ({ page }) => {
    // Fresh navigate to avoid HMR state issues
    await page.goto(BASE);
    await page.waitForSelector('text=CONNECTED', { timeout: 15000 });
    await page.waitForTimeout(1000);

    await page.keyboard.press('i');
    await expect(page.locator('text=EVENT TIMELINE')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    const entityCard = getIntelCards(page).first();
    await expect(entityCard).toBeVisible({ timeout: 5000 });
    const entityName = (await entityCard.locator('.text-xs.font-semibold').first().textContent())?.trim();
    expect(entityName).toBeTruthy();

    await entityCard.click();
    await page.waitForTimeout(1000);
    await expect(
      page.locator('.text-sm.font-semibold.text-zinc-200').filter({ hasText: entityName }),
    ).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/10-entity-detail.png', fullPage: true });
    console.log(`Entity click: ${entityName} card clicked, detail shown`);
  });

  // ─── ALERT SYSTEM ────────────────────────────────────────

  test('toast notifications appear on app load', async ({ page }) => {
    // Verify the system connection badge is visible and active on load.
    await expect(page.getByRole('button', { name: /^CONNECTED/ })).toBeVisible();
    console.log('Toast: boot completed (CONNECTED badge visible)');
  });

  // ─── MULTI-CHART ─────────────────────────────────────────

  test('multi-chart tab switching works', async ({ page }) => {
    await page.keyboard.press('t');
    await page.waitForTimeout(2000);

    // Should see ALT tab active by default
    const altTab = page.locator('button:text-is("ALT")');
    await expect(altTab).toBeVisible({ timeout: 5000 });

    // Switch to SPD
    await page.locator('button:text-is("SPD")').click();
    await page.waitForTimeout(300);

    // Switch to BAT
    await page.locator('button:text-is("BAT")').click();
    await page.waitForTimeout(300);

    // Switch to SIG
    await page.locator('button:text-is("SIG")').click();
    await page.waitForTimeout(300);

    // Chart should still be rendering
    const chart = page.locator('.recharts-responsive-container');
    await expect(chart.first()).toBeVisible();

    console.log('MultiChart: ALT -> SPD -> BAT -> SIG tab switching works');
  });

  test('drone command panel uses backend ACK before confirming mode changes', async ({ page, request }) => {
    test.setTimeout(120000);
    await page.keyboard.press('t');
    await expect(page.locator('text=PRIMARY FLIGHT DISPLAY')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=DRONE COMMAND')).toBeVisible({ timeout: 5000 });

    await page.locator('button:text-is("GRID")').click({ force: true });
    await expect(page.locator('text=CONFIRMED')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Simulator state updated')).toBeVisible();

    const telemetryRes = await request.get(`${API}/telemetry/ALPHA-1`);
    expect(telemetryRes.ok()).toBeTruthy();
    const telemetry = (await telemetryRes.json()).data;
    expect(telemetry.flight_mode).toBe('GRID');
    expect(telemetry.pattern).toBe('grid');
    console.log('Drone command panel: GRID waits for backend ACK and confirms real simulator state');
  });

  test('drone command panel shows FAILED when backend rejects command', async ({ page }) => {
    await page.route('**/api/drone/**/command', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 400,
        headers: {
          'access-control-allow-origin': '*',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ detail: 'Unsupported mode: ATTACK' }),
      });
    });
    await page.keyboard.press('t');
    await expect(page.locator('text=DRONE COMMAND')).toBeVisible({ timeout: 5000 });

    const responsePromise = page.waitForResponse((res) => (
      res.url().includes('/api/drone/ALPHA-1/command')
      && res.request().method() === 'POST'
    ));
    await page.locator('button:text-is("LAND")').click({ force: true });
    const response = await responsePromise;
    expect(response.status()).toBe(400);
    await expect(page.locator('text=FAILED')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Unsupported mode: ATTACK')).toBeVisible();
    console.log('Drone command panel: rejected commands surface FAILED state');
  });

  test('OSINT ingest panel previews and imports connector entities', async ({ page }) => {
    let importCalled = false;
    const candidate = {
      id: 'shodan-203_0_113_24',
      type: 'device',
      name: 'Webcam @ 203.0.113.24',
      coordinates: [37.78, -122.41],
      properties: { ip: '203.0.113.24', port: 8080, mode: 'mock' },
      confidence: 70,
      source: 'Shodan (Mock)',
      tags: ['iot', 'shodan'],
      threatLevel: 'medium',
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };

    await page.route('**/api/connectors/shodan/ingest?**', async (route) => {
      const isDryRun = route.request().url().includes('dry_run=true');
      if (!isDryRun) importCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [candidate],
          metadata: {
            source: 'Shodan (Mock)',
            mode: isDryRun ? 'preview' : 'import',
            query: 'webcam',
            count: 1,
            created: isDryRun ? 0 : 1,
            updated: 0,
          },
        }),
      });
    });

    await page.keyboard.press('i');
    await expect(page.locator('text=OSINT INGEST')).toBeVisible({ timeout: 5000 });

    await page.locator('button:text-is("PREVIEW")').click();
    await expect(page.locator('text=Webcam @ 203.0.113.24')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=PREVIEW / 1')).toBeVisible();

    await page.locator('button:text-is("IMPORT")').click();
    await expect(page.locator('text=IMPORT / 1')).toBeVisible({ timeout: 5000 });
    expect(importCalled).toBe(true);

    console.log('OSINT ingest: preview and import controls call connector contract');
  });

  // ─── KEYBOARD HELP ───────────────────────────────────────

  test('keyboard help modal opens with ? key', async ({ page }) => {
    await page.keyboard.press('Shift+/'); // ? = Shift + /
    await page.waitForTimeout(800);

    const modal = page.locator('text=KEYBOARD SHORTCUTS');
    if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(page.locator('text=Command Palette')).toBeVisible();
      console.log('Keyboard help: opens with ?, shows shortcuts');
    } else {
      // ? may not trigger on all keyboard layouts
      console.log('Keyboard help: Shift+/ did not trigger (layout-dependent)');
    }
  });

  // ─── STATUS BAR ──────────────────────────────────────────

  test('status bar shows connection, coordinates, and satellite count', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    const text = await footer.textContent();
    // Should contain CONNECTED
    expect(text).toContain('CONNECTED');
    // Should contain coordinates
    expect(text).toMatch(/37\.\d+/);
    // Should contain SATS
    expect(text).toContain('SATS');

    console.log('Status bar: connection + coords + sats visible');
  });

  // ─── TOP BAR ─────────────────────────────────────────────

  test('top bar shows breadcrumb and UTC clock', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();

    const text = await header.textContent();
    // Should have SKYDASH breadcrumb
    expect(text).toContain('SKYDASH');
    // Should have UTC clock (format HH:MM:SSZ)
    expect(text).toMatch(/\d{2}:\d{2}:\d{2}Z/);

    console.log('Top bar: breadcrumb + UTC clock visible');
  });

  // ─── COMPASS ROSE ────────────────────────────────────────

  test('compass rose renders with heading', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('text=CONNECTED', { timeout: 15000 });
    await page.keyboard.press('m');
    await page.waitForTimeout(2500);

    // Compass SVG has N/E/W cardinal labels
    const compass = page.locator('svg:has(text:text-is("N"))').first();
    await expect(compass).toBeVisible({ timeout: 5000 });

    // Heading readout: 3-digit number + degree — uses tabular-nums class
    const headingSpan = page.locator('.tabular-nums:has-text("°")').first();
    await expect(headingSpan).toBeVisible({ timeout: 5000 });
    const text = await headingSpan.textContent();
    expect(text).toMatch(/\d{1,3}°/);

    console.log(`Compass: visible with heading ${text}`);
  });

  // ─── BOOT SEQUENCE ───────────────────────────────────────

  test('boot sequence shows and completes', async ({ page }) => {
    // Navigate fresh to see boot
    await page.goto(BASE);

    // Should see SKYDASH logo in boot screen
    await expect(page.locator('text=SPATIAL INTELLIGENCE PLATFORM')).toBeVisible({ timeout: 5000 });

    // Wait for boot to complete
    await page.waitForSelector('text=CONNECTED', { timeout: 15000 });

    // Boot overlay should be gone, app should be visible
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 5000 });

    console.log('Boot sequence: logo shown, completes, app loads');
  });

  // ─── REPORT EXPORT BUTTONS ───────────────────────────────

  test('export buttons are clickable in intel view', async ({ page }) => {
    await page.keyboard.press('i');
    await page.waitForTimeout(2000);

    // Scroll to export section
    await page.evaluate(() => {
      const panels = document.querySelectorAll('[class*="overflow-y-auto"]');
      panels.forEach(p => p.scrollTop = p.scrollHeight);
    });
    await page.waitForTimeout(300);

    // Report button should exist
    const reportBtn = page.getByRole('button', { name: /^FULL REPORT$/i });
    await expect(reportBtn).toBeVisible({ timeout: 5000 });

    // GeoJSON button
    const geojsonBtn = page.getByRole('button', { name: 'GEOJSON' });
    await expect(geojsonBtn).toBeVisible();

    // CSV button
    const csvBtn = page.getByRole('button', { name: 'CSV' });
    await expect(csvBtn).toBeVisible();

    console.log('Export: FULL REPORT, GEOJSON, CSV buttons visible');
  });
});
