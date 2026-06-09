// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8001';
const FRAME_PATH = path.join(__dirname, 'fixtures', 'frame.png');
const FRAME_BYTES = fs.readFileSync(FRAME_PATH);

const setAnalysisFile = async (page, filename = 'frame-upload.png') => {
  await page.locator('input[type="file"]').setInputFiles({
    name: filename,
    mimeType: 'image/png',
    buffer: FRAME_BYTES,
  });
};

const DETECTIONS_ANALYZE_RE = /\/api\/missions\/[^/]+\/detections\/analyze$/;
const DETECTIONS_SAMPLE_MONITOR_RE = /\/api\/missions\/[^/]+\/detections\/sample-monitor$/;
const DETECTIONS_DELETE_RE = /\/api\/missions\/[^/]+\/detections\/(?!analyze$|sample-monitor$)[^/]+$/;

const VISION_STATUS_READY = {
  success: true,
  data: {
    available: true,
    model: 'rtdetr-l.pt',
    error: null,
  },
};

const VISION_STATUS_OPTIONAL = {
  success: true,
  data: {
    available: false,
    model: 'rtdetr-l.pt',
    error: 'Vision package not installed',
  },
};

const buildDetection = (id, sourceName, labels, detections) => ({
  id,
  model: 'rtdetr-l.pt',
  source_name: sourceName,
  content_type: 'image/png',
  summary: {
    total: Object.values(labels).reduce((sum, total) => sum + total, 0),
    labels,
  },
  detections,
  created_at: new Date().toISOString(),
});

const buildDetectionResponse = (success, payload = {}, override = {}) => ({
  status: override.status || 201,
  json: {
    success,
    ...(success ? { data: payload } : { error: payload.error || 'Detection failed' }),
    ...override.json,
  },
});

const mockAnalyzeRoutes = async (page, runs = [], { onRequest, delayMs = 0 } = {}) => {
  let run = 0;
  await page.route(DETECTIONS_ANALYZE_RE, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    const current = runs[Math.min(run, runs.length - 1)] || { success: false, error: 'No analysis payload configured' };
    run += 1;
    if (typeof onRequest === 'function') {
      onRequest({ index: run, payload: current, request: route.request() });
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const response = buildDetectionResponse(
      current.success ?? true,
      current.data || {},
      {
        status: current.status || 201,
        json: current.success
          ? { success: true, data: current.data }
          : { success: false, error: current.error || 'Detection failed' },
      },
    );
    await route.fulfill({
      status: response.status || 201,
      json: response.json,
    });
  });
};

const mockSampleMonitorRoutes = async (page, runs = [], { onRequest } = {}) => {
  let run = 0;
  await page.route(DETECTIONS_SAMPLE_MONITOR_RE, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    const current = runs[Math.min(run, runs.length - 1)] || { success: false, error: 'No sample payload configured' };
    run += 1;
    if (typeof onRequest === 'function') {
      onRequest({ index: run, payload: current, request: route.request() });
    }
    const response = buildDetectionResponse(
      current.success ?? true,
      current.data || {},
      {
        status: current.status || 201,
        json: current.success
          ? { success: true, data: current.data }
          : { success: false, error: current.error || 'Detection failed' },
      },
    );
    await route.fulfill(
      {
        status: response.status || 201,
        json: response.json,
      },
    );
  });
};

const setupVisionRoutes = async (
  page,
  {
    statusPayload,
    analyzeRuns = null,
    sampleMonitorRuns = null,
    enableSampleMonitor = false,
    analyzeDelayMs = 0,
    onAnalyzeRequest,
    onSampleMonitorRequest,
  } = {},
) => {
  await page.route(`${API}/api/vision/status`, async (route) => {
    await route.fulfill({ json: statusPayload || VISION_STATUS_READY });
  });

  await page.route('**/api/vision/sample-feed', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: FRAME_BYTES,
    });
  });

  await page.route(DETECTIONS_DELETE_RE, async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.continue();
      return;
    }

    const { pathname } = new URL(route.request().url());
    const match = pathname.match(/\/api\/missions\/[^/]+\/detections\/([^/]+)$/);
    const detectionId = match ? match[1] : 'unknown';

    await route.fulfill({
      status: 200,
      json: { success: true, data: { deleted: detectionId } },
    });
  });

  if (analyzeRuns) {
    await mockAnalyzeRoutes(page, analyzeRuns, {
      onRequest: onAnalyzeRequest,
      delayMs: analyzeDelayMs,
    });
  } else if (enableSampleMonitor) {
    await mockAnalyzeRoutes(page, [
      {
        success: true,
        data: buildDetection(
          'detection-frame-uploaded',
          'frame-upload.png',
          { person: 1, truck: 1 },
          [
            { label: 'person', class_id: 0, confidence: 0.97 },
            { label: 'truck', class_id: 1, confidence: 0.9 },
          ],
        ),
      },
    ]);
  }

  if (sampleMonitorRuns) {
    await mockSampleMonitorRoutes(page, sampleMonitorRuns, { onRequest: onSampleMonitorRequest });
  } else if (enableSampleMonitor) {
    await mockSampleMonitorRoutes(page, [
      {
        success: true,
        data: buildDetection(
          'detection-sample-frame',
          'sample-video-frame.jpg',
          { person: 1, car: 1 },
          [
            { label: 'person', class_id: 0, confidence: 0.88 },
            { label: 'car', class_id: 1, confidence: 0.84 },
          ],
        ),
      },
    ]);
  }
};

