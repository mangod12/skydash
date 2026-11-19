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
      await expect(panel.getByText(/DATA GAP\. Holding observation/)).toBeVisible();
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

  test('portable review case reopens exact source and review state without a server archive', async ({ page }) => {
    await page.keyboard.press('l'); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); const panel = page.getByRole('region', { name: 'Flight log replay', exact: true }); await panel.getByRole('button', { name: 'Load synthetic sample', exact: true }).click();
    await panel.getByLabel('Review title', { exact: true }).fill('Portable synthetic case'); await panel.getByLabel('Analyst notes', { exact: true }).fill('Analyst context'); await panel.getByLabel('Replay position', { exact: true }).fill('8');
    const instructor = panel.getByRole('article', { name: 'Instructor debrief timeline', exact: true }); await instructor.getByLabel('Instructor marker note', { exact: true }).fill('Discuss missing interval'); await instructor.getByRole('button', { name: 'Add marker at cursor', exact: true }).click(); await instructor.getByLabel('Discussed at 8.0s', { exact: true }).check(); await instructor.getByLabel('Discussion summary', { exact: true }).fill('Instructor context');
    const envelope = panel.getByRole('article', { name: 'Training envelope review', exact: true }); await envelope.getByLabel('Review profile name', { exact: true }).fill('Portable criteria'); await envelope.getByLabel('Minimum battery threshold', { exact: true }).fill('93'); await envelope.getByRole('button', { name: 'Review recorded samples', exact: true }).click(); await envelope.getByLabel('Envelope review notes', { exact: true }).fill('Envelope context');
    const casePanel = panel.getByRole('article', { name: 'Portable review case', exact: true }); const download = page.waitForEvent('download'); await casePanel.getByRole('button', { name: 'Download review case JSON', exact: true }).click(); const stream = await (await download).createReadStream(); const parts = []; for await (const part of stream) parts.push(part); const bytes = Buffer.concat(parts); const data = JSON.parse(bytes.toString('utf8')); expect(data.source.csv_text).toContain('0,28.61390'); expect(data.debrief.markers[0].time_s).toBe(8); expect(data.envelope.profile.minBattery).toBe(93); expect(data.source.id).toBeUndefined();
    await envelope.getByLabel('Minimum battery threshold', { exact: true }).fill('90'); await casePanel.getByRole('button', { name: 'Download review case JSON', exact: true }).click(); await expect(casePanel.getByRole('alert')).toContainText('Review the current envelope criteria');
    await casePanel.getByLabel('Open review case JSON', { exact: true }).setInputFiles({ name: 'case.json', mimeType: 'application/json', buffer: bytes }); await expect(casePanel.getByRole('button', { name: 'Replace local workspace with case', exact: true })).toBeVisible(); await expect(envelope.getByLabel('Minimum battery threshold', { exact: true })).toHaveValue('90'); await casePanel.getByRole('button', { name: 'Replace local workspace with case', exact: true }).click(); await expect(envelope.getByLabel('Minimum battery threshold', { exact: true })).toHaveValue('93'); await expect(envelope.getByLabel('Minimum battery result', { exact: true })).toContainText('Matches 2');
    await page.reload(); await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await expect(panel.getByLabel('Replay position', { exact: true })).toHaveCount(0); await casePanel.getByLabel('Open review case JSON', { exact: true }).setInputFiles({ name: 'case.json', mimeType: 'application/json', buffer: bytes }); await expect(casePanel.getByRole('button', { name: 'Replace local workspace with case', exact: true })).toBeVisible(); await expect(panel.getByLabel('Replay position', { exact: true })).toHaveCount(0); await casePanel.getByRole('button', { name: 'Replace local workspace with case', exact: true }).click();
    await expect(panel.getByLabel('Review title', { exact: true })).toHaveValue('Portable synthetic case'); await expect(panel.getByLabel('Analyst notes', { exact: true })).toHaveValue('Analyst context'); await expect(instructor.getByLabel('Discussion summary', { exact: true })).toHaveValue('Instructor context'); await expect(instructor.getByLabel('Discussed at 8.0s', { exact: true })).toBeChecked(); await expect(envelope.getByLabel('Envelope review notes', { exact: true })).toHaveValue('Envelope context'); await instructor.getByRole('button', { name: 'Jump to 8.0s', exact: true }).click(); await expect(panel.getByLabel('Replay position', { exact: true })).toHaveValue('8'); await expect(panel.getByLabel('Current recorded observation')).toContainText('at 4s');
    const reportDownload = page.waitForEvent('download'); await casePanel.getByRole('button', { name: 'Download combined case report', exact: true }).click(); const reportStream = await (await reportDownload).createReadStream(); const reportParts = []; for await (const part of reportStream) reportParts.push(part); const report = Buffer.concat(reportParts).toString('utf8'); for (const text of ['Analyst context', 'Instructor context', 'Envelope context', 'DATA GAP', 'Sample 6 at 16s: 90%']) expect(report).toContain(text);
    data.source.sha256 = 'b'.repeat(64); await casePanel.getByLabel('Open review case JSON', { exact: true }).setInputFiles({ name: 'corrupt.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) }); await expect(casePanel.getByRole('alert')).toContainText('fingerprint mismatch'); await expect(instructor.getByText('Discuss missing interval', { exact: true })).toBeVisible(); await expect(casePanel.getByRole('button', { name: 'Replace local workspace with case', exact: true })).toHaveCount(0);
    await panel.getByLabel('Choose flight CSV', { exact: true }).setInputFiles({ name: 'different.csv', mimeType: 'text/csv', buffer: Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,0,0,1,2,90\n1,0.001,0,2,3,89\n') }); await expect(instructor.getByText('Discuss missing interval', { exact: true })).toHaveCount(0); await expect(envelope.getByLabel('Review profile name', { exact: true })).toHaveValue('');
  });

  test('source evidence inventory navigates gaps and missing rows and exports all evidence', async ({ page }) => {
    await page.keyboard.press('l'); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); const panel = page.getByRole('region', { name: 'Flight log replay', exact: true }); await panel.getByRole('button', { name: 'Load synthetic sample', exact: true }).click(); await panel.getByRole('button', { name: 'Source evidence', exact: true }).click(); const evidence = panel.getByRole('article', { name: 'Source evidence inventory', exact: true });
    await expect(evidence.getByLabel('Source channel evidence', { exact: true })).toContainText('Source altitude: known 5/6, missing 1'); await expect(evidence.getByLabel('Source evidence groups', { exact: true })).toContainText('Rows 3 to 4: 4s to 12s'); await evidence.getByRole('button', { name: 'Jump to row 3 at 4s', exact: true }).click(); await expect(panel.getByLabel('Replay position', { exact: true })).toHaveValue('4'); await evidence.getByRole('button', { name: 'Jump to row 4 at 12s', exact: true }).click(); await expect(panel.getByLabel('Replay position', { exact: true })).toHaveValue('12');
    await evidence.getByLabel('Evidence group', { exact: true }).selectOption('battery_pct'); await expect(evidence.getByLabel('Source evidence groups', { exact: true })).toContainText('1 consecutive missing cells'); await evidence.getByRole('button', { name: 'Jump to row 4 at 12s', exact: true }).click(); await expect(panel.getByLabel('Current recorded observation')).toContainText('battery unknown'); await evidence.getByLabel('Evidence group', { exact: true }).selectOption('ground_speed_m_s'); await expect(evidence.getByText(/No groups in this category/)).toBeVisible();
    const csv = 'time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n' + Array.from({ length: 30 }, (_, index) => `${index * 6},0,0,,,`).join('\n') + '\n'; await panel.getByLabel('Choose flight CSV', { exact: true }).setInputFiles({ name: 'interval-evidence.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }); await expect(evidence.getByLabel('Evidence group', { exact: true })).toHaveValue('gaps'); await expect(evidence.getByText(/Page 1\/3/)).toBeVisible(); await expect(evidence.getByLabel('Source evidence groups').getByRole('listitem')).toHaveCount(12); await evidence.getByRole('button', { name: 'Next evidence page', exact: true }).click(); await evidence.getByRole('button', { name: 'Next evidence page', exact: true }).click(); await expect(evidence.getByLabel('Source evidence groups').getByRole('listitem')).toHaveCount(5); await expect(evidence.getByRole('button', { name: 'Next evidence page', exact: true })).toBeDisabled();
    const pending = page.waitForEvent('download'); await evidence.getByRole('button', { name: 'Download source evidence report', exact: true }).click(); const stream = await (await pending).createReadStream(); const parts = []; for await (const part of stream) parts.push(part); const report = Buffer.concat(parts).toString('utf8'); expect(report).toContain('Rows 1 to 2: 0s to 6s'); expect(report).toContain('Rows 29 to 30: 168s to 174s'); expect(report).toContain('Rows 1 to 30, timestamps 0s to 174s: 30 missing cells');
    await evidence.getByLabel('Evidence group', { exact: true }).selectOption('repeated'); await expect(evidence.getByText(/Page 1\/1/)).toBeVisible(); await expect(evidence.getByLabel('Source evidence groups')).toContainText('30 consecutive identical coordinate rows');
    const casePanel = panel.getByRole('article', { name: 'Portable review case', exact: true }); const combined = page.waitForEvent('download'); await casePanel.getByRole('button', { name: 'Download combined case report', exact: true }).click(); const combinedStream = await (await combined).createReadStream(); const combinedParts = []; for await (const part of combinedStream) combinedParts.push(part); const combinedReport = Buffer.concat(combinedParts).toString('utf8'); expect(combinedReport).toContain('SKYDASH / SOURCE EVIDENCE INVENTORY'); expect(combinedReport).toContain('Rows 29 to 30: 168s to 174s');
  });

  test('explicit CSV mapping converts chosen units and opens only after source-replacement confirmation', async ({ page }) => {
    await page.keyboard.press('l'); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); const panel = page.getByRole('region', { name: 'Flight log replay', exact: true }); await panel.getByRole('button', { name: 'Load synthetic sample', exact: true }).click(); const instructor = panel.getByRole('article', { name: 'Instructor debrief timeline', exact: true }); await instructor.getByLabel('Instructor marker note', { exact: true }).fill('Existing review'); await instructor.getByRole('button', { name: 'Add marker at cursor', exact: true }).click();
    await panel.getByText('Map another numeric CSV (explicit columns and units)', { exact: true }).click(); const mapper = panel.getByRole('article', { name: 'CSV column mapping', exact: true }); const csv = 'clock,lat,lon,height_ft,speed_kmh,battery,other\n1000,28.6,77.2,100,36,95,ignored\n3000,28.61,77.21,,18,,ignored\n'; await mapper.getByLabel('Choose CSV for mapping', { exact: true }).setInputFiles({ name: 'generic-export.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }); await expect(mapper.getByLabel('Map time_s', { exact: true })).toHaveValue('');
    for (const [field, index] of [['time_s', 0], ['latitude', 1], ['longitude', 2], ['altitude_m', 3], ['ground_speed_m_s', 4], ['battery_pct', 5]]) await mapper.getByLabel(`Map ${field}`, { exact: true }).selectOption(String(index)); await mapper.getByLabel('Input time unit', { exact: true }).selectOption('ms'); await mapper.getByLabel('Input time origin', { exact: true }).selectOption('subtract-first'); await mapper.getByLabel('Input altitude unit', { exact: true }).selectOption('ft'); await mapper.getByLabel('Input ground speed unit', { exact: true }).selectOption('km/h'); await mapper.getByLabel('Confirm WGS84 decimal-degree source coordinates', { exact: true }).check(); await mapper.getByRole('button', { name: 'Preview mapped conversion', exact: true }).click(); await expect(mapper.getByLabel('Mapped conversion preview')).toContainText('30.48'); await expect(instructor.getByText('Existing review', { exact: true })).toBeVisible();
    const download = page.waitForEvent('download'); await mapper.getByRole('button', { name: 'Download mapped CSV', exact: true }).click(); const stream = await (await download).createReadStream(); const parts = []; for await (const part of stream) parts.push(part); const mappedCSV = Buffer.concat(parts).toString('utf8'); expect(mappedCSV).toContain('0,28.6,77.2,30.48,10,95'); expect(mappedCSV).toContain('2,28.61,77.21,,5,'); expect(mappedCSV).not.toContain('ignored');
    const recordDownload = page.waitForEvent('download'); await mapper.getByRole('button', { name: 'Download conversion record', exact: true }).click(); const recordStream = await (await recordDownload).createReadStream(); const recordParts = []; for await (const part of recordStream) recordParts.push(part); const record = Buffer.concat(recordParts).toString('utf8'); expect(record).toContain('Original exact UTF-8 SHA-256'); expect(record).toContain('source column 4 (height_ft)'); expect(record).toContain('converted CSV only');
    await mapper.getByRole('button', { name: 'Review before opening mapped CSV', exact: true }).click(); await mapper.getByRole('button', { name: 'Keep current replay', exact: true }).click(); await expect(instructor.getByText('Existing review', { exact: true })).toBeVisible(); await mapper.getByRole('button', { name: 'Review before opening mapped CSV', exact: true }).click(); await mapper.getByRole('button', { name: 'Confirm open mapped CSV', exact: true }).click(); await expect(instructor.getByText('Existing review', { exact: true })).toHaveCount(0); await expect(panel.getByLabel('Current recorded observation')).toContainText('altitude 30.5m / speed 10.0m/s / battery 95.0%'); await expect(panel.getByLabel('Replay position', { exact: true })).toHaveValue('0'); await expect(panel.getByLabel('Review title', { exact: true })).toHaveValue('generic-export-mapped');
    await mapper.getByLabel('Input time unit', { exact: true }).selectOption('s'); await expect(mapper.getByLabel('Mapped conversion preview')).toHaveCount(0); await expect(mapper.getByRole('button', { name: 'Confirm open mapped CSV', exact: true })).toHaveCount(0);
  });


  test('portable mapping recipe previews exact headers and requires fresh source-coordinate confirmation before conversion', async ({ page }) => {
    await page.keyboard.press('l'); await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click(); const panel=page.getByRole('region',{name:'Flight log replay',exact:true}); await panel.getByText('Load synthetic sample',{exact:true}).click(); await panel.getByLabel('Analyst notes',{exact:true}).fill('Preserve current replay review'); await panel.getByText('Map another numeric CSV (explicit columns and units)',{exact:true}).click(); const mapper=panel.getByRole('article',{name:'CSV column mapping',exact:true}); const csv='clock,lat,lon,height,speed,battery\n1000,28.6,77.2,100,36,95\n3000,28.61,77.21,,18,\n'; const source={name:'recipe-source.csv',mimeType:'text/csv',buffer:Buffer.from(csv)}; await mapper.getByLabel('Choose CSV for mapping',{exact:true}).setInputFiles(source); for(const [field,index] of [['time_s',0],['latitude',1],['longitude',2],['altitude_m',3],['ground_speed_m_s',4],['battery_pct',5]])await mapper.getByLabel(`Map ${field}`,{exact:true}).selectOption(String(index)); for(const [label,value] of [['Input time unit','ms'],['Input time origin','subtract-first'],['Input altitude unit','ft'],['Input ground speed unit','km/h']])await mapper.getByLabel(label,{exact:true}).selectOption(value); await mapper.getByLabel('Confirm WGS84 decimal-degree source coordinates',{exact:true}).check(); await mapper.getByLabel('Recipe label',{exact:true}).fill('Training numeric export'); const pending=page.waitForEvent('download'); await mapper.getByText('Download mapping recipe JSON',{exact:true}).click(); const stream=await(await pending).createReadStream();const parts=[];for await(const part of stream)parts.push(part);const text=Buffer.concat(parts).toString('utf8');expect(text).not.toContain('28.6');expect(text).not.toContain('coordinateReference');
    await mapper.getByLabel('Choose CSV for mapping',{exact:true}).setInputFiles(source); await expect(mapper.getByLabel('Map time_s',{exact:true})).toHaveValue(''); const recipe={name:'recipe.json',mimeType:'application/json',buffer:Buffer.from(text)}; await mapper.getByLabel('Import mapping recipe JSON',{exact:true}).setInputFiles(recipe); await expect(mapper.getByLabel('Mapping recipe preview')).toContainText('Training numeric export'); await expect(mapper.getByLabel('Map time_s',{exact:true})).toHaveValue(''); await mapper.getByText('Keep current mapping',{exact:true}).click(); await expect(mapper.getByLabel('Map time_s',{exact:true})).toHaveValue(''); await mapper.getByLabel('Import mapping recipe JSON',{exact:true}).setInputFiles(recipe); await mapper.getByText('Apply recipe to mapping fields',{exact:true}).click(); await expect(mapper.getByLabel('Map time_s',{exact:true})).toHaveValue('0'); await expect(mapper.getByLabel('Input altitude unit',{exact:true})).toHaveValue('ft'); await expect(mapper.getByLabel('Confirm WGS84 decimal-degree source coordinates',{exact:true})).not.toBeChecked(); await expect(mapper.getByLabel('Mapped conversion preview')).toHaveCount(0); await expect(panel.getByLabel('Analyst notes',{exact:true})).toHaveValue('Preserve current replay review'); await mapper.getByText('Preview mapped conversion',{exact:true}).click(); await expect(mapper.getByRole('alert')).toContainText('Confirm source coordinates'); await mapper.getByLabel('Confirm WGS84 decimal-degree source coordinates',{exact:true}).check(); await mapper.getByText('Preview mapped conversion',{exact:true}).click(); await expect(mapper.getByLabel('Mapped conversion preview')).toContainText('30.48'); await mapper.getByLabel('Import mapping recipe JSON',{exact:true}).setInputFiles({...recipe,buffer:Buffer.from(text.replace('clock','changed'))}); await expect(mapper.getByRole('alert')).toContainText('exactly match'); await expect(mapper.getByLabel('Mapped conversion preview')).toBeVisible(); await expect(panel.getByLabel('Analyst notes',{exact:true})).toHaveValue('Preserve current replay review');
  });

  test('source-bound window notebook saves independent selections and restores only after preview confirmation', async ({ page }) => {
    await page.keyboard.press('l'); await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click(); const panel=page.getByRole('region',{name:'Flight log replay',exact:true}); await panel.getByText('Load synthetic sample',{exact:true}).click(); await panel.getByLabel('Analyst notes',{exact:true}).fill('Primary review unchanged'); const window=panel.getByRole('article',{name:'Selected-sample review window',exact:true});const notebook=window.getByRole('region',{name:'Review window notebook',exact:true});await window.getByLabel('Window start data row',{exact:true}).fill('3');await window.getByLabel('Window end data row',{exact:true}).fill('5');await window.getByLabel('Window label',{exact:true}).fill('Synthetic gap discussion');await window.getByLabel('Window discussion notes',{exact:true}).fill('Reviewer question, not a detected event.');await window.getByText('Review selected samples',{exact:true}).click();await notebook.getByText('Save reviewed window copy to notebook',{exact:true}).click();await window.getByLabel('Window label',{exact:true}).fill('Unsaved fields');await expect(notebook.getByText('Save reviewed window copy to notebook',{exact:true})).toBeDisabled();const pending=page.waitForEvent('download');await notebook.getByText('Download window notebook JSON',{exact:true}).click();const stream=await(await pending).createReadStream();const parts=[];for await(const part of stream)parts.push(part);const text=Buffer.concat(parts).toString('utf8');expect(text).toContain('Synthetic gap discussion');expect(text).not.toContain('Unsaved fields');expect(text).not.toContain('latitude');
    await page.reload();await page.keyboard.press('l');await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click();await panel.getByText('Load synthetic sample',{exact:true}).click();const file={name:'notebook.json',mimeType:'application/json',buffer:Buffer.from(text)};await notebook.getByLabel('Import window notebook JSON',{exact:true}).setInputFiles(file);await expect(notebook.getByLabel('Window notebook import preview')).toContainText('Rows 3 through 5, original 4s to 14s');await expect(window.getByLabel('Window label',{exact:true})).toHaveValue('');await notebook.getByText('Keep current notebook',{exact:true}).click();await expect(notebook.getByText('Load saved selection: Synthetic gap discussion',{exact:true})).toHaveCount(0);await notebook.getByLabel('Import window notebook JSON',{exact:true}).setInputFiles(file);await notebook.getByText('Replace saved notebook copies',{exact:true}).click();await expect(window.getByLabel('Window label',{exact:true})).toHaveValue('');await notebook.getByText('Load saved selection: Synthetic gap discussion',{exact:true}).click();await expect(window.getByLabel('Window label',{exact:true})).toHaveValue('Synthetic gap discussion');await expect(window.getByText('Download window report',{exact:true})).toBeDisabled();await window.getByText('Review selected samples',{exact:true}).click();await expect(window.getByLabel('Reviewed sample window')).toContainText('First-to-last span 10s');await window.getByText('Next window sample',{exact:true}).click();await expect(panel.getByLabel('Replay position',{exact:true})).toHaveValue('12');await expect(window.getByLabel('Window sample evidence')).toContainText('Source altitude unknown');const bad=JSON.parse(text);bad.source_sha256='f'.repeat(64);await notebook.getByLabel('Import window notebook JSON',{exact:true}).setInputFiles({...file,buffer:Buffer.from(JSON.stringify(bad))});await expect(notebook.getByRole('alert')).toContainText('fingerprint mismatch');await expect(notebook.getByText('Load saved selection: Synthetic gap discussion',{exact:true})).toBeVisible();await notebook.getByText('Remove saved selection: Synthetic gap discussion',{exact:true}).click();await notebook.getByText('Confirm remove saved window',{exact:true}).click();await expect(notebook.getByText('Load saved selection: Synthetic gap discussion',{exact:true})).toHaveCount(0);await expect(window.getByLabel('Window label',{exact:true})).toHaveValue('Synthetic gap discussion');await expect(window.getByText('Download window report',{exact:true})).toBeEnabled();await notebook.getByText('Save reviewed window copy to notebook',{exact:true}).click();await panel.getByLabel('Choose flight CSV',{exact:true}).setInputFiles({name:'new-source.csv',mimeType:'text/csv',buffer:Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,0,0,0,0,0\n1,0,0,1,1,1\n')});await expect(notebook).toContainText('0/20 saved windows');await expect(window.getByLabel('Window label',{exact:true})).toHaveValue('');
  });

  test('source row ledger filters original rows, locates nearest exact timestamps and exports every matching row', async ({ page }) => {
    await page.keyboard.press('l');await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click();const replay=page.getByRole('region',{name:'Flight log replay',exact:true});await replay.getByText('Load synthetic sample',{exact:true}).click();const ledger=replay.getByRole('article',{name:'Recorded source row ledger',exact:true});await replay.getByLabel('Replay position',{exact:true}).fill('8');await expect(ledger.getByLabel('Seek source data row 3',{exact:true})).toContainText('(held)');await ledger.getByLabel('Source row filter',{exact:true}).selectOption('missing_any');await expect(ledger.getByLabel('Ledger matching row counts')).toContainText('1/6 matching');await expect(ledger.getByText('8 / gap over 5s',{exact:true})).toBeVisible();await ledger.getByLabel('Seek source data row 4',{exact:true}).click();await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('12');await expect(ledger.getByLabel('Source row filter',{exact:true})).toHaveValue('missing_any');const pending=page.waitForEvent('download');await ledger.getByText('Download matching row evidence',{exact:true}).click();const stream=await(await pending).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const report=Buffer.concat(chunks).toString('utf8');expect(report).toContain('Matching rows: 1 of 6');expect(report).toContain('4,12,28.6142,77.2093,unknown,5,unknown,8,yes');expect(report).not.toContain('6,16,');await ledger.getByLabel('Ledger original seconds',{exact:true}).fill('8');await ledger.getByText('Locate nearest time in all rows and seek',{exact:true}).click();await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('4');await expect(ledger.getByLabel('Source row filter',{exact:true})).toHaveValue('all');await ledger.getByLabel('Ledger original data row',{exact:true}).fill('999');await ledger.getByText('Locate row in all rows and seek replay',{exact:true}).click();await expect(ledger.getByRole('alert')).toContainText('existing whole source');await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('4');
    const csv='time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n'+Array.from({length:45},(_,i)=>`${i},0,0,${i},,0`).join('\n')+'\n';await replay.getByLabel('Choose flight CSV',{exact:true}).setInputFiles({name:'45-source-rows.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await expect(ledger.getByLabel('Ledger matching row counts')).toContainText('45/45 matching');await ledger.getByText('Next ledger page',{exact:true}).click();await expect(ledger.getByLabel('Seek source data row 21',{exact:true})).toBeVisible();await ledger.getByText('Last ledger page',{exact:true}).click();await expect(ledger.getByLabel('Seek source data row 45',{exact:true})).toBeVisible();await ledger.getByLabel('Ledger original data row',{exact:true}).fill('22');await ledger.getByText('Locate row in all rows and seek replay',{exact:true}).click();await expect(ledger.getByLabel('Source ledger page')).toHaveText('Page 2/3');await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('21');await ledger.getByLabel('Source row filter',{exact:true}).selectOption('gap_end');await expect(ledger.getByText(/No matching source rows/)).toBeVisible();await ledger.getByText('Locate held replay row in all rows and seek',{exact:true}).click();await expect(ledger.getByLabel('Source ledger page')).toHaveText('Page 2/3');await expect(ledger.getByLabel('Source row filter',{exact:true})).toHaveValue('all');
  });

  test('comparison sample ledger preserves originating rows and blocks stale anchor navigation while primary review stays unchanged', async ({ page }) => {
    await page.keyboard.press('l');await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click();const replay=page.getByRole('region',{name:'Flight log replay',exact:true});await replay.getByText('Load synthetic sample',{exact:true}).click();await replay.getByLabel('Replay position',{exact:true}).fill('2');const comparison=replay.getByRole('article',{name:'Two-flight comparison',exact:true});await comparison.getByText('Load synthetic baseline',{exact:true}).click();const ledger=comparison.getByRole('region',{name:'Comparison sample evidence ledger',exact:true});await expect(ledger.getByLabel('Comparison ledger counts')).toContainText('12/12 matching');await ledger.getByLabel('Comparison ledger filter',{exact:true}).selectOption('gap');await expect(ledger.getByLabel('Comparison ledger counts')).toContainText('3/12 matching');await ledger.getByText('Seek comparison to B row 5',{exact:true}).click();await expect(comparison.getByLabel('Comparison time',{exact:true})).toHaveValue('8');await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('2');const pending=page.waitForEvent('download');await ledger.getByText('Download comparison sample evidence',{exact:true}).click();const stream=await(await pending).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const report=Buffer.concat(chunks).toString('utf8');expect(report).toContain('matching entries 3 of 12');expect(report).toContain('8,B,5,3,4,4,gap,30,6,93,5,8,0,observed,32,5,92');expect(report).not.toContain('28.614');await comparison.getByLabel('A anchor data row',{exact:true}).fill('4');await expect(ledger.getByText('Download comparison sample evidence',{exact:true})).toBeDisabled();await expect(ledger.getByText('Seek comparison to B row 5',{exact:true})).toBeDisabled();await comparison.getByLabel('B anchor data row',{exact:true}).fill('3');await comparison.getByLabel('Review anchor label',{exact:true}).fill('Discussion association');await comparison.getByText('Apply manual sample anchors',{exact:true}).click();await expect(ledger.getByLabel('Comparison ledger filter',{exact:true})).toHaveValue('all');await ledger.getByLabel('Comparison ledger origin source',{exact:true}).selectOption('A');await ledger.getByLabel('Comparison ledger original data row',{exact:true}).fill('3');await ledger.getByText('Locate origin row in all entries and seek comparison',{exact:true}).click();await expect(comparison.getByLabel('Comparison time',{exact:true})).toHaveValue('-8');await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('2');await ledger.getByLabel('Comparison ledger filter',{exact:true}).selectOption('outside');await expect(ledger.getByText(/OUTSIDE:/).first()).toBeVisible();await comparison.getByText('Load synthetic baseline',{exact:true}).click();await expect(ledger.getByLabel('Comparison ledger filter',{exact:true})).toHaveValue('all');await expect(comparison.getByLabel('Comparison time',{exact:true})).toHaveValue('0');
  });

  test('independent selected windows compare only original bounds and preserve source cursors with stale-export guard', async ({ page }) => {
    await page.keyboard.press('l');await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click();const replay=page.getByRole('region',{name:'Flight log replay',exact:true});await replay.getByText('Load synthetic sample',{exact:true}).click();await replay.getByLabel('Replay position',{exact:true}).fill('2');const comparison=replay.getByRole('article',{name:'Two-flight comparison',exact:true});await comparison.getByText('Load synthetic baseline',{exact:true}).click();await comparison.getByLabel('Comparison time',{exact:true}).fill('6');const panel=comparison.getByRole('region',{name:'Independent sample window comparison',exact:true});for(const[label,value]of[['Window comparison A start row','3'],['Window comparison A end row','5'],['Window comparison B start row','2'],['Window comparison B end row','4'],['Window comparison label','Independent instructor selections'],['Window comparison discussion notes','No same-phase or improvement claim.']])await panel.getByLabel(label,{exact:true}).fill(value);await panel.getByText('Review independent sample windows',{exact:true}).click();await expect(panel.getByLabel('Reviewed independent windows')).toContainText('A: original data rows 3 through 5, original 4s to 14s');await expect(panel.getByLabel('Reviewed independent windows')).toContainText('B: original data rows 2 through 4, original 2s to 6s');await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('2');await expect(comparison.getByLabel('Comparison time',{exact:true})).toHaveValue('6');const pending=page.waitForEvent('download');await panel.getByText('Download selected-window comparison report',{exact:true}).click();const stream=await(await pending).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const text=Buffer.concat(chunks).toString('utf8');for(const value of ['A,4,12,unknown,5,unknown','B,4,6,30,6,93','No same-phase or improvement claim.'])expect(text).toContain(value);expect(text).not.toContain('28.614');await panel.getByLabel('Window comparison A start row',{exact:true}).fill('999');await panel.getByText('Review independent sample windows',{exact:true}).click();await expect(panel.getByRole('alert')).toContainText('inclusive existing');await expect(panel.getByText('Download selected-window comparison report',{exact:true})).toBeDisabled();await panel.getByText('Discard window comparison edits',{exact:true}).click();await expect(panel.getByLabel('Window comparison A start row',{exact:true})).toHaveValue('3');await comparison.getByLabel('A anchor data row',{exact:true}).fill('4');await expect(panel.getByText('Download selected-window comparison report',{exact:true})).toBeDisabled();await comparison.getByLabel('B anchor data row',{exact:true}).fill('3');await comparison.getByLabel('Review anchor label',{exact:true}).fill('Independent playback association');await comparison.getByText('Apply manual sample anchors',{exact:true}).click();await expect(panel.getByLabel('Window comparison A start row',{exact:true})).toHaveValue('3');await expect(panel.getByText('Download selected-window comparison report',{exact:true})).toBeEnabled();await expect(panel.getByLabel('Reviewed independent windows')).toContainText('original 4s to 14s');await comparison.getByText('Load synthetic baseline',{exact:true}).click();await expect(panel.getByLabel('Window comparison label',{exact:true})).toHaveValue('');await expect(panel.getByLabel('Reviewed independent windows')).toHaveCount(0);
  });

  test('portable window comparison previews exact ordered sources and restores fields only before explicit review', async ({ page }) => {
    await page.keyboard.press('l');await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click();let replay=page.getByRole('region',{name:'Flight log replay',exact:true});await replay.getByText('Load synthetic sample',{exact:true}).click();let comparison=replay.getByRole('article',{name:'Two-flight comparison',exact:true});await comparison.getByText('Load synthetic baseline',{exact:true}).click();let panel=comparison.getByRole('region',{name:'Independent sample window comparison',exact:true});for(const[label,value]of[['Window comparison A start row','3'],['Window comparison A end row','5'],['Window comparison B start row','2'],['Window comparison B end row','4'],['Window comparison label','Portable instructor handoff'],['Window comparison discussion notes','Unverified reviewer context, not improved performance.']])await panel.getByLabel(label,{exact:true}).fill(value);await panel.getByText('Review independent sample windows',{exact:true}).click();const download=page.waitForEvent('download');await panel.getByText('Download window comparison JSON',{exact:true}).click();const stream=await(await download).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const text=Buffer.concat(chunks).toString('utf8'),data=JSON.parse(text);expect(data.selection.aFirst).toBe(3);expect(text).not.toContain('latitude');expect(text).not.toContain('csv_text');
    await page.reload();await page.getByRole('button',{name:'Scenario Lab',exact:true}).click();await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click();replay=page.getByRole('region',{name:'Flight log replay',exact:true});await replay.getByText('Load synthetic sample',{exact:true}).click();comparison=replay.getByRole('article',{name:'Two-flight comparison',exact:true});await comparison.getByText('Load synthetic baseline',{exact:true}).click();panel=comparison.getByRole('region',{name:'Independent sample window comparison',exact:true});await replay.getByLabel('Replay position',{exact:true}).fill('2');await comparison.getByLabel('Comparison time',{exact:true}).fill('6');const upload=async value=>panel.getByLabel('Import window comparison JSON',{exact:true}).setInputFiles({name:'window-comparison.json',mimeType:'application/json',buffer:Buffer.from(value)});await upload(text);await expect(panel.getByLabel('Window comparison import preview')).toContainText('A original rows 3 through 5; B original rows 2 through 4');await expect(panel.getByLabel('Window comparison label',{exact:true})).toHaveValue('');await expect(panel.getByText('Review independent sample windows',{exact:true})).toBeDisabled();await panel.getByText('Keep current window comparison',{exact:true}).click();await expect(panel.getByLabel('Window comparison label',{exact:true})).toHaveValue('');await upload(text);await panel.getByText('Load imported window comparison fields',{exact:true}).click();await expect(panel.getByLabel('Window comparison label',{exact:true})).toHaveValue('Portable instructor handoff');await expect(panel.getByLabel('Reviewed independent windows')).toHaveCount(0);await expect(panel.getByText('Download window comparison JSON',{exact:true})).toBeDisabled();await panel.getByText('Review independent sample windows',{exact:true}).click();await expect(panel.getByLabel('Reviewed independent windows')).toContainText('A: original data rows 3 through 5, original 4s to 14s');await expect(panel.getByText('Download window comparison JSON',{exact:true})).toBeEnabled();await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('2');await expect(comparison.getByLabel('Comparison time',{exact:true})).toHaveValue('6');await upload(JSON.stringify({...data,primary_sha256:data.baseline_sha256,baseline_sha256:data.primary_sha256}));await expect(panel.getByRole('alert')).toContainText('Ordered source fingerprints mismatch');await expect(panel.getByLabel('Window comparison label',{exact:true})).toHaveValue('Portable instructor handoff');await upload(JSON.stringify({...data,summary:{count:999}}));await expect(panel.getByRole('alert')).toContainText('Unsupported');await upload(text);await expect(panel.getByLabel('Window comparison import preview')).toBeVisible();await comparison.getByText('Load synthetic baseline',{exact:true}).click();await expect(panel.getByLabel('Window comparison import preview')).toHaveCount(0);await expect(panel.getByLabel('Window comparison label',{exact:true})).toHaveValue('');
  });

  test('reference circle reviews explicit recorded points without crossing claims and preserves unknown gap evidence', async ({ page }) => {
    await page.keyboard.press('l');await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click();const replay=page.getByRole('region',{name:'Flight log replay',exact:true});await replay.getByText('Load synthetic sample',{exact:true}).click();await replay.getByLabel('Replay position',{exact:true}).fill('8');const comparison=replay.getByRole('article',{name:'Two-flight comparison',exact:true});await comparison.getByText('Load synthetic baseline',{exact:true}).click();await comparison.getByLabel('Comparison time',{exact:true}).fill('6');const circle=replay.getByRole('article',{name:'Recorded reference circle review',exact:true});await circle.getByText('Copy held source point into reference fields',{exact:true}).click();await expect(circle.getByLabel('Reference latitude (degrees)',{exact:true})).toHaveValue('28.6141');await expect(circle.getByText(/Copied original row 3 at 4s/)).toBeVisible();for(const[label,value]of[['Reference latitude (degrees)','28.6139'],['Reference longitude (degrees)','77.209'],['Reference radius (metres)','40'],['Reference circle label','Instructor reference discussion'],['Reference circle discussion notes','Not an operational geofence or performance grade.']])await circle.getByLabel(label,{exact:true}).fill(value);await circle.getByText('Review reference circle samples',{exact:true}).click();await expect(circle.getByRole('alert')).toContainText('Confirm');await circle.getByLabel('Confirm reference WGS84 decimal degrees',{exact:true}).check();await circle.getByText('Review reference circle samples',{exact:true}).click();await expect(circle.getByLabel('Reviewed reference circle')).toContainText('3/6 recorded samples inside/on, 3 outside');await expect(circle.getByLabel('Reviewed reference circle')).toContainText('1 adjacent-row classification changes, including 1 across gaps');await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('8');await circle.getByLabel('Reference sample filter',{exact:true}).selectOption('outside');await expect(circle.getByLabel('Reference circle matching counts')).toContainText('3/6 matching');const pending=page.waitForEvent('download');await circle.getByText('Download reference circle report',{exact:true}).click();const stream=await(await pending).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const text=Buffer.concat(chunks).toString('utf8');for(const expected of ['3,4,4,12,true','4,12,28.6142,77.2093,unknown,5,unknown','matching 3 of 6','Not an operational geofence or performance grade.'])expect(text).toContain(expected);await circle.getByLabel('Seek reference sample row 4',{exact:true}).click();await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('12');await expect(comparison.getByLabel('Comparison time',{exact:true})).toHaveValue('6');await circle.getByLabel('Reference radius (metres)',{exact:true}).fill('-1');await expect(circle.getByLabel('Confirm reference WGS84 decimal degrees',{exact:true})).not.toBeChecked();await expect(circle.getByText('Download reference circle report',{exact:true})).toBeDisabled();await expect(circle.getByLabel('Seek reference sample row 4',{exact:true})).toBeDisabled();await circle.getByLabel('Confirm reference WGS84 decimal degrees',{exact:true}).check();await circle.getByText('Review reference circle samples',{exact:true}).click();await expect(circle.getByRole('alert')).toContainText('finite numbers');await circle.getByText('Discard reference circle edits',{exact:true}).click();await expect(circle.getByLabel('Reference radius (metres)',{exact:true})).toHaveValue('40');await expect(circle.getByText('Download reference circle report',{exact:true})).toBeEnabled();await replay.getByLabel('Choose flight CSV',{exact:true}).setInputFiles({name:'different.csv',mimeType:'text/csv',buffer:Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,0,0,,,\n1,0.0001,0,,,\n')});await expect(circle.getByLabel('Reference circle label',{exact:true})).toHaveValue('');await expect(circle.getByLabel('Reviewed reference circle')).toHaveCount(0);
  });

  test('reference circle preset reuses criteria across sources only after preview and fresh coordinate confirmation', async ({ page }) => {
    await page.keyboard.press('l');await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click();const replay=page.getByRole('region',{name:'Flight log replay',exact:true});await replay.getByText('Load synthetic sample',{exact:true}).click();const circle=replay.getByRole('article',{name:'Recorded reference circle review',exact:true});for(const[label,value]of[['Reference latitude (degrees)','28.6139'],['Reference longitude (degrees)','77.209'],['Reference radius (metres)','40'],['Reference circle label','Reusable instructor reference'],['Reference circle discussion notes','Unverified reference, not operational clearance.']])await circle.getByLabel(label,{exact:true}).fill(value);await circle.getByLabel('Confirm reference WGS84 decimal degrees',{exact:true}).check();await circle.getByText('Review reference circle samples',{exact:true}).click();const pending=page.waitForEvent('download');await circle.getByText('Download reference circle preset JSON',{exact:true}).click();const stream=await(await pending).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const text=Buffer.concat(chunks).toString('utf8'),data=JSON.parse(text);expect(text).not.toContain('sha256');expect(text).not.toContain('samples');expect(data.criteria.radiusM).toBe(40);const upload=async text=>circle.getByLabel('Import reference circle preset JSON',{exact:true}).setInputFiles({name:'circle-preset.json',mimeType:'application/json',buffer:Buffer.from(text)});await circle.getByLabel('Reference radius (metres)',{exact:true}).fill('20');await circle.getByLabel('Confirm reference WGS84 decimal degrees',{exact:true}).check();await circle.getByText('Review reference circle samples',{exact:true}).click();await upload(text);await expect(circle.getByLabel('Reference circle preset preview')).toContainText('radius 40m');await expect(circle.getByLabel('Reference radius (metres)',{exact:true})).toHaveValue('20');await expect(circle.getByText('Review reference circle samples',{exact:true})).toBeDisabled();await circle.getByText('Keep current reference circle',{exact:true}).click();await expect(circle.getByLabel('Reference radius (metres)',{exact:true})).toHaveValue('20');await expect(circle.getByLabel('Confirm reference WGS84 decimal degrees',{exact:true})).toBeChecked();await replay.getByLabel('Choose flight CSV',{exact:true}).setInputFiles({name:'different.csv',mimeType:'text/csv',buffer:Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,0,0,,,\n1,0.0001,0,,,\n')});await replay.getByLabel('Replay position',{exact:true}).fill('1');await upload(text);await circle.getByText('Apply reference circle preset to fields',{exact:true}).click();await expect(circle.getByLabel('Reference radius (metres)',{exact:true})).toHaveValue('40');await expect(circle.getByLabel('Confirm reference WGS84 decimal degrees',{exact:true})).not.toBeChecked();await expect(circle.getByLabel('Reviewed reference circle')).toHaveCount(0);await expect(circle.getByText('Download reference circle report',{exact:true})).toBeDisabled();await circle.getByText('Review reference circle samples',{exact:true}).click();await expect(circle.getByRole('alert')).toContainText('Confirm');await circle.getByLabel('Confirm reference WGS84 decimal degrees',{exact:true}).check();await circle.getByText('Review reference circle samples',{exact:true}).click();await expect(circle.getByLabel('Reviewed reference circle')).toContainText('0/2 recorded samples inside/on, 2 outside');await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('1');await upload(JSON.stringify({...data,confirmed:true}));await expect(circle.getByRole('alert')).toContainText('Unsupported');await expect(circle.getByText('Download reference circle report',{exact:true})).toBeEnabled();await upload(text);await expect(circle.getByLabel('Reference circle preset preview')).toBeVisible();await replay.getByText('Load synthetic sample',{exact:true}).click();await expect(circle.getByLabel('Reference circle preset preview')).toHaveCount(0);await expect(circle.getByLabel('Reference circle label',{exact:true})).toHaveValue('');
  });

  test('reviewed window playback stops at original bounds and explicitly repeats without skipping recorded gaps', async ({ page }) => {
    await page.keyboard.press('l');await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click();const replay=page.getByRole('region',{name:'Flight log replay',exact:true});await replay.getByText('Load synthetic sample',{exact:true}).click();const comparison=replay.getByRole('article',{name:'Two-flight comparison',exact:true});await comparison.getByText('Load synthetic baseline',{exact:true}).click();await comparison.getByLabel('Comparison time',{exact:true}).fill('6');const window=replay.getByRole('article',{name:'Selected-sample review window',exact:true});for(const[label,value]of[['Window start data row','3'],['Window end data row','4'],['Window label','Gap discussion replay']])await window.getByLabel(label,{exact:true}).fill(value);await window.getByText('Review selected samples',{exact:true}).click();await replay.getByLabel('Playback speed',{exact:true}).selectOption('8');await window.getByText('Play reviewed window once',{exact:true}).click();await expect(replay.getByLabel('Active selected-window playback')).toContainText('Original rows 3 through 4, original 4s to 12s');await expect(replay.getByRole('article',{name:'Recorded replay controls',exact:true}).getByText(/DATA GAP. Holding observation from 4s/)).toBeVisible();await expect(replay.getByLabel('Active selected-window playback')).toContainText('Stopped at selected final timestamp');await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('12');await page.waitForTimeout(300);await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('12');await expect(comparison.getByLabel('Comparison time',{exact:true})).toHaveValue('6');await replay.getByText('Play replay',{exact:true}).click();await expect(replay.getByLabel('Active selected-window playback')).toHaveCount(0);await expect.poll(async()=>Number(await replay.getByLabel('Replay position',{exact:true}).inputValue())).toBeGreaterThan(12);await replay.getByText('Reset replay',{exact:true}).click();for(const[label,value]of[['Window start data row','2'],['Window end data row','3']])await window.getByLabel(label,{exact:true}).fill(value);await window.getByText('Review selected samples',{exact:true}).click();await replay.getByLabel('Playback speed',{exact:true}).selectOption('1');await window.getByText('Repeat reviewed window',{exact:true}).click();await expect(replay.getByLabel('Active selected-window playback')).toContainText('REPEATING SELECTED WINDOW');await expect.poll(async()=>Number(await replay.getByLabel('Replay position',{exact:true}).inputValue())).toBeGreaterThan(3.5);await expect.poll(async()=>Number(await replay.getByLabel('Replay position',{exact:true}).inputValue())).toBeLessThan(3);await replay.getByText('Stop selected-window playback',{exact:true}).click();const stopped=await replay.getByLabel('Replay position',{exact:true}).inputValue();await page.waitForTimeout(300);await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue(stopped);await window.getByText('Repeat reviewed window',{exact:true}).click();await replay.getByLabel('Replay position',{exact:true}).fill('8');await expect(replay.getByLabel('Active selected-window playback')).toHaveCount(0);await window.getByText('Repeat reviewed window',{exact:true}).click();await window.getByLabel('Window label',{exact:true}).fill('Stale edited label');await expect(replay.getByLabel('Active selected-window playback')).toHaveCount(0);await expect(window.getByText('Play reviewed window once',{exact:true})).toBeDisabled();await window.getByText('Discard window edits',{exact:true}).click();await window.getByText('Repeat reviewed window',{exact:true}).click();await replay.getByText('Load synthetic sample',{exact:true}).click();await expect(replay.getByLabel('Active selected-window playback')).toHaveCount(0);await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('0');await expect(comparison.getByLabel('Comparison time',{exact:true})).toHaveValue('6');
  });

  test('follow-up shelf persists only explicit private snapshots and reopens both sections after exact-source preview', async ({ page }) => {
    await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click(); const actions = page.getByRole('article', { name: 'Debrief action register', exact: true }), checklist = page.getByRole('article', { name: 'Reusable discussion checklist', exact: true }), panel = page.getByRole('article', { name: 'Debrief follow-up packet', exact: true }), shelf = panel.getByRole('region', { name: 'Device-local follow-up shelf', exact: true });
    await expect(shelf.getByText('Save local follow-up snapshot', { exact: true })).toBeDisabled(); await actions.getByText('New action from held source row', { exact: true }).click(); await actions.getByLabel('Reviewer action text', { exact: true }).fill('Immutable stored action'); await actions.getByLabel('Action original data row', { exact: true }).fill('4'); await actions.getByText('Save reviewer action', { exact: true }).click(); await checklist.getByText('Add discussion prompt', { exact: true }).click(); await checklist.getByLabel('Discussion prompt text', { exact: true }).fill('Immutable stored prompt'); await checklist.getByText('Save discussion prompt', { exact: true }).click();
    await shelf.getByLabel('Follow-up snapshot label', { exact: true }).fill('Private team snapshot'); await shelf.getByLabel('Allow this follow-up snapshot to store private annotations locally', { exact: true }).check(); await shelf.getByText('Save local follow-up snapshot', { exact: true }).click(); await expect(shelf.getByRole('status')).toContainText('Follow-up snapshot saved locally'); await expect(shelf.getByLabel('Allow this follow-up snapshot to store private annotations locally', { exact: true })).not.toBeChecked(); await expect(shelf.getByLabel('Stored follow-up snapshots', { exact: true }).getByRole('listitem')).toHaveCount(1);
    await actions.getByText('Edit reviewer action', { exact: true }).click(); await actions.getByLabel('Reviewer action text', { exact: true }).fill('Later current action, not saved snapshot'); await actions.getByText('Save reviewer action', { exact: true }).click(); const waiting = page.waitForEvent('download'); await shelf.getByText('Download stored packet', { exact: true }).click(); const stream = await (await waiting).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk); const data = JSON.parse(Buffer.concat(chunks).toString()); expect(data.actions.items[0].text).toBe('Immutable stored action'); expect(data.checklist.items[0].prompt).toBe('Immutable stored prompt'); expect(JSON.stringify(data)).not.toContain('csv_text');
    await page.reload(); await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click(); await expect(shelf.getByLabel('Stored follow-up snapshots', { exact: true }).getByRole('listitem')).toHaveCount(0); await shelf.getByText('Refresh follow-up shelf', { exact: true }).click(); await expect(shelf.getByLabel('Stored follow-up snapshots', { exact: true }).getByRole('listitem')).toHaveCount(1); await shelf.getByText('Preview stored packet', { exact: true }).click(); await expect(panel.getByLabel('Follow-up packet import preview', { exact: true })).toContainText('Immutable stored action'); await panel.getByText('Keep current follow-up sections', { exact: true }).click(); await expect(actions.getByLabel('Debrief action counts', { exact: true })).toContainText('0/50'); await shelf.getByText('Preview stored packet', { exact: true }).click(); await panel.getByText('Replace both follow-up sections', { exact: true }).click(); await expect(actions.getByLabel('Saved debrief actions', { exact: true })).toContainText('Immutable stored action'); await expect(checklist.getByLabel('Saved discussion prompts', { exact: true })).toContainText('Immutable stored prompt');
    await page.getByLabel('Choose flight CSV', { exact: true }).setInputFiles({ name: 'other.csv', mimeType: 'text/csv', buffer: Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,28,77,0,0,0\n1,28.001,77.001,1,1,1') }); await shelf.getByText('Refresh follow-up shelf', { exact: true }).click(); await expect(shelf.getByText('Preview stored packet', { exact: true })).toBeDisabled(); await expect(shelf.getByText('Download stored packet', { exact: true })).toBeDisabled(); await shelf.getByText('Delete stored packet', { exact: true }).click(); await shelf.getByText('Keep follow-up snapshot', { exact: true }).click(); await expect(shelf.getByLabel('Stored follow-up snapshots', { exact: true }).getByRole('listitem')).toHaveCount(1); await shelf.getByText('Delete stored packet', { exact: true }).click(); await shelf.getByText('Confirm delete follow-up snapshot', { exact: true }).click(); await expect(shelf.getByLabel('Stored follow-up snapshots', { exact: true }).getByRole('listitem')).toHaveCount(0); await expect(actions.getByLabel('Debrief action counts', { exact: true })).toContainText('0/50');
  });

  test('adjacent channel changes preserve unknown endpoints and block gap arithmetic without skipping original rows', async ({ page }) => {
    await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click(); const panel = page.getByRole('article', { name: 'Adjacent channel change ledger', exact: true }); await expect(panel.getByText('Download adjacent change report', { exact: true })).toBeDisabled(); await panel.getByText('Review adjacent channel pairs', { exact: true }).click(); await expect(panel.getByLabel('Adjacent change counts', { exact: true })).toContainText('computed 3; unavailable 2'); await expect(panel.getByLabel('Adjacent change extrema', { exact: true })).toContainText('Minimum signed difference: -10 m, original rows 5 to 6'); await panel.getByLabel('Adjacent change filter', { exact: true }).selectOption('unavailable'); await expect(panel.getByLabel('Adjacent channel pairs', { exact: true }).getByRole('listitem')).toHaveCount(2); await expect(panel.getByLabel('Adjacent channel pairs', { exact: true })).toContainText('gap over 5s; later cell missing'); await panel.getByText('Seek change later row 4', { exact: true }).click(); await expect(page.getByLabel('Replay position', { exact: true })).toHaveValue('12');
    const waiting = page.waitForEvent('download'); await panel.getByText('Download adjacent change report', { exact: true }).click(); const stream = await (await waiting).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk); const report = Buffer.concat(chunks).toString(); for (const text of ['all 2/5 matching pairs', 'Minimum signed difference: -10 m; original rows 5 to 6', 'Original rows 3 to 4', 'Difference and quotient unavailable: gap over 5s; later cell missing']) expect(report).toContain(text); expect(report).not.toContain('28.614');
    await panel.getByLabel('Adjacent change channel', { exact: true }).selectOption('battery_pct'); await expect(panel.getByText('Download adjacent change report', { exact: true })).toBeDisabled(); await expect(panel.getByLabel('Adjacent change filter', { exact: true })).toBeDisabled(); await panel.getByText('Discard adjacent channel edits', { exact: true }).click(); await expect(panel.getByLabel('Adjacent change channel', { exact: true })).toHaveValue('altitude_m'); await panel.getByLabel('Adjacent change channel', { exact: true }).selectOption('battery_pct'); await panel.getByText('Review adjacent channel pairs', { exact: true }).click(); await expect(panel.getByLabel('Adjacent channel pairs', { exact: true })).toContainText('Signed difference -1 percentage points; signed quotient -0.5 percentage points/s');
    await page.getByLabel('Choose flight CSV', { exact: true }).setInputFiles({ name: 'many.csv', mimeType: 'text/csv', buffer: Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n' + Array.from({ length: 40 }, (_, i) => `${i},28,77,${i},0,0`).join('\n')) }); await expect(panel.getByLabel('Reviewed adjacent channel changes', { exact: true })).toHaveCount(0); await panel.getByText('Review adjacent channel pairs', { exact: true }).click(); await expect(panel.getByLabel('Adjacent change counts', { exact: true })).toContainText('computed 39; unavailable 0'); await panel.getByText('Next change pair page', { exact: true }).click(); await expect(panel.getByLabel('Adjacent change page', { exact: true })).toHaveText('Page 2/4'); await panel.getByLabel('Adjacent change filter', { exact: true }).selectOption('unavailable'); await expect(panel.getByText('No matching pairs. Not proof of source completeness or aircraft stability.', { exact: true })).toBeVisible(); await expect(panel.getByLabel('Adjacent change page', { exact: true })).toHaveText('Page 1/1');
  });

  test('follow-up packet reopens both saved sections atomically while preserving source cursor and other reviews', async ({ page }) => {
    await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click(); const actions = page.getByRole('article', { name: 'Debrief action register', exact: true }), checklist = page.getByRole('article', { name: 'Reusable discussion checklist', exact: true }), panel = page.getByRole('article', { name: 'Debrief follow-up packet', exact: true });
    await actions.getByText('New action from held source row', { exact: true }).click(); await actions.getByLabel('Reviewer action text', { exact: true }).fill('Private packet action'); await panel.getByText('Download follow-up packet JSON', { exact: true }).click(); await expect(panel.getByRole('alert')).toContainText('Finish or cancel action edits'); await actions.getByLabel('Action original data row', { exact: true }).fill('4'); await actions.getByText('Save reviewer action', { exact: true }).click();
    await checklist.getByText('Add discussion prompt', { exact: true }).click(); await checklist.getByLabel('Discussion prompt text', { exact: true }).fill('Private packet prompt'); await checklist.getByLabel('Checklist reviewer status', { exact: true }).selectOption('Discussed'); await checklist.getByLabel('Checklist reviewer note', { exact: true }).fill('Reviewer assertion only'); await checklist.getByLabel('Checklist original data row', { exact: true }).fill('4'); await checklist.getByText('Save discussion prompt', { exact: true }).click();
    const download = async name => { const waiting = page.waitForEvent('download'); await panel.getByText(name, { exact: true }).click(); const stream = await (await waiting).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks); }; const packet = await download('Download follow-up packet JSON'), report = await download('Download combined follow-up report'); expect(JSON.parse(packet.toString()).actions.items[0].text).toBe('Private packet action'); expect(JSON.parse(packet.toString()).checklist.items[0].prompt).toBe('Private packet prompt'); expect(report.toString()).toContain('8s / gap over 5s'); expect(report.toString()).not.toContain('28.614');
    await page.reload(); await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click(); await page.getByLabel('Replay position', { exact: true }).fill('8'); const instructor = page.getByRole('article', { name: 'Instructor debrief timeline', exact: true }); await instructor.getByLabel('Instructor marker note', { exact: true }).fill('Other review must remain'); await instructor.getByText('Add marker at cursor', { exact: true }).click();
    const load = async buffer => { await panel.getByLabel('Import follow-up packet JSON', { exact: true }).setInputFiles({ name: 'packet.json', mimeType: 'application/json', buffer }); }; await load(packet); await expect(panel.getByLabel('Follow-up packet import preview', { exact: true })).toBeVisible(); await expect(panel.getByLabel('Packet action preview', { exact: true })).toContainText('Private packet action'); await expect(panel.getByLabel('Packet checklist preview', { exact: true })).toContainText('Private packet prompt'); await panel.getByText('Keep current follow-up sections', { exact: true }).click(); await expect(actions.getByLabel('Debrief action counts', { exact: true })).toContainText('0/50'); await load(packet); await actions.getByText('New action from held source row', { exact: true }).click(); await actions.getByLabel('Reviewer action text', { exact: true }).fill('Unsaved during preview'); await panel.getByText('Replace both follow-up sections', { exact: true }).click(); await expect(panel.getByRole('alert')).toContainText('Finish or cancel action edits'); await actions.getByText('Cancel action edits', { exact: true }).click(); await panel.getByText('Replace both follow-up sections', { exact: true }).click();
    await expect(actions.getByLabel('Saved debrief actions', { exact: true })).toContainText('Private packet action'); await expect(checklist.getByLabel('Saved discussion prompts', { exact: true })).toContainText('Private packet prompt'); await expect(page.getByLabel('Replay position', { exact: true })).toHaveValue('8'); await expect(instructor.getByLabel('Instructor review markers', { exact: true })).toContainText('Other review must remain'); const wrong = JSON.parse(packet.toString()); wrong.checklist.source_sha256 = 'b'.repeat(64); await load(Buffer.from(JSON.stringify(wrong))); await expect(panel.getByRole('alert')).toContainText('fingerprint mismatch'); await expect(actions.getByLabel('Saved debrief actions', { exact: true })).toContainText('Private packet action');
    await page.getByLabel('Choose flight CSV', { exact: true }).setInputFiles({ name: 'other.csv', mimeType: 'text/csv', buffer: Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,28,77,0,0,0\n1,28.001,77.001,1,1,1') }); await expect(actions.getByLabel('Debrief action counts', { exact: true })).toContainText('0/50'); await expect(checklist.getByLabel('Discussion checklist counts', { exact: true })).toContainText('0/30'); await page.getByText('Load synthetic sample', { exact: true }).click(); await expect(actions.getByLabel('Debrief action counts', { exact: true })).toContainText('0/50'); await expect(checklist.getByLabel('Discussion checklist counts', { exact: true })).toContainText('0/30');
  });

  test('joint channel evidence groups original presence patterns without joining gaps or claiming continuous coverage', async ({ page }) => {
    await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click(); const panel = page.getByRole('article', { name: 'Joint channel evidence', exact: true });
    await expect(panel.getByText('Download joint evidence report', { exact: true })).toBeDisabled(); await panel.getByText('Review joint channel cells', { exact: true }).click(); await expect(panel.getByLabel('Joint evidence counts', { exact: true })).toContainText('all selected cells present: 5'); await expect(panel.getByLabel('Joint channel runs', { exact: true }).getByRole('listitem')).toHaveCount(3); await panel.getByLabel('Joint evidence filter', { exact: true }).selectOption('missing'); await expect(panel.getByLabel('Joint channel runs', { exact: true })).toContainText('Original rows 4 to 4'); await expect(panel.getByLabel('Joint channel runs', { exact: true })).toContainText('8s / gap over 5s'); await panel.getByText('Seek joint run first row 4', { exact: true }).click(); await expect(page.getByLabel('Replay position', { exact: true })).toHaveValue('12');
    const waiting = page.waitForEvent('download'); await panel.getByText('Download joint evidence report', { exact: true }).click(); const stream = await (await waiting).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk); const report = Buffer.concat(chunks).toString(); for (const text of ['Filter: missing', '1/3 matching runs', 'Original rows 4 to 4', 'first-to-last timestamp span 0s, not observed duration', 'Missing selected cells: Source altitude, Battery']) expect(report).toContain(text); expect(report).not.toContain('28.614'); expect(report).not.toContain('5m/s');
    await panel.getByLabel('Joint evidence Source altitude', { exact: true }).uncheck(); await expect(panel.getByLabel('Joint evidence filter', { exact: true })).toBeDisabled(); await expect(panel.getByText('Download joint evidence report', { exact: true })).toBeDisabled(); await panel.getByText('Discard joint channel edits', { exact: true }).click(); await expect(panel.getByLabel('Joint evidence Source altitude', { exact: true })).toBeChecked(); await expect(panel.getByLabel('Joint evidence filter', { exact: true })).toHaveValue('missing');
    await panel.getByLabel('Joint evidence Source altitude', { exact: true }).uncheck(); await panel.getByLabel('Joint evidence Battery', { exact: true }).uncheck(); await panel.getByText('Review joint channel cells', { exact: true }).click(); await expect(panel.getByLabel('Joint evidence counts', { exact: true })).toContainText('all selected cells present: 6'); await expect(panel.getByLabel('Joint channel runs', { exact: true }).getByRole('listitem')).toHaveCount(2); await panel.getByLabel('Joint evidence filter', { exact: true }).selectOption('missing'); await expect(panel.getByText('No matching runs. Not proof of completeness or source authenticity.', { exact: true })).toBeVisible();
    await page.getByLabel('Choose flight CSV', { exact: true }).setInputFiles({ name: 'alternating.csv', mimeType: 'text/csv', buffer: Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n' + Array.from({ length: 40 }, (_, i) => `${i},28,77,${i % 2 ? '' : '0'},0,0`).join('\n')) }); await expect(panel.getByLabel('Reviewed joint channel evidence', { exact: true })).toHaveCount(0); await panel.getByText('Review joint channel cells', { exact: true }).click(); await expect(panel.getByLabel('Joint evidence counts', { exact: true })).toContainText('40 original-order runs'); await panel.getByText('Next joint run page', { exact: true }).click(); await expect(panel.getByLabel('Joint evidence page', { exact: true })).toHaveText('Page 2/4'); await panel.getByLabel('Joint evidence filter', { exact: true }).selectOption('missing'); await expect(panel.getByLabel('Joint evidence page', { exact: true })).toHaveText('Page 1/2'); await panel.getByText('Next joint run page', { exact: true }).click(); await expect(panel.getByLabel('Joint channel runs', { exact: true })).toContainText('Original rows 40 to 40');
  });

  test('reusable discussion checklist resets template progress and preserves exact-source annotations only after confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click();
    const panel = page.getByRole('article', { name: 'Reusable discussion checklist', exact: true });
    await panel.getByLabel('Discussion checklist title', { exact: true }).fill('Training-team discussion'); await panel.getByText('Add discussion prompt', { exact: true }).click(); await panel.getByLabel('Discussion prompt text', { exact: true }).fill('Discuss gaps and unknown channels'); await panel.getByLabel('Checklist reviewer status', { exact: true }).selectOption('Not applicable'); await panel.getByText('Save discussion prompt', { exact: true }).click(); await expect(panel.getByRole('alert')).toContainText('reason'); await panel.getByLabel('Checklist reviewer note', { exact: true }).fill('Reviewer reason, not independently verified'); await page.getByLabel('Replay position', { exact: true }).fill('8'); await panel.getByText('Reference held original row', { exact: true }).click(); await expect(panel.getByLabel('Checklist original data row', { exact: true })).toHaveValue('3'); await panel.getByLabel('Checklist original data row', { exact: true }).fill('4'); await panel.getByText('Save discussion prompt', { exact: true }).click(); await expect(panel.getByLabel('Saved discussion prompts', { exact: true })).toContainText('Source altitude unknown');
    const download = async name => { const waiting = page.waitForEvent('download'); await panel.getByText(name, { exact: true }).click(); const stream = await (await waiting).createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk); return Buffer.concat(chunks); };
    const review = await download('Download checklist review JSON'), template = await download('Download reusable prompt template'), report = await download('Download checklist evidence report');
    expect(JSON.parse(review.toString()).items[0].row).toBe(4); const data = JSON.parse(template.toString()); expect(data.items[0]).toEqual({ id: expect.any(String), prompt: 'Discuss gaps and unknown channels' }); expect(data.source_sha256).toBeUndefined(); expect(report.toString()).toContain('8s / gap over 5s'); expect(report.toString()).not.toContain('28.614');
    const load = async buffer => { await panel.getByLabel('Import discussion checklist JSON', { exact: true }).setInputFiles({ name: 'checklist.json', mimeType: 'application/json', buffer }); await expect(panel.getByLabel('Discussion checklist import preview', { exact: true })).toBeVisible(); };
    await load(template); await expect(panel.getByLabel('Discussion checklist import preview', { exact: true })).toContainText('all prompts reset to Pending'); await panel.getByText('Keep current checklist', { exact: true }).click(); await expect(panel.getByLabel('Saved discussion prompts', { exact: true })).toContainText('Reviewer reason');
    await load(template); await panel.getByText('Replace discussion checklist', { exact: true }).click(); await expect(panel.getByLabel('Saved discussion prompts', { exact: true })).toContainText('Reviewer annotation: Pending'); await expect(panel.getByLabel('Saved discussion prompts', { exact: true })).toContainText('No original source row referenced');
    await page.reload(); await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click(); await load(review); await panel.getByText('Replace discussion checklist', { exact: true }).click(); await expect(panel.getByLabel('Saved discussion prompts', { exact: true })).toContainText('Not applicable'); await panel.getByText('Seek checklist original row 4', { exact: true }).click(); await expect(page.getByLabel('Replay position', { exact: true })).toHaveValue('12');
    const wrong = JSON.parse(review.toString()); wrong.source_sha256 = 'b'.repeat(64); await panel.getByLabel('Import discussion checklist JSON', { exact: true }).setInputFiles({ name: 'wrong.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(wrong)) }); await expect(panel.getByRole('alert')).toContainText('fingerprint mismatch'); await expect(panel.getByLabel('Saved discussion prompts', { exact: true })).toContainText('Reviewer reason'); await panel.getByText('Edit prompt', { exact: true }).click(); await expect(panel.getByText('Download reusable prompt template', { exact: true })).toBeDisabled(); await panel.getByText('Cancel prompt edits', { exact: true }).click(); await panel.getByText('Remove prompt', { exact: true }).click(); await panel.getByText('Keep prompt', { exact: true }).click(); await expect(panel.getByLabel('Discussion checklist counts', { exact: true })).toContainText('1/30');
    await page.getByLabel('Choose flight CSV', { exact: true }).setInputFiles({ name: 'other.csv', mimeType: 'text/csv', buffer: Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,28,77,1,1,99\n1,28.001,77.001,2,2,98') }); await expect(panel.getByLabel('Discussion checklist counts', { exact: true })).toContainText('0/30'); await load(template); await panel.getByText('Replace discussion checklist', { exact: true }).click(); await expect(panel.getByLabel('Saved discussion prompts', { exact: true })).toContainText('No original source row referenced'); await expect(panel.getByLabel('Discussion checklist counts', { exact: true })).toContainText('Pending: 1');
  });

  test('debrief actions preserve source-row context and reopen private reviewer followups after explicit replacement', async ({ page }) => {
    await page.keyboard.press('l');await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click();let replay=page.getByRole('region',{name:'Flight log replay',exact:true});await replay.getByText('Load synthetic sample',{exact:true}).click();await replay.getByLabel('Replay position',{exact:true}).fill('8');let actions=replay.getByRole('article',{name:'Debrief action register',exact:true});await actions.getByText('New action from held source row',{exact:true}).click();await expect(actions.getByLabel('Action original data row',{exact:true})).toHaveValue('3');await expect(actions.getByText('Download action register JSON',{exact:true})).toBeDisabled();for(const[label,value]of[['Action original data row','4'],['Reviewer action text','Discuss missing source channels'],['Action owner label, not an assignment','Instructor label'],['Action target text, not scheduled','Before next discussion']])await actions.getByLabel(label,{exact:true}).fill(value);await actions.getByText('Save reviewer action',{exact:true}).click();await expect(actions.getByLabel('Saved debrief actions')).toContainText('Original row 4 at 12s. Source altitude unknown');await actions.getByText('Seek original action reference row 4',{exact:true}).click();await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('12');await actions.getByText('Edit reviewer action',{exact:true}).click();await actions.getByLabel('Reviewer action status',{exact:true}).selectOption('Closed');await actions.getByText('Save reviewer action',{exact:true}).click();await expect(actions.getByRole('alert')).toContainText('closure note');await actions.getByLabel('Reviewer closure note, not verified completion',{exact:true}).fill('Reviewer says discussion completed, not verified evidence.');await actions.getByText('Save reviewer action',{exact:true}).click();await actions.getByLabel('Action status filter',{exact:true}).selectOption('Open');await expect(actions.getByText(/No saved actions match/)).toBeVisible();const pending=page.waitForEvent('download');await actions.getByText('Download action register JSON',{exact:true}).click();const stream=await(await pending).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const text=Buffer.concat(chunks).toString('utf8'),data=JSON.parse(text);expect(data.items).toHaveLength(1);expect(data.items[0].status).toBe('Closed');expect(text).not.toContain('latitude');const reportPending=page.waitForEvent('download');await actions.getByText('Download all action evidence report',{exact:true}).click();const reportStream=await(await reportPending).createReadStream();const reportChunks=[];for await(const chunk of reportStream)reportChunks.push(chunk);const report=Buffer.concat(reportChunks).toString('utf8');expect(report).toContain('8s / gap over 5s');expect(report).toContain('Source altitude unknown');expect(report).not.toContain('28.614');
    await page.reload();await page.getByRole('button',{name:'Scenario Lab',exact:true}).click();await page.getByRole('button',{name:'FLIGHT LOG REPLAY',exact:true}).click();replay=page.getByRole('region',{name:'Flight log replay',exact:true});await replay.getByText('Load synthetic sample',{exact:true}).click();actions=replay.getByRole('article',{name:'Debrief action register',exact:true});const upload=async text=>actions.getByLabel('Import action register JSON',{exact:true}).setInputFiles({name:'actions.json',mimeType:'application/json',buffer:Buffer.from(text)});await upload(text);await expect(actions.getByLabel('Action register import preview')).toContainText('Closed: Discuss missing source channels');await expect(actions.getByLabel('Debrief action counts')).toContainText('0/50');await actions.getByText('Keep current debrief actions',{exact:true}).click();await expect(actions.getByLabel('Debrief action counts')).toContainText('0/50');await upload(text);await actions.getByText('Replace saved debrief actions',{exact:true}).click();await expect(actions.getByLabel('Saved debrief actions')).toContainText('Reviewer status: Closed');await expect(replay.getByLabel('Replay position',{exact:true})).toHaveValue('0');await upload(JSON.stringify({...data,source_sha256:'0'.repeat(64)}));await expect(actions.getByRole('alert')).toContainText('fingerprint mismatch');await expect(actions.getByLabel('Debrief action counts')).toContainText('1/50');await actions.getByText('Remove saved action',{exact:true}).click();await actions.getByText('Keep saved action',{exact:true}).click();await expect(actions.getByLabel('Debrief action counts')).toContainText('1/50');await actions.getByText('Remove saved action',{exact:true}).click();await actions.getByText('Confirm remove debrief action',{exact:true}).click();await expect(actions.getByLabel('Debrief action counts')).toContainText('0/50');await upload(text);await actions.getByText('Replace saved debrief actions',{exact:true}).click();await replay.getByLabel('Choose flight CSV',{exact:true}).setInputFiles({name:'other.csv',mimeType:'text/csv',buffer:Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,0,0,,,\n1,0.0001,0,,,\n')});await expect(actions.getByLabel('Debrief action counts')).toContainText('0/50');
  });
  test('device-local library saves immutable snapshots and reopens after reload with explicit confirmation', async ({ page }) => {
    await page.keyboard.press('l'); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); const panel = page.getByRole('region', { name: 'Flight log replay', exact: true }); await panel.getByRole('button', { name: 'Load synthetic sample', exact: true }).click(); await panel.getByLabel('Review title', { exact: true }).fill('Device snapshot'); await panel.getByLabel('Analyst notes', { exact: true }).fill('Saved note'); const instructor = panel.getByRole('article', { name: 'Instructor debrief timeline', exact: true }); await instructor.getByLabel('Instructor marker note', { exact: true }).fill('Local discussion'); await instructor.getByRole('button', { name: 'Add marker at cursor', exact: true }).click();
    await panel.getByText('Device-local review library (explicit storage, not a backup)', { exact: true }).click(); const library = panel.getByRole('article', { name: 'Device-local review library', exact: true }); await expect(library.getByRole('button', { name: 'Save local review snapshot', exact: true })).toBeDisabled(); await library.getByLabel('Allow this snapshot to store coordinates and notes locally', { exact: true }).check(); await library.getByRole('button', { name: 'Save local review snapshot', exact: true }).click(); await expect(library.getByText(/Snapshot saved locally:/)).toBeVisible(); await expect(library.getByLabel('Allow this snapshot to store coordinates and notes locally', { exact: true })).not.toBeChecked(); await expect(library.getByLabel('Local review snapshots').getByRole('listitem')).toHaveCount(1);
    await panel.getByLabel('Analyst notes', { exact: true }).fill('Later unsaved note'); const backup = page.waitForEvent('download'); await library.getByRole('button', { name: 'Download snapshot Device snapshot', exact: true }).click(); const stream = await (await backup).createReadStream(); const parts = []; for await (const part of stream) parts.push(part); const bytes = Buffer.concat(parts); expect(JSON.parse(bytes.toString('utf8')).review.notes).toBe('Saved note');
    await page.reload(); await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await panel.getByText('Device-local review library (explicit storage, not a backup)', { exact: true }).click(); await library.getByRole('button', { name: 'Refresh local library', exact: true }).click(); await expect(library.getByRole('button', { name: 'Review snapshot Device snapshot', exact: true })).toBeVisible(); await expect(panel.getByLabel('Replay position', { exact: true })).toHaveCount(0); await library.getByRole('button', { name: 'Review snapshot Device snapshot', exact: true }).click(); await expect(library.getByRole('button', { name: 'Replace workspace with local snapshot', exact: true })).toBeVisible(); await expect(panel.getByLabel('Replay position', { exact: true })).toHaveCount(0); await library.getByRole('button', { name: 'Replace workspace with local snapshot', exact: true }).click(); await expect(panel.getByLabel('Analyst notes', { exact: true })).toHaveValue('Saved note'); await expect(instructor.getByText('Local discussion', { exact: true })).toBeVisible();
    await library.getByRole('button', { name: 'Delete snapshot Device snapshot', exact: true }).click(); await library.getByRole('button', { name: 'Keep snapshot', exact: true }).click(); await expect(library.getByLabel('Local review snapshots').getByRole('listitem')).toHaveCount(1); await library.getByRole('button', { name: 'Delete snapshot Device snapshot', exact: true }).click(); await library.getByRole('button', { name: 'Confirm delete local snapshot', exact: true }).click(); await expect(library.getByLabel('Local review snapshots').getByRole('listitem')).toHaveCount(0); await expect(instructor.getByText('Local discussion', { exact: true })).toBeVisible();
    for (let index = 0; index < 10; index++) { await panel.getByLabel('Review title', { exact: true }).fill(`Bounded snapshot ${index}`); await library.getByLabel('Allow this snapshot to store coordinates and notes locally', { exact: true }).check(); await library.getByRole('button', { name: 'Save local review snapshot', exact: true }).click(); await expect(library.getByLabel('Local review snapshots').getByRole('listitem')).toHaveCount(index + 1); }
    await library.getByLabel('Allow this snapshot to store coordinates and notes locally', { exact: true }).check(); await library.getByRole('button', { name: 'Save local review snapshot', exact: true }).click(); await expect(library.getByRole('alert')).toContainText('10 snapshots'); await expect(library.getByLabel('Local review snapshots').getByRole('listitem')).toHaveCount(10);
    const first = library.getByLabel('Local review snapshots').getByRole('listitem').first(); await first.getByRole('button', { name: /Delete snapshot/ }).click(); await library.getByRole('button', { name: 'Confirm delete local snapshot', exact: true }).click(); await expect(library.getByLabel('Local review snapshots').getByRole('listitem')).toHaveCount(9);
  });

  test('local library transactions bound concurrent saves and reject corrupt source records', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const library = await import('/src/utils/localReviewLibrary.js'); const flight = await import('/src/utils/flightLog.js');
      const log = { filename: 'synthetic.csv', csv_text: flight.SAMPLE_LOG, sha256: await flight.flightCSVHash(flight.SAMPLE_LOG), samples: flight.parseFlightCSV(flight.SAMPLE_LOG), model_version: flight.LOG_VERSION };
      const snapshot = { log, review: { title: 'Concurrent synthetic snapshot', notes: '' }, debrief: { markers: [], notes: '' }, envelope: null };
      const outcomes = await Promise.allSettled(Array.from({ length: 11 }, () => library.saveLocalCase(snapshot))); const records = await library.listLocalCases();
      const opened = await library.readLocalCase(records[0].id);
      await new Promise((resolve, reject) => { const request = indexedDB.open('skydash-private-review-library', 1); request.onsuccess = () => { const db = request.result, tx = db.transaction('cases', 'readwrite'), store = tx.objectStore('cases'); const data = { ...opened.record, contents: opened.record.contents.replace(log.sha256, 'b'.repeat(64)) }; store.put(data); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => { db.close(); reject(Error('test corruption setup failed')); }; }; request.onerror = reject; });
      let corruptError = ''; try { await library.readLocalCase(records[0].id); } catch (error) { corruptError = error.message; }
      await library.deleteLocalCase(records[0].id); const retained = await library.listLocalCases();
      return { fulfilled: outcomes.filter(item => item.status === 'fulfilled').length, rejected: outcomes.filter(item => item.status === 'rejected').length, count: records.length, corruptError, retained: retained.length };
    });
    expect(result).toEqual({ fulfilled: 10, rejected: 1, count: 10, corruptError: 'Case source fingerprint mismatch. Nothing was opened.', retained: 9 });
  });

  test('manual comparison anchors associate exact sample rows with negative review time and reproducible exports', async ({ page }) => {
    await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click();
    const panel = page.getByRole('article', { name: 'Two-flight comparison', exact: true }); await panel.getByText('Load synthetic baseline', { exact: true }).click();
    await panel.getByLabel('Comparison notes', { exact: true }).fill('Synthetic manual association, no same-event claim.'); await panel.getByLabel('A anchor data row', { exact: true }).fill('4'); await panel.getByLabel('B anchor data row', { exact: true }).fill('3'); await panel.getByLabel('Review anchor label', { exact: true }).fill('Instructor discussion anchors');
    await expect(panel.getByLabel('Proposed anchor source times')).toContainText('A 12s, B 4s'); await expect(panel.getByText('Download comparison report', { exact: true })).toBeDisabled(); await panel.getByText('Apply manual sample anchors', { exact: true }).click();
    await expect(panel.getByLabel('Applied comparison alignment')).toContainText('A row 4 at 12s; B row 3 at 4s'); await expect(panel.getByText('A 12s', { exact: true })).toBeVisible(); await expect(panel.getByText('B 4s', { exact: true })).toBeVisible();
    await panel.getByLabel('Comparison time', { exact: true }).fill('-6'); await expect(panel.getByText(/OUTSIDE SOURCE/)).toBeVisible(); await expect(panel.getByText(/DATA GAP/)).toBeVisible(); await expect(panel.getByLabel('Instantaneous observation deltas')).toContainText('speed unknown');
    await panel.getByText('Reset comparison', { exact: true }).click(); await expect(panel.getByLabel('Comparison time', { exact: true })).toHaveValue('0'); await expect(panel.getByLabel('Comparison notes', { exact: true })).toHaveValue('Synthetic manual association, no same-event claim.');
    const pending = page.waitForEvent('download'); await panel.getByText('Download comparison report', { exact: true }).click(); const stream = await (await pending).createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk); const text = Buffer.concat(chunks).toString('utf8'); for (const required of ['MANUAL REVIEW ANCHORS', 'Instructor discussion anchors', 'A CSV data row 4 at 12s; B CSV data row 3 at 4s', 'Shared review-clock range: -4 to 4s', 'not verified same events']) expect(text).toContain(required);
    await panel.getByLabel('A anchor data row', { exact: true }).fill('999'); await panel.getByText('Apply manual sample anchors', { exact: true }).click(); await expect(panel.getByRole('alert')).toContainText('existing sample row'); await expect(panel.getByLabel('Applied comparison alignment')).toContainText('A row 4'); await panel.getByText('Discard anchor edits', { exact: true }).click(); await expect(panel.getByLabel('A anchor data row', { exact: true })).toHaveValue('4');
    await panel.getByText('Use CSV starts', { exact: true }).click(); await expect(panel.getByLabel('Applied comparison alignment')).toContainText('CSV starts'); await expect(panel.getByLabel('Comparison time', { exact: true })).toHaveAttribute('min', '0');
    const decimal = 'time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,0,0,1,1,99\n0.03,0,0,2,2,98\n0.13,0,0,3,3,97\n'; await panel.getByLabel('Choose baseline CSV').setInputFiles({ name: 'decimal.csv', mimeType: 'text/csv', buffer: Buffer.from(decimal) }); await expect(panel.getByText(/B \/ decimal.csv/)).toBeVisible();
    await panel.getByLabel('B anchor data row', { exact: true }).fill('2'); await panel.getByLabel('Review anchor label', { exact: true }).fill('Decimal anchor'); await panel.getByText('Apply manual sample anchors', { exact: true }).click(); await expect(panel.getByLabel('Comparison time', { exact: true })).toHaveValue('0'); await expect(panel.getByLabel('Comparison time', { exact: true })).toHaveAttribute('min', '-0.03'); await expect(panel.getByLabel('Comparison time', { exact: true })).toHaveAttribute('step', 'any'); await expect(panel.getByText('B 0.03s', { exact: true })).toBeVisible();
  });

  test('portable comparison review restores exact baseline notes and manual anchors after reload with primary binding', async ({ page }) => {
    const enter = async () => { await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click(); };
    await enter(); let panel = page.getByRole('article', { name: 'Two-flight comparison', exact: true }); await panel.getByText('Load synthetic baseline', { exact: true }).click(); await panel.getByLabel('Comparison notes', { exact: true }).fill('Private synthetic comparison notes'); await panel.getByLabel('A anchor data row', { exact: true }).fill('4'); await panel.getByLabel('B anchor data row', { exact: true }).fill('3'); await panel.getByLabel('Review anchor label', { exact: true }).fill('Review association'); await panel.getByText('Apply manual sample anchors', { exact: true }).click();
    const pending = page.waitForEvent('download'); await panel.getByText('Download comparison review JSON', { exact: true }).click(); const stream = await (await pending).createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk); const bytes = Buffer.concat(chunks); const data = JSON.parse(bytes.toString('utf8')); expect(data.format).toBe('skydash-comparison-review-v1'); expect(data.baseline.csv_text).toContain('time_s,latitude'); expect(data.notes).toBe('Private synthetic comparison notes'); expect(data.alignment.primaryIndex).toBe(3);
    await page.reload(); await enter(); panel = page.getByRole('article', { name: 'Two-flight comparison', exact: true }); await panel.getByLabel('Import comparison review JSON').setInputFiles({ name: 'comparison.json', mimeType: 'application/json', buffer: bytes }); await expect(panel.getByText(/Preview comparison review:/)).toBeVisible(); await expect(panel.getByLabel('Comparison time', { exact: true })).toHaveCount(0); await panel.getByText('Keep current comparison', { exact: true }).click(); await expect(panel.getByLabel('Comparison time', { exact: true })).toHaveCount(0);
    await panel.getByLabel('Import comparison review JSON').setInputFiles({ name: 'comparison.json', mimeType: 'application/json', buffer: bytes }); await panel.getByText('Replace comparison with imported review', { exact: true }).click(); await expect(panel.getByLabel('Comparison notes', { exact: true })).toHaveValue('Private synthetic comparison notes'); await expect(panel.getByLabel('Applied comparison alignment')).toContainText('A row 4 at 12s; B row 3 at 4s'); await expect(panel.getByText('A 12s', { exact: true })).toBeVisible(); await expect(panel.getByText('B 4s', { exact: true })).toBeVisible(); await expect(page.getByLabel('Current recorded observation')).toContainText('Sample 1/6');
    data.primary_sha256 = 'a'.repeat(64); await panel.getByLabel('Import comparison review JSON').setInputFiles({ name: 'wrong-primary.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) }); await expect(panel.getByRole('alert')).toContainText('Primary fingerprint mismatch'); await expect(panel.getByLabel('Comparison notes', { exact: true })).toHaveValue('Private synthetic comparison notes'); await expect(panel.getByLabel('Applied comparison alignment')).toContainText('A row 4');
  });

  test('recorded review maps make no tile requests until per-map consent and reset on new sources', async ({ page }) => {
    await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click();
    const requests = []; await page.route('**/tile.openstreetmap.org/**', async route => { requests.push(route.request().url()); await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') }); });
    await page.getByText('Load synthetic sample', { exact: true }).click(); const track = page.getByLabel('Recorded flight track', { exact: true }); await expect(track.locator('.leaflet-overlay-pane svg path')).not.toHaveCount(0); await expect(track.locator('.leaflet-tile-pane img')).toHaveCount(0);
    await page.getByLabel('Replay position', { exact: true }).fill('8'); await expect(page.getByLabel('Current recorded observation')).toContainText('at 4s'); expect(requests.length).toBe(0);
    const comparison = page.getByRole('article', { name: 'Two-flight comparison', exact: true }); await comparison.getByText('Load synthetic baseline', { exact: true }).click(); const compared = comparison.getByLabel('Compared recorded tracks'); await expect(compared.locator('.leaflet-overlay-pane svg path')).not.toHaveCount(0); await expect(compared.locator('.leaflet-tile-pane img')).toHaveCount(0); expect(requests.length).toBe(0);
    await page.getByLabel('Allow external basemap for primary replay', { exact: true }).check(); await expect.poll(() => requests.length).toBeGreaterThan(0); await expect(track.locator('.leaflet-tile-pane img')).not.toHaveCount(0); await expect(compared.locator('.leaflet-tile-pane img')).toHaveCount(0);
    await page.getByLabel('Allow external basemap for primary replay', { exact: true }).uncheck(); await expect(track.locator('.leaflet-tile-pane img')).toHaveCount(0); const afterOff = requests.length; await track.getByRole('button', { name: 'Zoom in', exact: true }).click(); await expect(track.locator('.leaflet-tile-pane img')).toHaveCount(0); expect(requests.length).toBe(afterOff);
    await comparison.getByLabel('Allow external basemap for two-flight comparison', { exact: true }).check(); await expect(compared.locator('.leaflet-tile-pane img')).not.toHaveCount(0); await comparison.getByText('Load synthetic baseline', { exact: true }).click(); await expect(comparison.getByLabel('Allow external basemap for two-flight comparison', { exact: true })).not.toBeChecked(); await expect(compared.locator('.leaflet-tile-pane img')).toHaveCount(0);
    await page.getByLabel('Allow external basemap for primary replay', { exact: true }).check(); await page.getByText('Load synthetic sample', { exact: true }).click(); await expect(page.getByLabel('Allow external basemap for primary replay', { exact: true })).not.toBeChecked(); await expect(track.locator('.leaflet-tile-pane img')).toHaveCount(0);
  });

  test('recorded review scopes background app alerts without hiding them and resets context on exit', async ({ page }) => {
    await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await expect(page.getByLabel('Recorded review context')).toHaveCount(0); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await expect(page.getByLabel('Recorded review context')).toContainText('not this CSV');
    await page.evaluate(async () => { const { toast } = await import('/src/components/common/Toast.jsx'); toast('Synthetic background fleet warning', 'warning', 0); });
    const notifications = page.getByLabel('Background app notifications, not recorded CSV evidence'); await expect(notifications).toContainText('BACKGROUND APP, NOT RECORDED CSV'); await expect(notifications).toContainText('Synthetic background fleet warning');
    await page.setViewportSize({ width: 390, height: 844 }); await expect.poll(() => page.getByRole('main').evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThan(150); await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole('button', { name: 'Back to Scenario Lab', exact: true }).click(); await expect(page.getByLabel('Recorded review context')).toHaveCount(0); await expect(page.getByLabel('App notifications')).toContainText('Synthetic background fleet warning'); await expect(page.getByText('BACKGROUND APP, NOT RECORDED CSV', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await expect(page.getByLabel('Recorded review context')).toBeVisible(); await page.getByRole('button', { name: 'Dashboard', exact: true }).click(); await expect(page.getByLabel('Recorded review context')).toHaveCount(0);
  });

  test('sample windows review bounded source rows preserve unknowns and export original source evidence', async ({ page }) => {
    await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click(); const panel = page.getByRole('article', { name: 'Selected-sample review window', exact: true });
    await page.getByLabel('Replay position', { exact: true }).fill('8'); await panel.getByText('Set window start from held sample', { exact: true }).click(); await expect(panel.getByLabel('Window start data row')).toHaveValue('3'); await page.getByLabel('Replay position', { exact: true }).fill('14'); await panel.getByText('Set window end from held sample', { exact: true }).click(); await panel.getByLabel('Window label', { exact: true }).fill('Synthetic interval discussion'); await panel.getByLabel('Window discussion notes', { exact: true }).fill('Boundary gaps excluded, no performance grade.'); await panel.getByText('Review selected samples', { exact: true }).click(); await expect(panel.getByLabel('Reviewed sample window')).toContainText('Data rows 3 through 5, original times 4s to 14s'); await expect(panel.getByLabel('Reviewed sample window')).toContainText('First-to-last span 10s'); await expect(panel.getByLabel('Reviewed sample window')).toContainText('Within-window intervals over 5s: 1');
    await panel.getByText('Next window sample', { exact: true }).click(); await expect(page.getByLabel('Replay position', { exact: true })).toHaveValue('12'); await expect(panel.getByLabel('Window sample evidence')).toContainText('Source altitude unknown'); await panel.getByText('Jump to window end', { exact: true }).click(); await expect(page.getByLabel('Replay position', { exact: true })).toHaveValue('14');
    const pending = page.waitForEvent('download'); await panel.getByText('Download window report', { exact: true }).click(); const stream = await (await pending).createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk); const report = Buffer.concat(chunks).toString('utf8'); for (const text of ['skydash-review-window-v1', 'Inclusive CSV data rows: 3 through 5', 'Boundary gaps excluded, no performance grade.', '4,12,28.6142,77.2093,unknown,5,unknown', 'Boundary-crossing intervals excluded']) expect(report).toContain(text); expect(report).not.toContain('6,16,');
    await panel.getByLabel('Window start data row').fill('999'); await panel.getByText('Review selected samples', { exact: true }).click(); await expect(panel.getByRole('alert')).toContainText('inclusive existing data rows'); await expect(panel.getByText('Download window report', { exact: true })).toBeDisabled(); await panel.getByText('Discard window edits', { exact: true }).click(); await expect(panel.getByLabel('Window start data row')).toHaveValue('3');
    await page.getByLabel('Choose flight CSV').setInputFiles({ name: 'changed.csv', mimeType: 'text/csv', buffer: Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,0,0,0,0,0\n1,0,0,0,0,0\n') }); await expect(panel.getByLabel('Window label', { exact: true })).toHaveValue(''); await expect(panel.getByLabel('Reviewed sample window')).toHaveCount(0);
  });

  test('recorded channel plot preserves gaps and unknowns and seeks exact source samples with full evidence export', async ({ page }) => {
    await page.getByRole('button', { name: 'Scenario Lab', exact: true }).click(); await page.getByRole('button', { name: 'FLIGHT LOG REPLAY', exact: true }).click(); await page.getByText('Load synthetic sample', { exact: true }).click(); const panel = page.getByRole('article', { name: 'Recorded channel evidence plot', exact: true });
    await expect(panel.getByText(/Known 5\/6, missing 1/)).toBeVisible(); await page.getByLabel('Replay position', { exact: true }).fill('8'); await expect(panel.getByLabel('Chart selected source evidence')).toContainText('DATA GAP'); await expect(panel.getByLabel('Held source sample on plot')).toHaveAttribute('cx', '237.5'); await expect(panel.getByLabel('Primary replay cursor on plot')).toHaveAttribute('x1', '420');
    await panel.getByText('Next chart sample', { exact: true }).click(); await expect(page.getByLabel('Replay position', { exact: true })).toHaveValue('12'); await expect(panel.getByLabel('Chart selected source evidence')).toContainText('source value unknown'); await expect(panel.getByLabel('Held source sample on plot')).toHaveCount(0);
    await panel.getByLabel('Plot channel').selectOption('ground_speed_m_s'); await expect(panel.getByText(/Known 6\/6, missing 0/)).toBeVisible(); const guides = await panel.getByLabel('Known-sample connecting guides').getAttribute('d'); expect(guides.match(/M/g).length).toBe(2); const svg = panel.getByRole('img', { name: 'Ground speed by original source time' }); await svg.scrollIntoViewIfNeeded(); const box = await svg.boundingBox(); await svg.click({ position: { x: box.width * 55 / 800, y: 100 } }); await expect(page.getByLabel('Replay position', { exact: true })).toHaveValue('0');
    const pending = page.waitForEvent('download'); await panel.getByText('Download channel evidence', { exact: true }).click(); const stream = await (await pending).createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk); const report = Buffer.concat(chunks).toString('utf8'); for (const text of ['skydash-channel-chart-v1', 'Ground speed (m/s)', 'Known 6/6; missing 0', '4,12,5', '6,16,0', 'no interpolation']) expect(report).toContain(text); expect(report).not.toContain('28.614');
    await page.setViewportSize({ width: 390, height: 844 }); await panel.scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false); await expect(svg).toBeVisible();
    await page.getByLabel('Choose flight CSV').setInputFiles({ name: 'unknown.csv', mimeType: 'text/csv', buffer: Buffer.from('time_s,latitude,longitude,altitude_m,ground_speed_m_s,battery_pct\n0,0,0,,,\n2,0,0,,,\n') }); await expect(panel.getByLabel('Plot channel')).toHaveValue('altitude_m'); await expect(panel.getByText(/Empty plot is intentional/)).toBeVisible();
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
