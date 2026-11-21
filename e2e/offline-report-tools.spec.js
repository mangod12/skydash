// Exercises the actual packaged production standalone site, not the normal dev app.
// Fixed fabricated fixtures only. No backend, private recordings or account access.
const {
  test,
  expect
} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {
  execFileSync
} = require('node:child_process');
const {
  pathToFileURL
} = require('node:url');
const root = path.resolve(__dirname, '..', 'skydash', 'frontend');
const load = name => import(pathToFileURL(path.join(root, 'scripts', name + '.mjs')).href);
let folder, src, server, origin;
test.beforeAll(async () => {
  test.setTimeout(120000);
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'skydash-offline-e2e-'));
  src = path.join(folder, 'synthetic');
  execFileSync('npm', ['run', 'build:offline-review'], {
    cwd: root,
    stdio: 'pipe'
  });
  await (await load('create-training-example')).createTrainingExample(src);
  const archive = path.join(folder, 'review.zip');
  const receipt = await (await load('offline-review-distribution')).writeOfflineDistribution(path.join(root, 'dist-offline-review'), archive);
  const bytes = fs.readFileSync(archive);
  // The test extracts only its own just-built, fixed-format, completely verified ZIP.
  // This is not a production archive extraction feature or an arbitrary ZIP reader.
  (await load('verify-offline-archive')).inspectStoredDistribution(bytes, {
    expectedArchiveSha256: receipt.exact_archive_sha256,
    expectedManifestSha256: receipt.exact_manifest_sha256
  });
  const extracted = path.join(folder, 'extracted');
  fs.mkdirSync(extracted);
  for (let offset = 0; bytes.readUInt32LE(offset) === 0x04034b50;) {
    const size = bytes.readUInt32LE(offset + 22),
      length = bytes.readUInt16LE(offset + 26);
    const name = bytes.subarray(offset + 30, offset + 30 + length).toString('utf8');
    const start = offset + 30 + length,
      target = path.join(extracted, name);
    fs.mkdirSync(path.dirname(target), {
      recursive: true
    });
    fs.writeFileSync(target, bytes.subarray(start, start + size), {
      flag: 'wx'
    });
    offset = start + size;
  }
  server = await (await load('serve-offline-review')).serveOfflineReview(extracted, {
    trustExecutableAssets: true,
    expectedManifestSha256: receipt.exact_manifest_sha256,
    port: 0
  });
  origin = new URL(server.receipt.url).origin + '/';
});
test.afterAll(async () => {
  if (server) await server.close();
  if (folder) fs.rmSync(folder, {
    recursive: true,
    force: true
  });
});
test('all seven report drawers preserve prepared downloads and replay in one offline session', async ({
  page: p,
  context: c
}, testInfo) => {
  test.setTimeout(120000);
  await p.setViewportSize({
    width: 1440,
    height: 1050
  });
  const requests = [],
    errors = [];
  p.on('request', r => {
    if (!r.url().startsWith(origin) && !r.url().startsWith('blob:')) requests.push(r.url());
  });
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(() => {
    window.effects = [];
    const track = (proto, name, label) => {
      const old = proto[name];
      proto[name] = function (...args) {
        window.effects.push(label);
        return old.apply(this, args);
      };
    };
    track(Storage.prototype, 'setItem', 'storage');
    track(IDBFactory.prototype, 'open', 'idb');
    const fetch = window.fetch;
    window.fetch = (...args) => {
      window.effects.push('fetch');
      return fetch(...args);
    };
  });
  await p.goto(origin + 'offline-review.html');
  await c.setOffline(true);
  await p.getByText('Load synthetic sample', {
    exact: true
  }).click();
  await p.getByLabel('Analyst notes', {
    exact: true
  }).fill('PRIVATE active replay notes remain');
  await p.getByLabel('Replay position', {
    exact: true
  }).fill('8');
  const pair = p.getByRole('article', {
    name: 'Two-flight comparison',
    exact: true
  });
  await pair.getByText('Load synthetic baseline', {
    exact: true
  }).click();
  await pair.getByLabel('Comparison time', {
    exact: true
  }).fill('6');
  await pair.getByLabel('Comparison notes', {
    exact: true
  }).fill('PRIVATE active comparison remains');
  const groups = p.getByLabel('Standalone original report tools', {
      exact: true
    }),
    panels = {
      review: 'Original notebook or paired comparison print tool',
      lineage: 'Original training source-link print tool',
      case: 'Original case comparison print tool',
      private: 'Private original print tool',
      intake: 'Privacy-reduced intake print tool',
      comparison: 'Original package comparison print tool',
      conversion: 'CSV conversion reproduction tool'
    },
    titles = {
      review: 'Compare two original notebook or paired reviews locally',
      lineage: 'Check conversion links to original review sources locally',
      case: 'Compare two original case reviews locally',
      private: 'Print a private original debrief locally',
      intake: 'Print a privacy-reduced package intake report locally',
      comparison: 'Compare two original package snapshots locally',
      conversion: 'Reproduce a recorded CSV conversion locally'
    },
    buttons = {
      review: 'Download notebook or paired comparison HTML',
      lineage: 'Download source-link intake HTML',
      case: 'Download case comparison HTML',
      private: 'Download private discussion HTML',
      intake: 'Download privacy-reduced intake HTML',
      comparison: 'Download package comparison HTML',
      conversion: 'Download conversion check receipt'
    },
    pin = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  await expect(groups.locator(':scope > details')).toHaveCount(7);
  const open = async kind => {
      await p.getByText(titles[kind], {
        exact: true
      }).click();
      await expect(groups.locator(':scope > details[open]')).toHaveCount(1);
      return p.locator('section[aria-label="' + panels[kind] + '"]');
    },
    download = async (kind, panel, name) => {
      const pending = p.waitForEvent('download');
      await panel.getByRole('button', {
        name: buttons[kind],
        exact: true
      }).click();
      await (await pending).saveAs(testInfo.outputPath(name));
    };
  let panel = await open('private');
  await panel.getByLabel('Private print original kind').selectOption('package');
  await panel.getByLabel('Private print original JSON').setInputFiles(src + '/training.json');
  await panel.getByLabel('Private print package originals').setInputFiles(['paired.json', 'case.json', 'notebook.json'].map(f => src + '/' + f));
  await panel.getByLabel('Expected private print original SHA-256').fill(pin(src + '/training.json'));
  await panel.getByLabel('Include private reviewer text and coordinates').check();
  await panel.getByRole('button', {
    name: 'Check original for private print'
  }).click();
  await expect(panel.getByRole('button', {
    name: buttons.private
  })).toBeEnabled();
  await download('private', panel, 'private.html');
  panel = await open('intake');
  await panel.getByLabel('Intake print original manifest').setInputFiles(src + '/training.json');
  await panel.getByLabel('Intake print original files').setInputFiles(['paired.json', 'case.json', 'notebook.json'].map(f => src + '/' + f));
  await panel.getByLabel('Intake print expected manifest SHA-256').fill(pin(src + '/training.json'));
  await panel.getByRole('button', {
    name: 'Check originals for intake print'
  }).click();
  await expect(panel.getByRole('button', {
    name: buttons.intake
  })).toBeEnabled();
  await download('intake', panel, 'intake.html');
  // Whole originals require a separate fresh acknowledgement and explicit download.
  const prepareZip = panel.getByRole('button', {
      name: 'Prepare sensitive original ZIP',
      exact: true
    }),
    downloadZip = panel.getByRole('button', {
      name: 'Download sensitive original ZIP',
      exact: true
    }),
    ack = panel.getByLabel('Acknowledge sensitive whole-original ZIP');
  await expect(prepareZip).toBeDisabled();
  await ack.check();
  await prepareZip.click();
  await expect(downloadZip).toBeEnabled();
  await expect(ack).not.toBeChecked();
  const zipDownload = p.waitForEvent('download');
  await downloadZip.click();
  await (await zipDownload).saveAs(testInfo.outputPath('sensitive-originals.zip'));
  await expect(panel).toContainText(pin(testInfo.outputPath('sensitive-originals.zip')));
  await panel.locator(':scope > [role=status]').scrollIntoViewIfNeeded();
  await p.screenshot({
    path: testInfo.outputPath('sensitive-archive-desktop.png')
  });
  await p.setViewportSize({
    width: 390,
    height: 1000
  });
  await panel.getByText('Keep these checked originals together for manual handoff', {
    exact: true
  }).scrollIntoViewIfNeeded();
  await p.screenshot({
    path: testInfo.outputPath('sensitive-archive-mobile-consent.png')
  });
  await panel.locator(':scope > [role=status]').scrollIntoViewIfNeeded();
  await p.screenshot({
    path: testInfo.outputPath('sensitive-archive-mobile.png')
  });
  await p.setViewportSize({
    width: 1440,
    height: 1050
  });
  const starter = panel.getByRole('region', {
      name: 'Fixed synthetic handoff starter',
      exact: true
    }),
    starterDownload = starter.getByRole('button', {
      name: 'Download synthetic starter ZIP',
      exact: true
    });
  await expect(starterDownload).toBeDisabled();
  await starter.getByRole('button', {
    name: 'Prepare fixed synthetic handoff starter',
    exact: true
  }).click();
  await expect(starterDownload).toBeEnabled();
  await expect(downloadZip).toBeEnabled();
  const starterPending = p.waitForEvent('download');
  await starterDownload.click();
  await (await starterPending).saveAs(testInfo.outputPath('synthetic-starter.zip'));
  await expect(starter).toContainText(pin(testInfo.outputPath('synthetic-starter.zip')));
  await starter.getByRole('status').scrollIntoViewIfNeeded();
  await p.screenshot({
    path: testInfo.outputPath('synthetic-starter-desktop.png')
  });
  await p.setViewportSize({
    width: 390,
    height: 1000
  });
  await starter.getByRole('status').scrollIntoViewIfNeeded();
  await p.screenshot({
    path: testInfo.outputPath('synthetic-starter-mobile.png')
  });
  await p.setViewportSize({
    width: 1440,
    height: 1050
  });
  const received = panel.getByRole('region', {
    name: 'Received original ZIP check',
    exact: true
  });
  await received.getByLabel('Received original handoff ZIP').setInputFiles(testInfo.outputPath('synthetic-starter.zip'));
  await received.getByRole('button', {
    name: 'Check received original ZIP',
    exact: true
  }).click();
  await expect(received.getByRole('button', {
    name: 'Download rechecked archive intake HTML',
    exact: true
  })).toBeEnabled();
  await expect(received).toContainText('No independent ZIP expectation supplied.');
  const syntheticChecked = p.waitForEvent('download');
  await received.getByRole('button', {
    name: 'Download rechecked archive intake HTML',
    exact: true
  }).click();
  await (await syntheticChecked).saveAs(testInfo.outputPath('synthetic-rechecked.html'));
  await received.getByLabel('Received original handoff ZIP').setInputFiles(testInfo.outputPath('sensitive-originals.zip'));
  const receivedPin = received.getByLabel('Received ZIP expected archive SHA-256'),
    receivedManifestPin = received.getByLabel('Received ZIP expected manifest SHA-256'),
    receivedDownload = received.getByRole('button', {
      name: 'Download rechecked archive intake HTML',
      exact: true
    });
  await receivedPin.fill(pin(testInfo.outputPath('sensitive-originals.zip')));
  await receivedManifestPin.fill(pin(src + '/training.json'));
  await received.getByRole('button', {
    name: 'Check received original ZIP',
    exact: true
  }).click();
  await expect(receivedDownload).toBeEnabled();
  await expect(downloadZip).toBeEnabled();
  const recheckedDownload = p.waitForEvent('download');
  await receivedDownload.click();
  await (await recheckedDownload).saveAs(testInfo.outputPath('rechecked-archive.html'));
  await received.getByRole('status').scrollIntoViewIfNeeded();
  await p.screenshot({
    path: testInfo.outputPath('received-archive-desktop.png')
  });
  await p.setViewportSize({
    width: 390,
    height: 1000
  });
  await received.getByText('Check a received browser original ZIP before manual extraction', {
    exact: true
  }).scrollIntoViewIfNeeded();
  await p.screenshot({
    path: testInfo.outputPath('received-archive-mobile-inputs.png')
  });
  await received.getByRole('status').scrollIntoViewIfNeeded();
  await p.screenshot({
    path: testInfo.outputPath('received-archive-mobile.png')
  });
  await p.setViewportSize({
    width: 1440,
    height: 1050
  });
  await receivedPin.fill('a'.repeat(64));
  await expect(receivedDownload).toBeDisabled();
  await received.getByRole('button', {
    name: 'Check received original ZIP',
    exact: true
  }).click();
  await expect(received.getByRole('status')).toContainText('Original ZIP refused');
  await expect(downloadZip).toBeEnabled();
  await receivedPin.fill(pin(testInfo.outputPath('sensitive-originals.zip')));
  await expect(receivedDownload).toBeDisabled();
  await received.getByRole('button', {
    name: 'Check received original ZIP',
    exact: true
  }).click();
  await expect(receivedDownload).toBeEnabled();
  const privateAck = received.getByLabel('Acknowledge received ZIP private discussion packet'),
    preparePrivateZip = received.getByRole('button', { name: 'Prepare received ZIP private discussion', exact: true }),
    privateZipDownload = received.getByRole('button', { name: 'Download received ZIP private discussion HTML', exact: true });
  await expect(preparePrivateZip).toBeDisabled();
  await privateAck.check();
  await expect(receivedDownload).toBeDisabled();
  await preparePrivateZip.click();
  await expect(privateZipDownload).toBeEnabled();
  await expect(privateAck).not.toBeChecked();
  await expect(receivedDownload).toBeEnabled();
  const privateZipPending = p.waitForEvent('download');
  await privateZipDownload.click();
  await (await privateZipPending).saveAs(testInfo.outputPath('rechecked-private-archive.html'));
  await preparePrivateZip.scrollIntoViewIfNeeded();
  await p.screenshot({ path: testInfo.outputPath('received-private-desktop.png') });
  await p.setViewportSize({ width: 390, height: 1000 });
  await privateAck.scrollIntoViewIfNeeded();
  await p.screenshot({ path: testInfo.outputPath('received-private-mobile.png') });
  await privateZipDownload.scrollIntoViewIfNeeded();
  await p.screenshot({ path: testInfo.outputPath('received-private-mobile-download.png') });
  expect(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await p.setViewportSize({ width: 1440, height: 1050 });
  await privateAck.check();
  await receivedPin.fill('a'.repeat(64));
  await expect(privateAck).not.toBeChecked();
  await expect(privateZipDownload).toBeDisabled();
  await privateAck.check();
  await preparePrivateZip.click();
  await expect(received.getByRole('status')).toContainText('Original ZIP refused');
  await expect(privateAck).not.toBeChecked();
  await expect(privateZipDownload).toBeDisabled();
  await receivedPin.fill(pin(testInfo.outputPath('sensitive-originals.zip')));
  await expect(privateZipDownload).toBeDisabled();
  await privateAck.check();
  await preparePrivateZip.click();
  await expect(privateZipDownload).toBeEnabled();
  // Editing even the same pin away and back invalidates ZIP and consumes consent.
  const intakePin = panel.getByLabel('Intake print expected manifest SHA-256');
  await intakePin.fill('a'.repeat(64));
  await expect(downloadZip).toBeDisabled();
  await ack.check();
  await prepareZip.click();
  await expect(panel.locator(':scope > [role=status]')).toContainText('Original ZIP refused');
  await expect(ack).not.toBeChecked();
  await expect(downloadZip).toBeDisabled();
  await intakePin.fill(pin(src + '/training.json'));
  await expect(downloadZip).toBeDisabled();
  await expect(prepareZip).toBeDisabled();
  await ack.check();
  await prepareZip.click();
  await expect(downloadZip).toBeEnabled();
  panel = await open('comparison');
  for (const side of ['Left', 'Right']) {
    const source = src;
    await panel.getByLabel(side + ' comparison original manifest').setInputFiles(source + '/training.json');
    await panel.getByLabel(side + ' comparison original files').setInputFiles(['paired.json', 'case.json', 'notebook.json'].map(f => source + '/' + f));
    await panel.getByLabel(side + ' comparison expected manifest SHA-256').fill(pin(source + '/training.json'));
  }
  await panel.getByRole('button', {
    name: 'Check both packages for comparison'
  }).click();
  await expect(panel.getByRole('button', {
    name: buttons.comparison
  })).toBeEnabled();
  await download('comparison', panel, 'comparison.html');
  const zipComparison = panel.getByRole('region', { name: 'Received ZIP snapshot comparison', exact: true }),
    zipComparisonDownload = zipComparison.getByRole('button', { name: 'Download received ZIP comparison HTML', exact: true }),
    zipComparisonCheck = zipComparison.getByRole('button', { name: 'Check both received ZIP snapshots', exact: true });
  for (const [side, name] of [['Left', 'sensitive-originals.zip'], ['Right', 'synthetic-starter.zip']]) {
    await zipComparison.getByLabel(side + ' ZIP comparison original archive').setInputFiles(testInfo.outputPath(name));
    await zipComparison.getByLabel(side + ' ZIP comparison expected archive SHA-256').fill(pin(testInfo.outputPath(name)));
    await zipComparison.getByLabel(side + ' ZIP comparison expected manifest SHA-256').fill(pin(src + '/training.json'));
  }
  await zipComparisonCheck.click();
  await expect(zipComparisonDownload).toBeEnabled();
  await expect(panel.getByRole('button', { name: buttons.comparison, exact: true })).toBeEnabled();
  const zipComparisonPending = p.waitForEvent('download');
  await zipComparisonDownload.click();
  await (await zipComparisonPending).saveAs(testInfo.outputPath('rechecked-zip-comparison.html'));
  await zipComparison.getByRole('status').scrollIntoViewIfNeeded();
  await p.screenshot({ path: testInfo.outputPath('zip-comparison-desktop.png') });
  await p.setViewportSize({ width: 390, height: 1000 });
  await zipComparison.getByRole('status').scrollIntoViewIfNeeded();
  await p.screenshot({ path: testInfo.outputPath('zip-comparison-mobile.png') });
  expect(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await p.setViewportSize({ width: 1440, height: 1050 });
  for (const [kind, ordinal] of [['case', '1'], ['notebook', '2'], ['paired', '3']]) {
    await zipComparison.getByLabel('Received ZIP comparison scope').selectOption(kind);
    await expect(zipComparisonDownload).toBeDisabled();
    for (const side of ['Left', 'Right']) {
      await zipComparison.getByLabel(side + ' ZIP review ordinal').fill(ordinal);
      await zipComparison.getByLabel(side + ' ZIP review expected artifact SHA-256').fill(pin(src + '/' + kind + '.json'));
    }
    await zipComparisonCheck.click();
    await expect(zipComparisonDownload).toBeEnabled();
    await expect(zipComparison).toContainText('Explicit ' + kind + ' pair: Left manifest original ' + ordinal + '; Right manifest original ' + ordinal);
    const pairPending = p.waitForEvent('download');
    await zipComparisonDownload.click();
    await (await pairPending).saveAs(testInfo.outputPath('zip-review-' + kind + '.html'));
  }
  await zipComparison.getByLabel('Right ZIP review ordinal').fill('1');
  await expect(zipComparisonDownload).toBeDisabled();
  await zipComparisonCheck.click();
  await expect(zipComparison.getByRole('status')).toContainText('ZIP snapshot comparison refused');
  await expect(zipComparisonDownload).toBeDisabled();
  await zipComparison.getByLabel('Right ZIP review ordinal').fill('3');
  await expect(zipComparisonDownload).toBeDisabled();
  await zipComparisonCheck.click();
  await expect(zipComparisonDownload).toBeEnabled();
  await zipComparison.getByLabel('Received ZIP comparison scope').scrollIntoViewIfNeeded();
  await p.screenshot({ path: testInfo.outputPath('zip-review-desktop.png') });
  await p.setViewportSize({ width: 390, height: 1000 });
  await zipComparison.getByLabel('Right ZIP review ordinal').scrollIntoViewIfNeeded();
  await p.screenshot({ path: testInfo.outputPath('zip-review-mobile-inputs.png') });
  await zipComparisonDownload.scrollIntoViewIfNeeded();
  await p.screenshot({ path: testInfo.outputPath('zip-review-mobile.png') });
  expect(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await p.setViewportSize({ width: 1440, height: 1050 });
  await zipComparison.getByLabel('Received ZIP comparison scope').selectOption('package');
  await expect(zipComparisonDownload).toBeDisabled();
  await zipComparisonCheck.click();
  await expect(zipComparisonDownload).toBeEnabled();
  const rightZipPin = zipComparison.getByLabel('Right ZIP comparison expected archive SHA-256');
  await rightZipPin.fill('a'.repeat(64));
  await expect(zipComparisonDownload).toBeDisabled();
  await zipComparisonCheck.click();
  await expect(zipComparison.getByRole('status')).toContainText('ZIP snapshot comparison refused');
  await expect(zipComparisonDownload).toBeDisabled();
  await expect(panel.getByRole('button', { name: buttons.comparison, exact: true })).toBeEnabled();
  await rightZipPin.fill(pin(testInfo.outputPath('synthetic-starter.zip')));
  await expect(zipComparisonDownload).toBeDisabled();
  await zipComparisonCheck.click();
  await expect(zipComparisonDownload).toBeEnabled();

  panel = await open('conversion');
  const conversion = src + '/lineage';
  for (const role of ['original', 'recipe', 'converted']) {
    const filename = conversion + '/' + role + (role === 'recipe' ? '.json' : '.csv');
    await panel.getByLabel('Conversion ' + role + ' file').setInputFiles(filename);
    await panel.getByLabel('Conversion ' + role + ' expected SHA-256').fill(pin(filename));
  }
  await panel.getByLabel('Fresh original WGS84 confirmation').check();
  await panel.getByRole('button', {
    name: 'Check exact conversion reproduction'
  }).click();
  await expect(panel.getByRole('button', {
    name: buttons.conversion
  })).toBeEnabled();
  await download('conversion', panel, 'receipt.json');
  panel = await open('case');
  for (const side of ['Left', 'Right']) {
    const filename = src + '/case.json';
    await panel.getByLabel(side + ' case comparison original').setInputFiles(filename);
    await panel.getByLabel(side + ' case comparison expected SHA-256').fill(pin(filename));
  }
  await panel.getByRole('button', {
    name: 'Check both original cases',
    exact: true
  }).click();
  await expect(panel.getByRole('button', {
    name: buttons.case
  })).toBeEnabled();
  await download('case', panel, 'case.html');
  panel = await open('lineage');
  for (const [side, manifest, files] of [['Training', src + '/training.json', ['case.json', 'notebook.json', 'paired.json'].map(f => src + '/' + f)], ['Lineage', src + '/lineage/lineage.json', ['original.csv', 'recipe.json', 'converted.csv'].map(f => src + '/lineage/' + f)]]) {
    await panel.getByLabel(side + ' source-link manifest').setInputFiles(manifest);
    await panel.getByLabel(side + ' source-link original files').setInputFiles(files);
    await panel.getByLabel(side + ' source-link expected SHA-256').fill(pin(manifest));
  }
  await panel.getByLabel('Fresh all-original WGS84 confirmation').check();
  await panel.getByRole('button', {
    name: 'Check originals and conversion links'
  }).click();
  await expect(panel.getByRole('button', {
    name: buttons.lineage
  })).toBeEnabled();
  await download('lineage', panel, 'lineage.html');
  panel = await open('review');
  for (const kind of ['notebook', 'paired']) {
    await panel.getByLabel('Original review comparison kind').selectOption(kind);
    for (const side of ['Left', 'Right']) {
      const filename = src + '/' + kind + '.json';
      await panel.getByLabel(side + ' review comparison original').setInputFiles(filename);
      await panel.getByLabel(side + ' review comparison expected SHA-256').fill(pin(filename));
    }
    await panel.getByRole('button', {
      name: 'Check both original notebook or paired reviews'
    }).click();
    await expect(panel.getByRole('button', {
      name: buttons.review
    })).toBeEnabled();
    await download('review', panel, kind + '.html');
  }
  for (const kind of ['private', 'intake', 'comparison', 'conversion', 'case', 'lineage', 'review']) {
    panel = await open(kind);
    await expect(panel.getByRole('button', {
      name: buttons[kind]
    })).toBeEnabled();
    if (kind === 'comparison') await expect(zipComparisonDownload).toBeEnabled();
    if (kind === 'intake') {
      await expect(downloadZip).toBeEnabled();
      await expect(receivedDownload).toBeEnabled();
      await expect(privateZipDownload).toBeEnabled();
      await expect(starterDownload).toBeEnabled();
    }
    expect(await p.locator('main').first().evaluate(e => e.getBoundingClientRect().height > 50 && e.getBoundingClientRect().bottom <= innerHeight + 1)).toBe(true);
  }
  await p.screenshot({
    path: testInfo.outputPath('desktop-tools.png')
  });
  await p.setViewportSize({
    width: 390,
    height: 1000
  });
  for (const kind of ['private', 'intake', 'comparison', 'conversion', 'case', 'lineage', 'review']) {
    panel = await open(kind);
    await expect(panel.getByRole('button', {
      name: buttons[kind]
    })).toBeEnabled();
    if (kind === 'comparison') await expect(zipComparisonDownload).toBeEnabled();
    if (kind === 'intake') {
      await expect(downloadZip).toBeEnabled();
      await expect(receivedDownload).toBeEnabled();
      await expect(privateZipDownload).toBeEnabled();
      await expect(starterDownload).toBeEnabled();
    }
    expect(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(await p.locator('main').first().evaluate(e => e.getBoundingClientRect().height > 50 && e.getBoundingClientRect().bottom <= innerHeight + 1)).toBe(true);
  }
  await panel.locator(':scope > [role=status]').scrollIntoViewIfNeeded();
  await p.screenshot({
    path: testInfo.outputPath('mobile-tools.png')
  });
  panel = await open('comparison');
  await panel.getByRole('button', { name: 'Clear comparison print selections', exact: true }).click();
  await expect(panel.getByRole('button', { name: buttons.comparison, exact: true })).toBeDisabled();
  await expect(zipComparisonDownload).toBeEnabled();
  for (const side of ['Left', 'Right']) {
    await panel.getByLabel(side + ' comparison original manifest').setInputFiles(src + '/training.json');
    await panel.getByLabel(side + ' comparison original files').setInputFiles(['paired.json', 'case.json', 'notebook.json'].map(f => src + '/' + f));
    await panel.getByLabel(side + ' comparison expected manifest SHA-256').fill(pin(src + '/training.json'));
  }
  await panel.getByRole('button', { name: 'Check both packages for comparison', exact: true }).click();
  await expect(zipComparisonDownload).toBeEnabled();
  await zipComparison.getByRole('button', { name: 'Clear received ZIP comparison', exact: true }).click();
  await expect(zipComparisonDownload).toBeDisabled();
  await expect(panel.getByRole('button', { name: buttons.comparison, exact: true })).toBeEnabled();
  panel = await open('intake');
  await panel.getByRole('button', {
    name: 'Clear intake print selections'
  }).click();
  await expect(downloadZip).toBeDisabled();
  await expect(receivedDownload).toBeEnabled();
  await expect(privateZipDownload).toBeEnabled();
  await received.getByRole('button', {
    name: 'Clear received ZIP check',
    exact: true
  }).click();
  await expect(receivedDownload).toBeDisabled();
  await expect(privateZipDownload).toBeDisabled();
  await expect(privateAck).not.toBeChecked();
  await expect(starterDownload).toBeEnabled();
  await starter.getByRole('button', {
    name: 'Clear synthetic starter',
    exact: true
  }).click();
  await expect(starterDownload).toBeDisabled();
  for (const kind of ['private', 'comparison', 'conversion', 'case', 'lineage', 'review']) {
    panel = await open(kind);
    await expect(panel.getByRole('button', {
      name: buttons[kind]
    })).toBeEnabled();
  }
  await p.getByText(titles.review, {
    exact: true
  }).click();
  await expect(p.getByLabel('Analyst notes', {
    exact: true
  })).toHaveValue('PRIVATE active replay notes remain');
  await expect(p.getByLabel('Replay position', {
    exact: true
  })).toHaveValue('8');
  await expect(pair.getByLabel('Comparison time', {
    exact: true
  })).toHaveValue('6');
  await expect(pair.getByLabel('Comparison notes', {
    exact: true
  })).toHaveValue('PRIVATE active comparison remains');
  expect(await p.evaluate(() => window.effects)).toEqual([]);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  const original = path.join(src, 'training.json'),
    paired = path.join(src, 'paired.json'),
    notebook = path.join(src, 'notebook.json'),
    caseFile = path.join(src, 'case.json');
  const expectedSha256 = pin(original),
    pairOptions = {
      expectedLeftSha256: expectedSha256,
      expectedRightSha256: expectedSha256
    };
  const outputs = {
    'private.html': await (await load('report-private-training')).reportPrivateTraining(original, {
      includePrivateReview: true,
      expectedSha256
    }),
    'intake.html': await (await load('report-training-intake')).reportTrainingIntake(original, {
      expectedSha256
    }),
    'comparison.html': await (await load('report-training-comparison')).reportTrainingComparison(original, original, pairOptions),
    'case.html': await (await load('report-review-case-comparison')).reportReviewCaseComparison(caseFile, caseFile, {
      expectedLeftSha256: pin(caseFile),
      expectedRightSha256: pin(caseFile)
    }),
    'lineage.html': await (await load('report-training-intake')).reportTrainingIntake(original, {
      expectedSha256,
      lineageManifest: path.join(src, 'lineage', 'lineage.json'),
      expectedLineageSha256: pin(path.join(src, 'lineage', 'lineage.json')),
      confirmedWGS84: true
    }),
    'notebook.html': await (await load('report-review-comparison')).reportReviewComparison('notebook', notebook, notebook, {
      expectedLeftSha256: pin(notebook),
      expectedRightSha256: pin(notebook)
    }),
    'paired.html': await (await load('report-review-comparison')).reportReviewComparison('paired', paired, paired, {
      expectedLeftSha256: pin(paired),
      expectedRightSha256: pin(paired)
    })
  };
  for (const [filename, html] of Object.entries(outputs)) expect(fs.readFileSync(testInfo.outputPath(filename), 'utf8')).toBe(html);
  expect(fs.readFileSync(testInfo.outputPath('rechecked-archive.html'), 'utf8')).toBe(outputs['intake.html']);
  expect(fs.readFileSync(testInfo.outputPath('rechecked-private-archive.html'), 'utf8')).toBe(outputs['private.html']);
  expect(fs.readFileSync(testInfo.outputPath('rechecked-zip-comparison.html'), 'utf8')).toBe(outputs['comparison.html']);
  for (const kind of ['case', 'notebook', 'paired']) {
    const originalFile = src + '/' + kind + '.json', options = { expectedLeftSha256: pin(originalFile), expectedRightSha256: pin(originalFile) };
    const html = kind === 'case' ? await (await load('report-review-case-comparison')).reportReviewCaseComparison(originalFile, originalFile, options) : await (await load('report-review-comparison')).reportReviewComparison(kind, originalFile, originalFile, options);
    expect(fs.readFileSync(testInfo.outputPath('zip-review-' + kind + '.html'), 'utf8')).toBe(html);
  }

  expect(fs.readFileSync(testInfo.outputPath('synthetic-rechecked.html'), 'utf8')).toBe(await (await load('report-training-intake')).reportTrainingIntake(original));
  const checked = await (await load('verify-csv-conversion')).verifyCSVConversion(path.join(src, 'lineage', 'original.csv'), path.join(src, 'lineage', 'recipe.json'), path.join(src, 'lineage', 'converted.csv'), {
    confirmedWGS84: true
  });
  const receipt = JSON.parse(fs.readFileSync(testInfo.outputPath('receipt.json'), 'utf8'));
  expect(receipt.format).toBe('skydash-browser-csv-conversion-reproduction-v1');
  expect(receipt.expected_raw_digests_matched).toEqual({
    original: true,
    recipe: true,
    converted: true
  });
  for (const [key, value] of Object.entries(checked)) if (!['format', 'scope'].includes(key)) expect(receipt[key]).toEqual(value);
  // Inspect only this test's own bounded downloaded archive. No production extraction.
  const zip = fs.readFileSync(testInfo.outputPath('sensitive-originals.zip')),
    archiveEntries = [];
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const size = zip.readUInt32LE(offset + 22),
      length = zip.readUInt16LE(offset + 26),
      start = offset + 30 + length;
    archiveEntries.push([zip.subarray(offset + 30, start).toString('utf8'), zip.subarray(start, start + size)]);
    offset = start + size;
  }
  const builtZip = (await load('package-training-intake')).storedZip(archiveEntries);
  expect(zip.equals(builtZip)).toBe(true);
  const archived = new Map(archiveEntries);
  expect(archived.size).toBe(7);
  expect(archived.get('training/training.json').equals(fs.readFileSync(original))).toBe(true);
  for (const name of ['case.json', 'notebook.json', 'paired.json']) expect(archived.get('training/' + name).equals(fs.readFileSync(path.join(src, name)))).toBe(true);
  expect(archived.get('reports/intake-report.html').toString('utf8')).toBe(outputs['intake.html']);
  expect(archived.get('reports/READ-ME.txt').toString()).toContain('unencrypted');
  const extracted = path.join(folder, 'downloaded-originals');
  fs.mkdirSync(extracted);
  for (const [name, bytes] of archiveEntries.filter(([name]) => name.startsWith('training/'))) fs.writeFileSync(path.join(extracted, name.slice(9)), bytes, {
    flag: 'wx'
  });
  const rechecked = await (await load('verify-training-manifest')).verifyTrainingManifest(path.join(extracted, 'training.json'), {
    expectedSha256
  });
  expect(rechecked.bundle_count).toBe(3);
});
