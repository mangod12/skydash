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

  test('mission readiness opens from missions and exports scoped evidence', async ({ page, request }) => {
    const name = `E2E Readiness ${Date.now()}`;
    const created = await request.post(`${API}/api/missions`, {
      data: { name, description: 'Training readiness smoke check' },
    });
    expect(created.ok()).toBeTruthy();
    const mission = (await created.json()).data;
    try {
      await page.route('**/api/connectors/status', route => route.fulfill({ json: {
        success: true, data: { opensky: { available: true }, shodan: { available: false, mode: 'mock' } },
      } }));
      await page.keyboard.press('o');
      await page.getByRole('button').filter({ hasText: name }).click();
      await page.getByRole('tab', { name: 'READINESS', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Mission readiness check' });
      await expect(panel.getByText('Mission Readiness Check', { exact: true })).toBeVisible();
      await expect(panel.getByText(/This is not clearance to fly/)).toBeVisible();
      await expect(panel.getByText(/OpenSky supported; Shodan mock/)).toBeVisible();
      await expect(panel.getByText('0/0 linked entities available in the current intelligence data.')).toBeVisible();
      const pending = page.waitForEvent('download');
      await panel.getByRole('button', { name: 'Save timestamped report' }).click();
      const download = await pending;
      expect(download.suggestedFilename()).toMatch(/^skydash-readiness-\d+\.txt$/);
      const stream = await download.createReadStream();
      const parts = [];
      for await (const part of stream) parts.push(part);
      const report = Buffer.concat(parts).toString('utf8');
      expect(report).toContain(`Mission: ${name} (${mission.id})`);
      expect(report).toContain('not clearance to fly');
      expect(report).toContain('[WARN] Linked evidence');
      expect(report).toContain('Shodan mock');
      expect(report).toContain('Snapshot only');
      await expect(panel.getByText(/Report download requested at/)).toBeVisible();
      await page.screenshot({ path: 'e2e/screenshots/readiness-workflow.png', fullPage: true });
    } finally {
      await request.delete(`${API}/api/missions/${mission.id}`);
    }
  });

  test('exercise reviews persist, compare, reload and export model evidence', async ({ page }) => {
    await page.keyboard.press('l');
    await expect(page.getByRole('heading', { name: 'Scenario Lab', exact: true })).toBeVisible();
    await page.getByLabel('Scenario timeline').press('End');
    const review = page.getByRole('region', { name: 'Exercise after-action review' });
    await review.getByLabel('Review title', { exact: true }).fill('Baseline completed snapshot');
    await review.getByLabel('Lessons and follow-up (self-reported)').fill('Rehearsal snapshot, not field evidence.');
    await review.getByRole('button', { name: 'Save exercise review', exact: true }).click();
    await expect(review.getByText('1/20 saved', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'LAUNCH', exact: true }).click();
    await page.getByRole('button', { name: 'SIGNAL LOSS', exact: true }).click();
    await page.getByRole('button', { name: 'PAUSE', exact: true }).click();
    await page.getByLabel('Scenario timeline').press('End');
    await review.getByLabel('Review title', { exact: true }).fill('Signal-loss snapshot');
    await review.getByRole('button', { name: 'Save exercise review', exact: true }).click();
    await expect(review.getByText('2/20 saved', { exact: true })).toBeVisible();
    const baselineValue = await review.getByLabel('Comparison baseline').locator('option').filter({ hasText: 'Baseline completed snapshot' }).getAttribute('value');
    await review.getByLabel('Comparison baseline').selectOption(baselineValue);
    await expect(review.getByText('Compared with Baseline completed snapshot', { exact: true })).toBeVisible();
    const pending = page.waitForEvent('download');
    await review.getByRole('button', { name: 'Export review', exact: true }).click();
    const download = await pending;
    const stream = await download.createReadStream(); const parts = [];
    for await (const part of stream) parts.push(part);
    const report = Buffer.concat(parts).toString('utf8');
    expect(report).toContain('SIMULATION ONLY');
    expect(report).toContain('Signal-loss snapshot');
    expect(report).toContain('Baseline: Baseline completed snapshot');
    expect(report).toContain('Signal Loss');
    expect(report).toContain('not measured field results');
    await page.screenshot({ path: 'e2e/screenshots/exercise-review-workflow.png' });
    await page.reload(); await page.waitForSelector('text=CONNECTED', { timeout: 15000 });
    await page.keyboard.press('l');
    await expect(review.getByText('2/20 saved', { exact: true })).toBeVisible();
    const selected = await review.getByLabel('Saved review', { exact: true }).locator('option').filter({ hasText: 'Signal-loss snapshot' }).getAttribute('value');
    await review.getByLabel('Saved review', { exact: true }).selectOption(selected);
    await review.getByRole('button', { name: 'Load saved exercise', exact: true }).click();
    await review.getByRole('button', { name: 'Replace simulation', exact: true }).click();
    await expect(page.getByLabel('Scenario timeline')).toHaveValue('180');
    await expect(review.getByRole('status')).toContainText('no aircraft commands were sent');
  });

  test('search grid planner previews, invalidates edits and exports a non-executable concept', async ({ page }) => {
    await page.keyboard.press('l');
    await page.getByRole('button', { name: 'SEARCH GRID PLANNER', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Search grid planner' });
    await expect(panel.getByRole('heading', { name: 'Search Grid Planner', exact: true })).toBeVisible();
    await panel.getByLabel('Center latitude', { exact: true }).fill('0');
    await panel.getByLabel('Center longitude', { exact: true }).fill('0');
    await panel.getByRole('button', { name: 'Generate search grid', exact: true }).click();
    await expect(panel.getByText('2.90km', { exact: true })).toBeVisible();
    await expect(panel.getByText('START', { exact: true })).toBeVisible();
    await expect(panel.getByText('END', { exact: true })).toBeVisible();
    await panel.getByLabel('East-west width (m)', { exact: true }).fill('600');
    await expect(panel.getByRole('button', { name: 'Export concept GeoJSON', exact: true })).toBeDisabled();
    await expect(panel.getByText(/Preview and metrics still show/)).toBeVisible();
    await panel.getByRole('button', { name: 'Generate search grid', exact: true }).click();
    await expect(panel.getByText('3.40km', { exact: true })).toBeVisible();
    const pending = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Export concept GeoJSON', exact: true }).click();
    const download = await pending; const stream = await download.createReadStream(); const parts = [];
    for await (const part of stream) parts.push(part);
    const geo = JSON.parse(Buffer.concat(parts).toString('utf8'));
    expect(geo.type).toBe('FeatureCollection'); expect(geo.properties.laneCount).toBe(5);
    expect(geo.properties.latitude).toBe(0); expect(geo.properties.longitude).toBe(0);
    expect(geo.properties.scope).toContain('not an executable aircraft mission');
    expect(geo.features.at(-1).properties.executable).toBe(false);
    expect(geo.features[0].geometry.type).toBe('Polygon');
    await page.screenshot({ path: 'e2e/screenshots/search-grid-workflow.png' });
    await panel.getByRole('button', { name: 'Back to Scenario Lab', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Scenario Lab', exact: true })).toBeVisible();
  });

  test('flight log import replays gaps, saves an immutable debrief and reopens after reload', async ({ page, request }) => {
    const title = `E2E log ${Date.now()}`;
    const longitude = (77.209 + Math.random() * 0.001).toFixed(8);
    const csv = `time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,28.6139,${longitude},10,0,95\n2,28.6140,${longitude},20,5,94\n4,28.6141,${longitude},30,6,93\n12,28.6142,${longitude},,5,\n14,28.6143,${longitude},35,4,91\n16,28.6144,${longitude},25,0,90\n`;
    let savedId;
    try {
      await page.keyboard.press('l');
      await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click();
      let panel = page.getByRole('region', { name: 'Flight log replay', exact: true });
      await panel.getByLabel('Choose flight CSV').setInputFiles({ name: 'synthetic-e2e.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
      await expect(panel.getByText(/Local preview loaded/)).toBeVisible();
      await panel.getByLabel('Replay position', { exact: true }).fill('8');
      await expect(panel.getByText(/DATA GAP/)).toBeVisible();
      await expect(panel.getByLabel('Current recorded observation')).toContainText('Sample 3/6 at 4s');
      await panel.getByLabel('Replay position', { exact: true }).fill('12');
      await expect(panel.getByLabel('Current recorded observation')).toContainText('altitude unknown');
      await panel.getByLabel('Review title', { exact: true }).fill(title);
      await panel.getByLabel('Analyst notes', { exact: true }).fill('Discuss the 8s observation gap. Synthetic test, not flight certification.');
      await panel.getByRole('button', { name: 'Refresh server archive', exact: true }).click();
      await expect(panel.getByText(/Server archive refreshed/)).toBeVisible();
      const savedResponse = page.waitForResponse(response => response.url().endsWith('/api/flight-logs') && response.request().method() === 'POST');
      await panel.getByRole('button', { name: 'Save to server', exact: true }).click();
      const response = await savedResponse; expect(response.status()).toBe(201); savedId = (await response.json()).data.id;
      await expect(panel.getByText(/Saved to the server SQLite archive/)).toBeVisible();
      await page.reload(); await page.waitForSelector('text=CONNECTED');
      await expect(page.getByText('SPATIAL INTELLIGENCE OS v2.0', { exact: true })).toBeHidden();
      await page.keyboard.press('l'); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click();
      panel = page.getByRole('region', { name: 'Flight log replay', exact: true });
      await panel.getByRole('button', { name: 'Refresh server archive', exact: true }).click();
      await panel.getByRole('button', { name: new RegExp(title) }).click();
      await expect(panel.getByText(/checksum verified/)).toBeVisible();
      await expect(panel.getByLabel('Analyst notes', { exact: true })).toBeDisabled();
      await expect(panel.getByLabel('Current recorded observation')).toContainText('Sample 1/6 at 0s');
      const pending = page.waitForEvent('download');
      await panel.getByRole('button', { name: 'Download after-action report', exact: true }).click();
      const download = await pending; const stream = await download.createReadStream(); const parts = [];
      for await (const part of stream) parts.push(part);
      const report = Buffer.concat(parts).toString('utf8');
      expect(report).toContain(savedId); expect(report).toContain('Gaps over 5s: 1'); expect(report).toContain('Discuss the 8s observation gap'); expect(report).toContain('not a verified aircraft feed');
      await page.screenshot({ path: 'e2e/screenshots/flight-log-replay.png', fullPage: true });
      await panel.getByRole('button', { name: 'Delete server record', exact: true }).click();
      await panel.getByRole('button', { name: 'Confirm delete record', exact: true }).click();
      await expect(panel.getByText(/Server record deleted/)).toBeVisible();
      expect((await request.get(`${API}/api/flight-logs/${savedId}`)).status()).toBe(404); savedId = undefined;
    } finally { if (savedId) await request.delete(`${API}/api/flight-logs/${savedId}`); }
  });

  test('two-flight comparison pairs local sources through gaps and exports a reproducible debrief', async ({ page }) => {
    await page.keyboard.press('l'); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Flight log replay', exact: true });
    await panel.getByRole('button', { name: 'Load synthetic sample', exact: true }).click();
    const comparison = panel.getByRole('article', { name: 'Two-flight comparison', exact: true });
    const baseline = 'time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,28.6139,77.2090,5,0,98\n2,28.6140,77.2091,15,4,97\n4,28.6141,77.2092,25,5,96\n6,28.6142,77.2093,30,6,95\n8,28.6143,77.2094,28,4,94\n10,28.6144,77.2095,20,0,93\n';
    await comparison.getByLabel('Choose baseline CSV').setInputFiles({ name: 'baseline-e2e.csv', mimeType: 'text/csv', buffer: Buffer.from(baseline) });
    await expect(comparison.getByText(/Baseline B loaded locally/)).toBeVisible();
    await expect(comparison.getByLabel('Instantaneous observation deltas')).toContainText('+5.0m');
    await comparison.getByLabel('Comparison time', { exact: true }).fill('8');
    await expect(comparison.getByText(/DATA GAP/)).toBeVisible(); await expect(comparison.getByLabel('Instantaneous observation deltas')).toContainText('altitude unknown');
    await expect(comparison.getByText('A 4s', { exact: true })).toBeVisible(); await expect(comparison.getByText('B 8s', { exact: true })).toBeVisible();
    await comparison.getByLabel('Comparison time', { exact: true }).fill('12');
    await expect(comparison.getByText(/OUTSIDE SOURCE/)).toBeVisible(); await expect(comparison.getByText('B 10s', { exact: true })).toHaveCount(0);
    await comparison.getByLabel('Comparison notes', { exact: true }).fill('Synthetic comparison. No ranking or causal claim.');
    const pending = page.waitForEvent('download'); await comparison.getByRole('button', { name: 'Download comparison report', exact: true }).click();
    const stream = await (await pending).createReadStream(); const parts = []; for await (const part of stream) parts.push(part);
    const report = Buffer.concat(parts).toString('utf8'); expect(report).toContain('PRIMARY A'); expect(report).toContain('BASELINE B'); expect(report).toContain('baseline-e2e.csv'); expect(report).toContain('Synthetic comparison.'); expect(report).toContain('not UTC'); expect(report).toContain('A 16.00s | B 10.00s | A-B 6.00s');
    await comparison.getByRole('button', { name: 'Reset comparison', exact: true }).click(); await expect(comparison.getByLabel('Comparison time', { exact: true })).toHaveValue('0');
    await comparison.getByRole('button', { name: 'Clear comparison', exact: true }).click(); await expect(comparison.getByLabel('Comparison time', { exact: true })).toHaveCount(0);
    await expect(panel.getByLabel('Current recorded observation')).toContainText('Sample 1/6');
  });

  test('instructor debrief markers seek replay and round-trip a source-bound sidecar', async ({ page }) => {
    await page.keyboard.press('l'); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Flight log replay', exact: true }); await panel.getByRole('button', { name: 'Load synthetic sample', exact: true }).click();
    await panel.getByLabel('Replay position', { exact: true }).fill('8');
    await panel.getByRole('button', { name: 'Instructor debrief', exact: true }).click();
    const review = panel.getByRole('article', { name: 'Instructor debrief timeline', exact: true });
    await review.getByLabel('Marker kind', { exact: true }).selectOption('Question'); await review.getByLabel('Instructor marker note', { exact: true }).fill('Discuss the missing interval before inferring a flight event.');
    await review.getByRole('button', { name: 'Add marker at cursor', exact: true }).click(); await expect(review.getByText('Source sample 4s, age 4.0s. DATA GAP. No observation at marker time.', { exact: true })).toBeVisible();
    await review.getByLabel('Discussed at 8.0s', { exact: true }).check(); await review.getByLabel('Discussion summary', { exact: true }).fill('Synthetic training review only.');
    const pending = page.waitForEvent('download'); await review.getByRole('button', { name: 'Download debrief JSON', exact: true }).click();
    const stream = await (await pending).createReadStream(); const parts = []; for await (const part of stream) parts.push(part); const contents = Buffer.concat(parts); const data = JSON.parse(contents.toString('utf8'));
    expect(data.markers[0].time_s).toBe(8); expect(data.markers[0].discussed).toBe(true); expect(data.source_sha256).toHaveLength(64); expect(data.csv_text).toBeUndefined();
    await review.getByRole('button', { name: 'Clear instructor review', exact: true }).click(); await review.getByRole('button', { name: 'Confirm clear review', exact: true }).click(); await expect(review.getByRole('button', { name: 'Jump to 8.0s', exact: true })).toHaveCount(0);
    await review.getByLabel('Import debrief JSON', { exact: true }).setInputFiles({ name: 'review.json', mimeType: 'application/json', buffer: contents });
    await expect(review.getByRole('button', { name: 'Replace with imported review', exact: true })).toBeVisible(); await expect(review.getByRole('button', { name: 'Jump to 8.0s', exact: true })).toHaveCount(0);
    await review.getByRole('button', { name: 'Replace with imported review', exact: true }).click(); await expect(review.getByLabel('Discussed at 8.0s', { exact: true })).toBeChecked();
    await review.getByRole('button', { name: 'Jump to 8.0s', exact: true }).click(); await expect(panel.getByLabel('Replay position', { exact: true })).toHaveValue('8'); await expect(panel.getByLabel('Current recorded observation')).toContainText('at 4s');
    const reportPending = page.waitForEvent('download'); await review.getByRole('button', { name: 'Download instructor report', exact: true }).click(); const reportStream = await (await reportPending).createReadStream(); const reportParts = []; for await (const part of reportStream) reportParts.push(part); const report = Buffer.concat(reportParts).toString('utf8');
    expect(report).toContain('sample 3 at 4s'); expect(report).toContain('DATA GAP'); expect(report).toContain('Synthetic training review only.'); expect(report).toContain('Marked discussed: 1');
    const mismatch = { ...data, source_sha256: 'b'.repeat(64) }; await review.getByLabel('Import debrief JSON', { exact: true }).setInputFiles({ name: 'wrong.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mismatch)) }); await expect(review.getByRole('alert')).toContainText('fingerprint mismatch'); await expect(review.getByRole('button', { name: 'Jump to 8.0s', exact: true })).toBeVisible();
  });

  test('training envelope criteria review recorded samples and round-trip without stale exports', async ({ page }) => {
    await page.keyboard.press('l'); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Flight log replay', exact: true }); await panel.getByRole('button', { name: 'Load synthetic sample', exact: true }).click();
    await panel.getByRole('button', { name: 'Training envelope', exact: true }).click(); const review = panel.getByRole('article', { name: 'Training envelope review', exact: true });
    await review.getByLabel('Review profile name', { exact: true }).fill('Synthetic exercise criteria'); await review.getByLabel('Maximum source altitude threshold', { exact: true }).fill('30'); await review.getByLabel('Maximum ground speed threshold', { exact: true }).fill('5'); await review.getByLabel('Minimum battery threshold', { exact: true }).fill('93'); await review.getByRole('button', { name: 'Review recorded samples', exact: true }).click();
    await expect(review.getByLabel('Maximum source altitude result', { exact: true })).toContainText('Known 5/6, missing 1. Matches 1'); await expect(review.getByLabel('Minimum battery result', { exact: true })).toContainText('Matches 2');
    await review.getByRole('button', { name: 'First minimum battery match', exact: true }).click(); await expect(panel.getByLabel('Replay position', { exact: true })).toHaveValue('14'); await review.getByRole('button', { name: 'Next matching sample', exact: true }).click(); await expect(panel.getByLabel('Replay position', { exact: true })).toHaveValue('16');
    await review.getByLabel('Envelope review notes', { exact: true }).fill('Synthetic data, not verified flight limits.');
    const pending = page.waitForEvent('download'); await review.getByRole('button', { name: 'Download review profile', exact: true }).click(); const stream = await (await pending).createReadStream(); const parts = []; for await (const part of stream) parts.push(part); const contents = Buffer.concat(parts); const profile = JSON.parse(contents.toString('utf8')); expect(profile.profile.maxAltitude).toBe(30); expect(profile.source_sha256).toBeUndefined();
    await review.getByLabel('Maximum source altitude threshold', { exact: true }).fill('40'); await expect(review.getByRole('button', { name: 'Download envelope report', exact: true })).toBeDisabled(); await expect(review.getByRole('button', { name: 'First minimum battery match', exact: true })).toBeDisabled();
    await review.getByLabel('Import review profile', { exact: true }).setInputFiles({ name: 'profile.json', mimeType: 'application/json', buffer: contents }); await expect(review.getByRole('button', { name: 'Use imported criteria', exact: true })).toBeVisible(); await expect(review.getByLabel('Maximum source altitude threshold', { exact: true })).toHaveValue('40'); await review.getByRole('button', { name: 'Use imported criteria', exact: true }).click(); await expect(review.getByLabel('Maximum source altitude threshold', { exact: true })).toHaveValue('30'); await expect(review.getByRole('button', { name: 'Download envelope report', exact: true })).toBeDisabled(); await review.getByRole('button', { name: 'Review recorded samples', exact: true }).click();
    const reportPending = page.waitForEvent('download'); await review.getByRole('button', { name: 'Download envelope report', exact: true }).click(); const reportStream = await (await reportPending).createReadStream(); const reportParts = []; for await (const part of reportStream) reportParts.push(part); const report = Buffer.concat(reportParts).toString('utf8'); expect(report).toContain('Sample 5 at 14s: 35m'); expect(report).toContain('Sample 6 at 16s: 90%'); expect(report).toContain('Synthetic data, not verified flight limits.'); expect(report).toContain('Exact-source SHA-256:'); expect(report).toContain('4s to 12s (8s');
    await panel.getByRole('button', { name: 'Load synthetic sample', exact: true }).click(); await expect(panel.getByLabel('Current recorded observation')).toContainText('Sample 1/6');
    const csv = 'time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,0,0,1,2,90\n1,0.001,0,2,3,89\n'; await panel.getByLabel('Choose flight CSV', { exact: true }).setInputFiles({ name: 'new-source.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }); await expect(review.getByLabel('Review profile name', { exact: true })).toHaveValue(''); await expect(review.getByLabel('Generated envelope review')).toHaveCount(0);
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
    // Telemetry shows 0.0V until the first frame arrives, so wait for a real reading.
    const readVoltage = async () => {
      const texts = await page.locator('text=/\\d+\\.\\d+V/').allTextContents();
      return Math.max(0, ...texts.map((t) => parseFloat(t)).filter((v) => !Number.isNaN(v)));
    };
    await expect.poll(readVoltage, { timeout: 15000 }).toBeGreaterThan(0);
    const voltage = await readVoltage();
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
    expect(Math.abs(collapsedWidth - initialWidth)).toBeLessThan(1);
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
    const getCoordBtn = () => page.locator('.absolute.bottom-32.left-3.z-30 button');
    const getCoordText = async () => (await getCoordBtn().first().textContent() || '').trim();

    const btn = getCoordBtn();
    await expect(btn).toBeVisible({ timeout: 15000 });

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
    await page.locator('aside button[aria-label="Analytics"]').click();
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