const getDetectionCardBySource = (page, sourceName) => (
  page.getByText(sourceName).locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]')
);

const expectDetectionSummaryRow = async (page, sourceName, expectedTotal, expectedLabels = {}) => {
  const row = getDetectionCardBySource(page, sourceName);
  await expect(row).toBeVisible();
  await expect(row.getByText(sourceName)).toBeVisible();

  const objectsCard = row.getByText('OBJECTS').locator('..');
  await expect(objectsCard).toContainText(String(expectedTotal));
  const summaryGrid = row.locator('.mt-3.grid.grid-cols-2');
  await expect(summaryGrid).toBeVisible();

  await Promise.all(
    Object.entries(expectedLabels).map(async ([label, count]) => {
      const labelChip = summaryGrid.getByText(label, { exact: true });
      await expect(labelChip).toBeVisible();
      await expect(labelChip.locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]')).toContainText(String(count));
    }),
  );
};

const createAndOpenDebrief = async (page) => {
  await page.keyboard.press('b');
  await page.getByRole('button', { name: 'Missions' }).click();

  await expect(page.getByRole('button', { name: 'NEW MISSION' })).toBeVisible();
  await page.getByRole('button', { name: 'NEW MISSION' }).click();

  const missionName = `E2E DEBRIEF ${Date.now()}`;
  await page.getByPlaceholder('Mission name...').fill(missionName);
  await page.getByPlaceholder('Description...').fill('Playwright mission debrief validation');
  await page.getByRole('button', { name: 'CREATE' }).click();

  await expect(page.getByRole('button', { name: missionName })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'DEBRIEF', exact: true }).click();

  return missionName;
};

