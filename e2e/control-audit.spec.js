// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const REPORT_PATH = path.join(
  process.cwd(),
  'skydash_intel_crew',
  'reports',
  'skydash_ui_control_runtime_audit.json',
);

async function openApp(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('skydash_tour_completed', 'true');
  });
  await page.goto(BASE);
  await page.waitForSelector('text=CONNECTED', { timeout: 15000 });
  await page.getByText('Spatial Intelligence OS', { exact: true }).waitFor({
    state: 'hidden',
    timeout: 5000,
  }).catch(() => {});
  await page.waitForTimeout(300);
}

async function collectVisibleButtons(page, view) {
  return page.locator('button').evaluateAll((buttons, viewName) => buttons
    .map((button, index) => {
      const rect = button.getBoundingClientRect();
      const style = window.getComputedStyle(button);
      const text = button.innerText?.replace(/\s+/g, ' ').trim() || '';
      const aria = button.getAttribute('aria-label') || '';
      const title = button.getAttribute('title') || '';
      const disabled = button.disabled || button.getAttribute('aria-disabled') === 'true';
      const visible = rect.width > 0
        && rect.height > 0
        && style.visibility !== 'hidden'
        && style.display !== 'none'
        && Number(style.opacity || '1') > 0.01;
      return {
        view: viewName,
        index,
        text,
        aria,
        title,
        disabled,
        visible,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        signature: button.outerHTML
          .replace(/\s+/g, ' ')
          .slice(0, 180),
      };
    })
    .filter((button) => button.visible), view);
}

async function navigate(page, key) {
  await page.keyboard.press(key);
  await page.waitForTimeout(1000);
}

test('runtime control audit covers visible operator buttons', async ({ page }) => {
  await openApp(page);

  const snapshots = [];
  snapshots.push(...await collectVisibleButtons(page, 'dashboard'));

  await navigate(page, 'm');
  snapshots.push(...await collectVisibleButtons(page, 'map'));

  await navigate(page, 't');
  snapshots.push(...await collectVisibleButtons(page, 'telemetry'));

  await navigate(page, 'i');
  snapshots.push(...await collectVisibleButtons(page, 'intel'));

  await navigate(page, 'o');
  snapshots.push(...await collectVisibleButtons(page, 'missions'));

  await page.locator('aside button[data-tour="settings"]').click();
  await page.waitForTimeout(1000);
  snapshots.push(...await collectVisibleButtons(page, 'settings'));

  const actionable = snapshots.filter((button) => !button.disabled);
  const unlabeled = actionable.filter((button) => !button.text && !button.aria && !button.title);
  const tinyTargets = actionable.filter((button) => button.width < 20 || button.height < 20);

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    summary: {
      views: [...new Set(snapshots.map((button) => button.view))],
      visibleButtons: snapshots.length,
      actionableButtons: actionable.length,
      unlabeledButtons: unlabeled.length,
      tinyTargets: tinyTargets.length,
    },
    issues: {
      unlabeledButtons: unlabeled,
      tinyTargets,
    },
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(payload, null, 2));

  expect(payload.summary.views).toEqual(['dashboard', 'map', 'telemetry', 'intel', 'missions', 'settings']);
  expect(payload.summary.actionableButtons).toBeGreaterThan(40);
  expect(unlabeled, JSON.stringify(unlabeled.slice(0, 5), null, 2)).toHaveLength(0);
});