test.describe('Mission Debrief User Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('skydash_tour_completed', 'true');
      } catch (e) {
        // Ignore if localStorage is unavailable.
      }
    });
    await page.goto(BASE);
    await page.waitForSelector('text=CONNECTED', { timeout: 15000 });
  });

  test('can create a mission and analyze a frame for debrief results', async ({ page }) => {
    await setupVisionRoutes(page, { statusPayload: VISION_STATUS_READY, enableSampleMonitor: true });

    await createAndOpenDebrief(page);

    await expect(page.getByText('RT-DETR MISSION FRAME ANALYSIS')).toBeVisible();
    await expect(page.getByText('READY')).toBeVisible();
    await expect(page.getByText('NO FRAME ANALYSIS YET')).toBeVisible();

    const analyzeButton = page.getByRole('button', { name: 'ANALYZE' });
    await expect(analyzeButton).toBeDisabled();

    await setAnalysisFile(page);
    await expect(analyzeButton).toBeEnabled();
    const analyzeRequest = page.waitForResponse((response) => (
      DETECTIONS_ANALYZE_RE.test(response.url())
      && response.request().method() === 'POST'
    ));
    await analyzeButton.click();
    await analyzeRequest;

    await expect(page.getByText('1 ANALYSIS RUNS')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('frame-upload.png')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('1 person / 1 truck')).toBeVisible();

    const monitorButton = page.getByRole('button', { name: 'MONITOR SAMPLE' });
    await expect(monitorButton).toBeEnabled();
    const monitorRequest = page.waitForResponse((response) => (
      DETECTIONS_SAMPLE_MONITOR_RE.test(response.url())
      && response.request().method() === 'POST'
    ));
    await monitorButton.click();
    await monitorRequest;

    await expect(page.getByText('2 ANALYSIS RUNS')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('sample-video-frame.jpg')).toBeVisible();
    await expect(page.getByText('LATEST', { exact: false })).toBeVisible();
    await expect(page.getByText('1 person / 1 car')).toBeVisible();
  });

  test('shows an error and keeps run count stable on analysis failure', async ({ page }) => {
    const errorMessage = 'Model inference backend unavailable';
    await setupVisionRoutes(page, {
      statusPayload: VISION_STATUS_READY,
      analyzeRuns: [
        {
          success: false,
          status: 500,
          error: errorMessage,
        },
      ],
    });

    await createAndOpenDebrief(page);

    await expect(page.getByText('0 ANALYSIS RUNS')).toBeVisible();
    await setAnalysisFile(page, 'frame-run-one.png');
    await expect(page.getByRole('button', { name: 'ANALYZE' })).toBeEnabled();

    const analyzeRequest = page.waitForResponse((response) => (
      DETECTIONS_ANALYZE_RE.test(response.url())
      && response.request().method() === 'POST'
    ));
    await page.getByRole('button', { name: 'ANALYZE' }).click();
    await analyzeRequest;

    await expect(page.getByText('0 ANALYSIS RUNS')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('NO FRAME ANALYSIS YET')).toBeVisible();
    await expect(page.getByText(errorMessage)).toBeVisible({ timeout: 10000 });
  });

  test('supports repeated analysis runs and aggregates the latest results', async ({ page }) => {
    await setupVisionRoutes(page, {
      statusPayload: VISION_STATUS_READY,
      enableSampleMonitor: true,
      analyzeRuns: [
        {
          success: true,
          data: buildDetection(
            'detection-run-one',
            'frame-run-one.png',
            { person: 1, truck: 1 },
            [
              { label: 'person', class_id: 0, confidence: 0.97 },
              { label: 'truck', class_id: 1, confidence: 0.9 },
            ],
          ),
        },
        {
          success: true,
          data: buildDetection(
            'detection-run-two',
            'frame-run-two.png',
            { person: 1, bicycle: 1, car: 1 },
            [
              { label: 'person', class_id: 0, confidence: 0.88 },
              { label: 'bicycle', class_id: 1, confidence: 0.84 },
              { label: 'car', class_id: 2, confidence: 0.79 },
            ],
          ),
        },
      ],
    });

    await createAndOpenDebrief(page);

    await setAnalysisFile(page, 'frame-run-one.png');
    await expect(page.getByRole('button', { name: 'ANALYZE' })).toBeEnabled();
    let analyzeRequest = page.waitForResponse((response) => (
      DETECTIONS_ANALYZE_RE.test(response.url())
      && response.request().method() === 'POST'
    ));
    await page.getByRole('button', { name: 'ANALYZE' }).click();
    await analyzeRequest;

    await expect(page.getByText('1 ANALYSIS RUNS')).toBeVisible({ timeout: 10000 });

    await setAnalysisFile(page, 'frame-run-two.png');
    analyzeRequest = page.waitForResponse((response) => (
      DETECTIONS_ANALYZE_RE.test(response.url())
      && response.request().method() === 'POST'
    ));
    await page.getByRole('button', { name: 'ANALYZE' }).click();
    await analyzeRequest;

    await expect(page.getByText('2 ANALYSIS RUNS')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('frame-run-one.png')).toBeVisible();
    await expect(page.getByText('frame-run-two.png')).toBeVisible();
    const latestRow = getDetectionCardBySource(page, 'frame-run-two.png');
    const previousRow = getDetectionCardBySource(page, 'frame-run-one.png');
    const latestY = await latestRow.boundingBox().then((box) => box.y);
    const previousY = await previousRow.boundingBox().then((box) => box.y);
    expect(previousY).toBeGreaterThan(latestY);
    await expectDetectionSummaryRow(page, 'frame-run-two.png', 3, { person: 1, bicycle: 1, car: 1 });
    await expectDetectionSummaryRow(page, 'frame-run-one.png', 2, { person: 1, truck: 1 });
  });

  test('blocks rapid repeated ANALYZE clicks while a run is in progress', async ({ page }) => {
    let analyzeCalls = 0;
    await setupVisionRoutes(page, {
      statusPayload: VISION_STATUS_READY,
      analyzeRuns: [
        {
          success: true,
          data: buildDetection(
            'detection-run-one',
            'frame-run-one.png',
            { person: 1, truck: 1 },
            [
              { label: 'person', class_id: 0, confidence: 0.97 },
              { label: 'truck', class_id: 1, confidence: 0.9 },
            ],
          ),
        },
      ],
      analyzeDelayMs: 250,
      onAnalyzeRequest: () => {
        analyzeCalls += 1;
      },
    });

  await createAndOpenDebrief(page);

  const analyzeButton = page.getByRole('button', { name: 'ANALYZE' });
  const analyzeRequest = page.waitForResponse((response) => (
    DETECTIONS_ANALYZE_RE.test(response.url())
    && response.request().method() === 'POST'
  ));
  await setAnalysisFile(page, 'frame-run-one.png');
  await expect(analyzeButton).toBeEnabled();
  await analyzeButton.click();
  await expect(analyzeButton).toBeDisabled();
  await page.waitForTimeout(100);
  await expect(analyzeButton).toBeDisabled();
  await analyzeRequest;

    expect(analyzeCalls).toBe(1);
    await expect(page.getByText('1 ANALYSIS RUNS')).toBeVisible({ timeout: 10000 });
  });

  test('keeps analysis count stable when monitor sample fails after a valid run', async ({ page }) => {
    let sampleMonitorCalls = 0;
    await setupVisionRoutes(page, {
      statusPayload: VISION_STATUS_READY,
      analyzeRuns: [
        {
          success: true,
          data: buildDetection(
            'detection-run',
            'frame-monitor-run.png',
            { person: 1, truck: 1 },
            [
              { label: 'person', class_id: 0, confidence: 0.97 },
              { label: 'truck', class_id: 1, confidence: 0.9 },
            ],
          ),
        },
      ],
      sampleMonitorRuns: [
        {
          success: false,
          status: 500,
          error: 'Sample monitor backend timeout',
        },
      ],
      onSampleMonitorRequest: () => {
        sampleMonitorCalls += 1;
      },
    });

    await createAndOpenDebrief(page);

    const analyzeButton = page.getByRole('button', { name: 'ANALYZE' });
    await setAnalysisFile(page, 'frame-monitor-run.png');
    const analyzeRequest = page.waitForResponse((response) => (
      DETECTIONS_ANALYZE_RE.test(response.url())
      && response.request().method() === 'POST'
    ));
    await analyzeButton.click();
    await analyzeRequest;

    await expect(page.getByText('1 ANALYSIS RUNS')).toBeVisible({ timeout: 10000 });

    const monitorButton = page.getByRole('button', { name: 'MONITOR SAMPLE' });
    const monitorRequest = page.waitForResponse((response) => (
      DETECTIONS_SAMPLE_MONITOR_RE.test(response.url())
      && response.request().method() === 'POST'
    ));
    await monitorButton.click();
    await monitorRequest;

    await expect(page.getByText('1 ANALYSIS RUNS')).toBeVisible({ timeout: 10000 });
    expect(sampleMonitorCalls).toBe(1);
    await expect(page.getByText('frame-monitor-run.png')).toBeVisible();
  });

  test('allows deleting a detection and decreases analysis runs', async ({ page }) => {
    await setupVisionRoutes(page, {
      statusPayload: VISION_STATUS_READY,
      analyzeRuns: [
        {
          success: true,
          data: buildDetection(
            'detection-frame',
            'frame-upload.png',
            { person: 1, truck: 1 },
            [
              { label: 'person', class_id: 0, confidence: 0.97 },
              { label: 'truck', class_id: 1, confidence: 0.9 },
            ],
          ),
        },
      ],
      sampleMonitorRuns: [
        {
          success: true,
          data: buildDetection(
            'detection-sample',
            'sample-video-frame.jpg',
            { person: 1, car: 1 },
            [
              { label: 'person', class_id: 0, confidence: 0.88 },
              { label: 'car', class_id: 1, confidence: 0.84 },
            ],
          ),
        },
      ],
      enableSampleMonitor: true,
    });

    await createAndOpenDebrief(page);

    await setAnalysisFile(page, 'frame-delete-run.png');
    const analyzeRequest = page.waitForResponse((response) => (
      DETECTIONS_ANALYZE_RE.test(response.url())
      && response.request().method() === 'POST'
    ));
    await page.getByRole('button', { name: 'ANALYZE' }).click();
    await analyzeRequest;

    await expect(page.getByText('1 ANALYSIS RUNS')).toBeVisible({ timeout: 10000 });

    const monitorButton = page.getByRole('button', { name: 'MONITOR SAMPLE' });
    const monitorRequest = page.waitForResponse((response) => (
      DETECTIONS_SAMPLE_MONITOR_RE.test(response.url())
      && response.request().method() === 'POST'
    ));
    await monitorButton.click();
    await monitorRequest;

    await expect(page.getByText('2 ANALYSIS RUNS')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('sample-video-frame.jpg')).toBeVisible();

    const sampleDetectionRow = page.getByText('sample-video-frame.jpg')
      .locator('xpath=ancestor::div[contains(@class, "rounded-lg")][1]');
    await expect(sampleDetectionRow).toBeVisible();
    await sampleDetectionRow.getByRole('button').last().click();

    await expect(page.getByText('1 ANALYSIS RUNS')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('sample-video-frame.jpg')).not.toBeVisible();
    await expect(page.getByText('frame-upload.png')).toBeVisible();
  });

  test('shows optional state and disables analysis actions when RT-DETR is unavailable', async ({ page }) => {
    await setupVisionRoutes(page, { statusPayload: VISION_STATUS_OPTIONAL, enableSampleMonitor: false });

    await createAndOpenDebrief(page);

    await expect(page.getByText('OPTIONAL')).toBeVisible();
    await expect(page.getByText('Install backend vision extras to enable RT-DETR')).toBeVisible();
    await expect(page.getByText('frame-upload')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'ANALYZE' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'MONITOR SAMPLE' })).toBeDisabled();
  });
});
