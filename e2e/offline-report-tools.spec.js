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
test('all report drawers preserve prepared downloads and replay in one offline session', async ({
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
  await expect(groups.locator(':scope > details')).toHaveCount(17);
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
  await p.getByLabel('Go to local handoff task').selectOption('synthetic');
  await expect(p.getByRole('region', { name: 'Fixed synthetic handoff starter', exact: true })).toBeFocused();
  await expect(groups.locator(':scope > details[open]')).toHaveCount(1);
  await expect(p.getByRole('button', { name: 'Download synthetic starter ZIP', exact: true })).toBeDisabled();
  await p.getByLabel('Go to local handoff task').selectOption('private');
  await expect(p.getByRole('region', { name: 'Private original print tool', exact: true })).toBeFocused();
  await expect(panel.getByRole('button', { name: buttons.private, exact: true })).toBeEnabled();
  await p.getByLabel('Go to local handoff task').selectOption('originals');
  panel = p.getByRole('region', { name: 'Privacy-reduced intake print tool', exact: true });
  await expect(panel).toBeFocused();
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
  // Explicit partial instructor packet, never guessed from filenames or UI inventory.
  const checkedInventory=received.getByRole('region',{name:'Received ZIP checked original inventory',exact:true});
  await expect(checkedInventory).toContainText('Manifest original 1: case');
  await expect(checkedInventory).toContainText('Manifest original 2: notebook');
  await expect(checkedInventory).toContainText('Manifest original 3: paired');
  await checkedInventory.scrollIntoViewIfNeeded();
  await p.screenshot({path:testInfo.outputPath('received-original-index-desktop.png')});
  await p.setViewportSize({width:390,height:700});
  await checkedInventory.scrollIntoViewIfNeeded();
  await p.screenshot({path:testInfo.outputPath('received-original-index-mobile.png')});
  expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await p.setViewportSize({width:1440,height:1050});
  const agenda=received.getByRole('region',{name:'Received ZIP private discussion agenda',exact:true}),agendaAck=agenda.getByLabel('Acknowledge received private agenda'),agendaPrepare=agenda.getByRole('button',{name:'Prepare received private agenda',exact:true}),agendaSave=agenda.getByRole('button',{name:'Download private agenda HTML',exact:true});
  await expect(agendaPrepare).toBeDisabled();await agendaAck.check();await agendaPrepare.click();await expect(agendaSave).toBeEnabled();await expect(agendaAck).not.toBeChecked();await expect(receivedDownload).toBeEnabled();
  const agendaPending=p.waitForEvent('download');await agendaSave.click();const agendaDownload=await agendaPending;expect(agendaDownload.suggestedFilename()).toBe('skydash-private-discussion-agenda.html');await agendaDownload.saveAs(testInfo.outputPath('private-agenda.html'));
  await agendaSave.scrollIntoViewIfNeeded();await p.screenshot({path:testInfo.outputPath('private-agenda-tool-desktop.png')});await p.setViewportSize({width:390,height:700});await agenda.scrollIntoViewIfNeeded();await p.screenshot({path:testInfo.outputPath('private-agenda-tool-mobile.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await p.setViewportSize({width:1440,height:1050});
  await agendaAck.check();await expect(agendaSave).toBeDisabled();await agendaPrepare.click();await expect(agendaSave).toBeEnabled();await agenda.getByRole('button',{name:'Clear private agenda',exact:true}).click();await expect(agendaSave).toBeDisabled();await expect(receivedDownload).toBeEnabled();
  const recovered=received.getByRole('region',{name:'Received ZIP selected original download',exact:true});
  const recoveredOrdinal=recovered.getByLabel('Received ZIP download original ordinal'),recoveredAck=recovered.getByLabel('Acknowledge selected received original download'),recoveredCheck=recovered.getByRole('button',{name:'Check chosen original for download',exact:true}),recoveredSave=recovered.getByRole('button',{name:'Download chosen original JSON',exact:true});
  await expect(recoveredOrdinal).toHaveValue('');
  await expect(recoveredCheck).toBeDisabled();
  for(const [index,kind] of ['case','notebook','paired'].entries()){
    await recoveredOrdinal.fill(String(index+1));
    await expect(recoveredAck).not.toBeChecked();
    await recoveredAck.check();
    await recoveredCheck.click();
    await expect(recoveredSave).toBeEnabled();
    await expect(recoveredAck).not.toBeChecked();
    const save=p.waitForEvent('download');await recoveredSave.click();const output=await save;expect(output.suggestedFilename()).toBe('skydash-received-'+kind+'-original.json');const target=testInfo.outputPath('recovered-'+kind+'.json');await output.saveAs(target);expect(fs.readFileSync(target).equals(fs.readFileSync(path.join(src,kind+'.json')))).toBe(true);
  }
  await recoveredSave.scrollIntoViewIfNeeded();
  await p.screenshot({path:testInfo.outputPath('recovered-original-desktop.png')});
  await p.setViewportSize({width:390,height:700});await recoveredOrdinal.scrollIntoViewIfNeeded();await p.screenshot({path:testInfo.outputPath('recovered-original-mobile.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await p.setViewportSize({width:1440,height:1050});
  await recovered.getByLabel('Received ZIP download expected artifact SHA-256').fill('a'.repeat(64));await expect(recoveredSave).toBeDisabled();await recoveredAck.check();await recoveredCheck.click();await expect(recovered.getByLabel('Chosen original download status')).toContainText('Selected original refused');await expect(recoveredSave).toBeDisabled();await recovered.getByRole('button',{name:'Clear chosen original download',exact:true}).click();await expect(receivedDownload).toBeEnabled();
  const privateScope = received.getByLabel('Received ZIP private packet scope');
  await privateAck.check();
  await privateScope.selectOption('selected');
  await expect(checkedInventory).toContainText('Manifest original 2: notebook');
  await expect(privateAck).not.toBeChecked();
  const privateOrdinals = received.getByLabel('Received ZIP private packet ordinals');
  await privateAck.check();
  await expect(preparePrivateZip).toBeDisabled();
  await privateOrdinals.fill('1,1');
  await privateAck.check();
  await expect(preparePrivateZip).toBeDisabled();
  await privateOrdinals.fill('3,1');
  await expect(checkedInventory).toBeVisible();
  await expect(privateAck).not.toBeChecked();
  await privateAck.check();
  await preparePrivateZip.click();
  await expect(privateZipDownload).toBeEnabled();
  await expect(privateAck).not.toBeChecked();
  await expect(received.getByText('Private packet contains only original manifest ordinals 1, 3 of 3 listed originals.', {exact:false})).toBeVisible();
  const subsetPending = p.waitForEvent('download');
  await privateZipDownload.click();
  await (await subsetPending).saveAs(testInfo.outputPath('received-private-subset.html'));
  await privateScope.scrollIntoViewIfNeeded();
  await p.screenshot({path:testInfo.outputPath('received-private-subset-desktop.png')});
  await p.setViewportSize({width:390,height:700});
  await privateScope.scrollIntoViewIfNeeded();
  await p.screenshot({path:testInfo.outputPath('received-private-subset-mobile.png')});
  expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await privateOrdinals.fill('1');
  await expect(privateZipDownload).toBeDisabled();
  await expect(receivedDownload).toBeDisabled();
  await privateOrdinals.fill('3,1');
  await expect(privateZipDownload).toBeDisabled();
  await privateScope.selectOption('all');
  await expect(privateAck).not.toBeChecked();
  await p.setViewportSize({width:1440,height:1050});
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
  for (const side of ['Left', 'Right']) {
    await zipComparison.getByRole('button', { name: 'Check ' + side + ' ZIP original inventory', exact: true }).click();
    await expect(zipComparison.getByRole('region', { name: side + ' checked ZIP ordinal inventory', exact: true })).toContainText('Manifest original 3: paired.');
    await expect(zipComparisonDownload).toBeDisabled();
  }
  await expect(zipComparison.getByLabel('Received ZIP comparison scope')).toHaveValue('package');
  await zipComparison.getByRole('region', { name: 'Left checked ZIP ordinal inventory', exact: true }).scrollIntoViewIfNeeded();
  await p.screenshot({ path: testInfo.outputPath('zip-inventory-desktop.png') });
  await p.setViewportSize({ width: 390, height: 1000 });
  await zipComparison.getByRole('region', { name: 'Right checked ZIP ordinal inventory', exact: true }).scrollIntoViewIfNeeded();
  await p.screenshot({ path: testInfo.outputPath('zip-inventory-mobile.png') });
  expect(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await p.setViewportSize({ width: 1440, height: 1050 });
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
  for (const side of ['Left', 'Right']) await expect(zipComparison.getByRole('region', { name: side + ' checked ZIP ordinal inventory', exact: true })).toContainText('Manifest original 3: paired.');
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
  await expect(zipComparison.getByRole('region', { name: 'Left checked ZIP ordinal inventory', exact: true })).toContainText('Manifest original 1: case.');
  await expect(zipComparison.getByRole('region', { name: 'Right checked ZIP ordinal inventory', exact: true })).not.toContainText('Manifest original');
  await zipComparison.getByRole('button', { name: 'Check Right ZIP original inventory', exact: true }).click();
  await expect(zipComparison.getByRole('status')).toContainText('ZIP original inventory refused');
  await expect(zipComparison.getByRole('region', { name: 'Right checked ZIP ordinal inventory', exact: true })).not.toContainText('Manifest original');

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
  for (const [task, label] of [['synthetic', 'Fixed synthetic handoff starter'], ['received', 'Received original ZIP check'], ['recover', 'Received ZIP selected original download'], ['agenda', 'Received ZIP private discussion agenda'], ['packet', 'Received ZIP private discussion packet'], ['compare', 'Received ZIP snapshot comparison'], ['originals', 'Privacy-reduced intake print tool'], ['private', 'Private original print tool']]) {
    await p.getByLabel('Go to local handoff task').selectOption(task);
    await expect(p.getByRole('region', { name: label, exact: true })).toBeFocused();
    await expect(groups.locator(':scope > details[open]')).toHaveCount(1);
    await expect(p.getByLabel('Go to local handoff task')).toHaveValue('');
    if(['recover','agenda','packet'].includes(task))await p.screenshot({path:testInfo.outputPath('handoff-'+task+'-desktop.png')});
  }
  await p.screenshot({ path: testInfo.outputPath('handoff-navigation-desktop.png') });
  // Close the current disclosure so existing toggle-based manual navigation still starts closed.
  await p.getByText(titles.private, { exact: true }).click();
  for (const kind of ['private', 'intake', 'comparison', 'conversion', 'case', 'lineage', 'review']) {
    panel = await open(kind);
    await expect(panel.getByRole('button', {
      name: buttons[kind]
    })).toBeEnabled();
    if (kind === 'comparison') { await expect(zipComparisonDownload).toBeEnabled(); await expect(zipComparison.getByRole('region', { name: 'Left checked ZIP ordinal inventory', exact: true })).toContainText('Manifest original 1: case.'); }
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
  await p.setViewportSize({ width: 390, height: 1000 });
  for (const [task, label] of [['synthetic', 'Fixed synthetic handoff starter'], ['received', 'Received original ZIP check'], ['recover', 'Received ZIP selected original download'], ['agenda', 'Received ZIP private discussion agenda'], ['packet', 'Received ZIP private discussion packet'], ['compare', 'Received ZIP snapshot comparison']]) {
    await p.getByLabel('Go to local handoff task').selectOption(task);
    await expect(p.getByRole('region', { name: label, exact: true })).toBeFocused();
    await expect(groups.locator(':scope > details[open]')).toHaveCount(1);
    expect(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
  await p.screenshot({ path: testInfo.outputPath('handoff-navigation-mobile.png') });
  await p.setViewportSize({ width: 390, height: 700 });
  for (const [task, label] of [['synthetic', 'Fixed synthetic handoff starter'], ['received', 'Received original ZIP check'], ['recover', 'Received ZIP selected original download'], ['agenda', 'Received ZIP private discussion agenda'], ['packet', 'Received ZIP private discussion packet'], ['compare', 'Received ZIP snapshot comparison'], ['originals', 'Privacy-reduced intake print tool'], ['private', 'Private original print tool']]) {
    await p.getByLabel('Go to local handoff task').selectOption(task);
    await expect(p.getByRole('region', { name: label, exact: true })).toBeFocused();
    expect(await p.locator('main').first().evaluate(e => e.getBoundingClientRect().height >= 95 && e.getBoundingClientRect().bottom <= innerHeight + 1)).toBe(true);
    if(['recover','agenda','packet'].includes(task))await p.screenshot({path:testInfo.outputPath('handoff-'+task+'-small-mobile.png')});
    expect(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
  await p.screenshot({ path: testInfo.outputPath('handoff-navigation-small-mobile.png') });
  await p.setViewportSize({ width: 390, height: 1000 });
  await p.getByText(titles.private, { exact: true }).click();
  for (const kind of ['private', 'intake', 'comparison', 'conversion', 'case', 'lineage', 'review']) {
    panel = await open(kind);
    await expect(panel.getByRole('button', {
      name: buttons[kind]
    })).toBeEnabled();
    if (kind === 'comparison') { await expect(zipComparisonDownload).toBeEnabled(); await expect(zipComparison.getByRole('region', { name: 'Left checked ZIP ordinal inventory', exact: true })).toContainText('Manifest original 1: case.'); }
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
  for (const side of ['Left', 'Right']) await expect(zipComparison.getByRole('region', { name: side + ' checked ZIP ordinal inventory', exact: true })).not.toContainText('Manifest original');
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
  const caseOpener=p.getByRole('article',{name:'Portable review case',exact:true});
  await caseOpener.getByLabel('Open review case JSON',{exact:true}).setInputFiles(testInfo.outputPath('recovered-case.json'));
  await expect(caseOpener.getByRole('button',{name:'Replace local workspace with case',exact:true})).toBeVisible();
  await expect(p.getByLabel('Analyst notes',{exact:true})).toHaveValue('PRIVATE active replay notes remain');
  await caseOpener.getByRole('button',{name:'Keep current workspace',exact:true}).click();
  await expect(caseOpener).toContainText('Case opening cancelled. Current workspace kept.');
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
  const agendaHtml=fs.readFileSync(testInfo.outputPath('private-agenda.html'),'utf8');expect(agendaHtml).toBe(await(await load('report-training-agenda')).reportTrainingAgenda(original,{includePrivateReview:true,expectedSha256}));expect(agendaHtml).toContain('SYNTHETIC discussion prompt');expect(agendaHtml).toContain('Not applicable');expect(agendaHtml).not.toContain('SYNTHETIC instructor example');expect(agendaHtml).not.toContain('SYNTHETIC analyst discussion');
  const agendaPage=await c.newPage();await agendaPage.setContent(agendaHtml);await agendaPage.setViewportSize({width:1100,height:900});await agendaPage.screenshot({path:testInfo.outputPath('private-agenda-report-desktop.png'),fullPage:true});await agendaPage.setViewportSize({width:390,height:700});await agendaPage.screenshot({path:testInfo.outputPath('private-agenda-report-mobile.png'),fullPage:true});expect(await agendaPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await agendaPage.emulateMedia({media:'print'});await agendaPage.pdf({path:testInfo.outputPath('private-agenda-report.pdf'),format:'A4',printBackground:true});await agendaPage.close();
  const subsetHtml=fs.readFileSync(testInfo.outputPath('received-private-subset.html'),'utf8');
  expect(subsetHtml).toBe(await (await load('report-private-training')).reportPrivateTraining(original,{includePrivateReview:true,expectedSha256,selectedOrdinals:[1,3]}));
  expect(subsetHtml).toContain('Explicit subset: 2 of 3');
  expect(subsetHtml).not.toContain('Bundle 2: notebook');
  expect(subsetHtml).not.toContain('Bundle 2 source');
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
  // Recovered originals must also reopen and re-export through their real UI, not just compare bytes.
  // Each test-owned tab starts empty; the active review tab above is never replaced.
  for (const kind of ['case','notebook','paired']) {
    await c.setOffline(false);
    const reopen=await c.newPage(),effects=[],unexpected=[],pageErrors=[];
    reopen.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))unexpected.push(r.url());});reopen.on('pageerror',e=>pageErrors.push(e.message));
    await reopen.addInitScript(()=>{window.recoveryEffects=[];for(const[proto,key,label]of[[Storage.prototype,'setItem','storage'],[IDBFactory.prototype,'open','idb'],[window,'fetch','fetch']]){const old=proto[key];proto[key]=function(...args){window.recoveryEffects.push(label);return old.apply(this,args);};}});
    await reopen.goto(origin+'offline-review.html');await c.setOffline(true);
    const sourceFile=testInfo.outputPath('recovered-'+kind+'.json'),before=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
    const labels={case:['Portable review case','Open review case JSON','Expected case artifact SHA-256','Replace local workspace with case','Keep current workspace','Download review case JSON'],notebook:['Portable notebook source bundle','Open notebook source bundle JSON','Expected notebook artifact SHA-256','Replace local workspace with notebook bundle','Keep current workspace and notebook','Download notebook source bundle JSON'],paired:['Paired review source bundle','Open paired review bundle JSON','Expected paired artifact SHA-256','Replace workspace with checked paired review','Keep current workspace and sources','Download paired review bundle JSON']}[kind];
    let opener=reopen.getByRole('article',{name:labels[0],exact:true});
    await opener.getByLabel(labels[2],{exact:true}).fill('a'.repeat(64));await opener.getByLabel(labels[1],{exact:true}).setInputFiles(sourceFile);await expect(opener.getByRole('alert')).toBeVisible();await expect(reopen.getByLabel('Replay position',{exact:true})).toHaveCount(0);
    await opener.getByLabel(labels[2],{exact:true}).fill(pin(sourceFile));await opener.getByLabel(labels[1],{exact:true}).setInputFiles(sourceFile);await expect(opener.getByRole('button',{name:labels[3],exact:true})).toBeVisible();await expect(reopen.getByLabel('Replay position',{exact:true})).toHaveCount(0);
    await opener.getByRole('button',{name:labels[4],exact:true}).click();await expect(reopen.getByLabel('Replay position',{exact:true})).toHaveCount(0);
    await opener.getByLabel(labels[1],{exact:true}).setInputFiles(sourceFile);await opener.getByRole('button',{name:labels[3],exact:true}).click();await expect(reopen.getByLabel('Replay position',{exact:true})).toHaveValue('0');
    if(kind==='paired')await expect(reopen.getByLabel('Comparison time',{exact:true})).toHaveValue('0');
    if(kind==='notebook'){await expect(reopen.getByRole('button',{name:'Load saved selection: '+before.notebook.windows[0].label,exact:true})).toBeVisible();await expect(reopen.getByLabel('Reviewed sample window',{exact:true})).toHaveCount(0);}
    const saved=reopen.waitForEvent('download');await reopen.getByRole('button',{name:labels[5],exact:true}).click();const target=testInfo.outputPath('roundtrip-'+kind+'.json');await(await saved).saveAs(target);expect(JSON.parse(fs.readFileSync(target,'utf8'))).toEqual(before);
    await reopen.getByLabel('Replay position',{exact:true}).scrollIntoViewIfNeeded();await reopen.screenshot({path:testInfo.outputPath('roundtrip-'+kind+'-desktop.png')});await reopen.setViewportSize({width:390,height:700});await reopen.getByLabel('Replay position',{exact:true}).scrollIntoViewIfNeeded();await reopen.screenshot({path:testInfo.outputPath('roundtrip-'+kind+'-mobile.png')});expect(await reopen.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    effects.push(...await reopen.evaluate(()=>window.recoveryEffects));expect(effects).toEqual([]);expect(unexpected).toEqual([]);expect(pageErrors).toEqual([]);await reopen.close();
  }
  await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');await expect(p.getByLabel('Analyst notes',{exact:true})).toHaveValue('PRIVATE active replay notes remain');

});

test('instructor discussion queue filters and pages without losing full case exports', async ({page:p,context:c},testInfo)=>{
  test.setTimeout(60000);
  const input=JSON.parse(fs.readFileSync(src+'/case.json','utf8'));
  input.debrief.markers=Array.from({length:24},(_,i)=>({id:'queue-'+String(i).padStart(2,'0'),time_s:i/2,kind:i===0?'Observation':i===1?'Follow-up':'Question',text:i===3?'<b>Literal instructor note, not HTML</b>':'Fixed fabricated discussion '+i,discussed:i===2}));
  input.debrief.notes='Fixed fabricated full discussion summary';
  const fixture=testInfo.outputPath('queue-case.json');fs.writeFileSync(fixture,JSON.stringify(input));
  const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});
  await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const original=proto[name];proto[name]=function(...args){window.effects.push(name);return original.apply(this,args);};}});
  await p.goto(origin+'offline-review.html');await c.setOffline(true);
  const portable=p.getByRole('article',{name:'Portable review case',exact:true});
  await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(fixture);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();
  await p.getByLabel('Visible review panel group').selectOption('debrief');
  const timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true}),queue=timeline.getByRole('region',{name:'Instructor discussion queue controls',exact:true});
  const output=async name=>{const wait=p.waitForEvent('download');await portable.getByRole('button',{name:'Download review case JSON',exact:true}).click();const target=testInfo.outputPath(name);await(await wait).saveAs(target);return JSON.parse(fs.readFileSync(target,'utf8'));};
  await p.getByLabel('Replay position',{exact:true}).fill('8');
  await queue.getByLabel('Instructor timeline view').selectOption('open');await expect(queue).toContainText('Showing 1 to 10 of 22');
  await expect(timeline.getByRole('list',{name:'Instructor review markers',exact:true}).getByRole('listitem')).toHaveCount(10);
  await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(p.getByRole('button',{name:'Play replay',exact:true})).toBeVisible();
  expect(await output('queue-unchanged-case.json')).toEqual(input);
  await expect(timeline.getByText('<b>Literal instructor note, not HTML</b>',{exact:true})).toBeVisible();await expect(timeline.locator('b')).toHaveCount(0);
  await queue.getByRole('button',{name:'Next marker page'}).click();await queue.getByRole('button',{name:'Next marker page'}).click();await expect(queue).toContainText('Showing 21 to 22 of 22');
  await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');
  await timeline.getByRole('button',{name:'Jump to 11.0s',exact:true}).click();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('11');
  await timeline.getByLabel('Discussed at 11.0s',{exact:true}).click();await timeline.getByLabel('Discussed at 11.5s',{exact:true}).click();await expect(queue).toContainText('Showing 11 to 20 of 20');
  await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('11');
  const edited=await output('queue-edited-case.json');input.debrief.markers[22].discussed=true;input.debrief.markers[23].discussed=true;expect(edited).toEqual(input);
  await queue.getByLabel('Instructor timeline view').selectOption('followups');await expect(queue).toContainText('Showing 1 to 1 of 1');
  await timeline.getByLabel('Discussed at 0.5s',{exact:true}).click();await expect(timeline).toContainText('No markers match this view');
  await queue.getByLabel('Instructor timeline view').selectOption('all');await expect(timeline.getByLabel('Discussed at 0.5s',{exact:true})).toBeChecked();await timeline.getByLabel('Discussed at 0.5s',{exact:true}).uncheck();
  await queue.getByLabel('Instructor timeline view').selectOption('questions');
  await p.getByLabel('Visible review panel group').selectOption('source');await p.getByLabel('Visible review panel group').selectOption('debrief');await expect(queue.getByLabel('Instructor timeline view')).toHaveValue('questions');
  await timeline.getByLabel('Import debrief JSON').setInputFiles({name:'queue-sidecar.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(edited.debrief))});await expect(timeline.getByRole('button',{name:'Replace with imported review',exact:true})).toBeVisible();
  await expect(queue.getByLabel('Instructor timeline view')).toBeDisabled();await expect(timeline.getByRole('button',{name:'Jump to 1.5s',exact:true})).toBeDisabled();await timeline.getByRole('button',{name:'Keep current review',exact:true}).click();
  await expect(queue.getByLabel('Instructor timeline view')).toHaveValue('questions');expect(await output('queue-canceled-preview-case.json')).toEqual(edited);
  for(const[width,height,name]of[[1280,1000,'desktop'],[390,900,'mobile']]){await p.setViewportSize({width,height});await queue.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('discussion-queue-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
  await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(testInfo.outputPath('queue-edited-case.json'));await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();
  await p.getByLabel('Visible review panel group').selectOption('debrief');await expect(queue.getByLabel('Instructor timeline view')).toHaveValue('all');await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('0');expect(await output('queue-reopened-case.json')).toEqual(edited);
  expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('instructor sidecar replacement exposes before and after without applying until confirmation',async({page:p,context:c},testInfo)=>{
  test.setTimeout(60000);
  const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8'));
  const marker={id:'same',time_s:0,kind:'Question',text:'Fixed fabricated unchanged note',discussed:false};
  original.debrief.markers=[marker,{...marker,id:'change',time_s:2,text:'Fixed fabricated before note'},{...marker,id:'remove',time_s:8,text:'Fixed fabricated removed note'}];original.debrief.notes='Fixed fabricated old summary';
  const incoming={...original.debrief,markers:[marker,{...marker,id:'new',time_s:1,text:'Fixed fabricated added note'},{...marker,id:'change',time_s:4,kind:'Follow-up',text:'<b>Literal imported annotation</b>',discussed:true}],notes:'Fixed fabricated imported summary'};
  const file=testInfo.outputPath('before-case.json');fs.writeFileSync(file,JSON.stringify(original));
  const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});
  await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
  await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(file);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();
  const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');await pair.getByLabel('Comparison notes',{exact:true}).fill('Unchanged comparison notes');await p.getByLabel('Replay position',{exact:true}).fill('8');await p.getByLabel('Visible review panel group').selectOption('debrief');
  const timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true}),preview=timeline.getByRole('region',{name:'Instructor sidecar replacement differences',exact:true});
  await timeline.getByLabel('Instructor marker note').fill('Unadded draft kept until explicit Replace');
  const upload=()=>timeline.getByLabel('Import debrief JSON').setInputFiles({name:'incoming.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});
  await upload();await expect(preview.getByLabel('Instructor replacement counts')).toContainText('Added 1; removed 1; changed 1; unchanged 1');await expect(preview).toContainText('unadded marker draft is present');await expect(preview.getByText('<b>Literal imported annotation</b>',{exact:true})).toBeVisible();await expect(preview.locator('b')).toHaveCount(0);await expect(timeline.getByLabel('Discussion summary')).toHaveValue(original.debrief.notes);
  await timeline.getByLabel('Discussion summary').fill('Edited current summary');await expect(preview).toContainText('Before summary: Edited current summary');
  const download=p.waitForEvent('download');await timeline.getByRole('button',{name:'Download instructor replacement comparison',exact:true}).click();const report=testInfo.outputPath('instructor-replacement.txt');await(await download).saveAs(report);const text=fs.readFileSync(report,'utf8');expect(text).toContain('BEFORE summary: Edited current summary');expect(text).toContain('AFTER summary: '+incoming.notes);expect(text).toContain('Fixed fabricated removed note');expect(text).toContain('<b>Literal imported annotation</b>');expect(text).not.toContain(original.source.csv_text);expect(text).not.toContain('Unadded draft kept until explicit Replace');
  for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await preview.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('instructor-replacement-'+name+'.png')});await preview.getByRole('list',{name:'All instructor replacement annotations'}).evaluate(e=>{e.scrollTop=e.scrollHeight;e.scrollIntoView({block:'start'});});await p.screenshot({path:testInfo.outputPath('instructor-replacement-'+name+'-rows.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
  await timeline.getByRole('button',{name:'Keep current review',exact:true}).click();await expect(preview).toHaveCount(0);await expect(timeline.getByLabel('Instructor marker note')).toHaveValue('Unadded draft kept until explicit Replace');await expect(timeline.getByLabel('Discussion summary')).toHaveValue('Edited current summary');await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');
  await timeline.getByLabel('Instructor marker note').fill('');await upload();await timeline.getByRole('button',{name:'Replace with imported review',exact:true}).click();await expect(preview).toHaveCount(0);await expect(timeline.getByLabel('Discussion summary')).toHaveValue(incoming.notes);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');await expect(pair.getByLabel('Comparison notes',{exact:true})).toHaveValue('Unchanged comparison notes');
  const wait=p.waitForEvent('download');await portable.getByRole('button',{name:'Download review case JSON',exact:true}).click();const result=testInfo.outputPath('after-case.json');await(await wait).saveAs(result);expect(JSON.parse(fs.readFileSync(result,'utf8'))).toEqual({...original,debrief:incoming});
  expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('saved instructor marker correction keeps identity time and discussion state and blocks draft export',async({page:p,context:c},testInfo)=>{
  test.setTimeout(60000);const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8'));original.debrief.markers=[{id:'keep-id',time_s:8,kind:'Question',text:'Fixed fabricated original note',discussed:false},{id:'other',time_s:8,kind:'Question',text:'Separate same-time note',discussed:true}];original.debrief.notes='Keep original summary';
  const file=testInfo.outputPath('marker-before.json');fs.writeFileSync(file,JSON.stringify(original));const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});
  await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
  await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(file);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();
  const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');await p.getByLabel('Replay position',{exact:true}).fill('8');await p.getByLabel('Visible review panel group').selectOption('debrief');
  const timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true}),queue=timeline.getByRole('region',{name:'Instructor discussion queue controls',exact:true}),editor=timeline.getByRole('region',{name:'Edit saved instructor marker',exact:true});
  await queue.getByLabel('Instructor timeline view').selectOption('questions');await timeline.getByRole('button',{name:'Edit marker at 8.0s',exact:true}).click();await expect(editor.getByLabel('Edited marker note')).toBeFocused();
  await editor.getByLabel('Edited marker note').fill('  <b>Corrected instructor note</b>  ');await editor.getByLabel('Edited marker kind').selectOption('Follow-up');await expect(timeline.getByLabel('Instructor timeline view')).toBeDisabled();await expect(timeline.getByLabel('Import debrief JSON')).toBeDisabled();await expect(timeline.getByRole('button',{name:'Download debrief JSON',exact:true})).toBeDisabled();
  await portable.getByRole('button',{name:'Download review case JSON',exact:true}).click();await expect(portable.getByRole('alert')).toContainText('Save or cancel the instructor marker edit');
  for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await editor.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('marker-edit-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
  await p.getByLabel('Visible review panel group').selectOption('source');await p.getByLabel('Visible review panel group').selectOption('debrief');await expect(editor.getByLabel('Edited marker note')).toHaveValue('  <b>Corrected instructor note</b>  ');
  await editor.getByRole('button',{name:'Cancel marker edit',exact:true}).click();await expect(timeline.getByText('Fixed fabricated original note',{exact:true})).toBeVisible();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');
  await timeline.getByRole('button',{name:'Edit marker at 8.0s',exact:true}).click();await editor.getByLabel('Edited marker note').fill('<b>Corrected instructor note</b>');await editor.getByLabel('Edited marker kind').selectOption('Follow-up');await editor.getByRole('button',{name:'Save marker edit',exact:true}).click();await expect(timeline).toContainText('No markers match this view');
  await queue.getByLabel('Instructor timeline view').selectOption('open');await expect(timeline.getByText('<b>Corrected instructor note</b>',{exact:true})).toBeVisible();await expect(timeline.locator('b')).toHaveCount(0);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');
  const wait=p.waitForEvent('download');await portable.getByRole('button',{name:'Download review case JSON',exact:true}).click();const result=testInfo.outputPath('marker-after.json');await(await wait).saveAs(result);original.debrief.markers[0].kind='Follow-up';original.debrief.markers[0].text='<b>Corrected instructor note</b>';expect(JSON.parse(fs.readFileSync(result,'utf8'))).toEqual(original);
  await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(result);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Visible review panel group').selectOption('debrief');await expect(editor).toHaveCount(0);await expect(timeline.getByText('<b>Corrected instructor note</b>',{exact:true})).toBeVisible();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('0');
  expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('instructor marker removal previews exact original and requires confirmation without same-time loss',async({page:p,context:c},testInfo)=>{
  test.setTimeout(60000);const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8'));original.debrief.markers=[{id:'first',time_s:8,kind:'Question',text:'<b>Fixed fabricated removal candidate</b>',discussed:false},{id:'second',time_s:8,kind:'Follow-up',text:'Separate same-time instructor note',discussed:false}];original.debrief.notes='Keep original summary';
  const file=testInfo.outputPath('remove-before.json');fs.writeFileSync(file,JSON.stringify(original));const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});
  await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
  await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(file);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();
  const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');await p.getByLabel('Replay position',{exact:true}).fill('8');await p.getByLabel('Visible review panel group').selectOption('debrief');
  const timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true}),preview=timeline.getByRole('region',{name:'Remove saved instructor marker preview',exact:true}),list=timeline.getByRole('list',{name:'Instructor review markers',exact:true});
  await timeline.getByLabel('Instructor timeline view').selectOption('questions');await list.getByRole('button',{name:'Remove marker at 8.0s',exact:true}).click();await expect(preview.getByRole('heading')).toBeFocused();await expect(preview).toContainText('ID first, original 8s, Question, discussed false');await expect(list.getByText('<b>Fixed fabricated removal candidate</b>',{exact:true})).toBeVisible();await expect(preview.locator('b')).toHaveCount(0);await expect(timeline.getByLabel('Instructor timeline view')).toBeDisabled();await expect(timeline.getByLabel('Import debrief JSON')).toBeDisabled();
  await portable.getByRole('button',{name:'Download review case JSON',exact:true}).click();await expect(portable.getByRole('alert')).toContainText('Confirm or cancel instructor marker removal');
  for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await preview.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('marker-removal-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
  await preview.getByRole('button',{name:'Keep instructor marker',exact:true}).click();const download=async name=>{const wait=p.waitForEvent('download');await portable.getByRole('button',{name:'Download review case JSON',exact:true}).click();const target=testInfo.outputPath(name);await(await wait).saveAs(target);return JSON.parse(fs.readFileSync(target,'utf8'));};expect(await download('remove-canceled.json')).toEqual(original);
  await list.getByRole('button',{name:'Remove marker at 8.0s',exact:true}).click();await preview.getByRole('button',{name:'Confirm remove instructor marker',exact:true}).click();await expect(timeline).toContainText('No markers match this view');await timeline.getByLabel('Instructor timeline view').selectOption('all');await expect(list.getByText('Separate same-time instructor note',{exact:true})).toBeVisible();await expect(list.getByRole('listitem')).toHaveCount(1);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');original.debrief.markers.shift();expect(await download('remove-after.json')).toEqual(original);
  expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});


test('instructor marker source context reads original gap neighbors and preserves exact review with explicit-only seek',async({page:p,context:c},testInfo)=>{
  test.setTimeout(60000);const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8'));original.debrief.markers=[{id:'inspect',time_s:8,kind:'Question',text:'<b>Fabricated context note</b>',discussed:false}];original.debrief.notes='Keep source discussion';const file=testInfo.outputPath('context-before.json');fs.writeFileSync(file,JSON.stringify(original));const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});
  await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
  await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(file);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');await p.getByLabel('Replay position',{exact:true}).fill('8');await p.getByLabel('Visible review panel group').selectOption('debrief');
  const timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true}),panel=timeline.getByRole('region',{name:'Instructor marker source context',exact:true});await timeline.getByLabel('Instructor marker note',{exact:true}).fill('Unadded private draft');await timeline.getByRole('button',{name:'Inspect source at marker 8.0s',exact:true}).click();await expect(panel.getByRole('heading')).toBeFocused();await expect(panel).toContainText('Marker is between observations');await expect(panel).toContainText('DATA GAP over 5s');await expect(panel.getByRole('listitem')).toHaveCount(3);await expect(panel).toContainText('CSV data row 3 / original 4s / held row before marker');await expect(panel).toContainText('CSV data row 4 / original 12s / next source row');await expect(panel.locator('b')).toHaveCount(0);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(timeline.getByLabel('Instructor marker note',{exact:true})).toHaveValue('Unadded private draft');
  for(const[width,height,name]of[[1280,1050,'desktop'],[390,1050,'mobile']]){await p.setViewportSize({width,height});await panel.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('marker-context-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
  await timeline.getByRole('button',{name:'Edit marker at 8.0s',exact:true}).click();await expect(panel.getByRole('button',{name:'Jump to context row 4 at 12s',exact:true})).toBeDisabled();await timeline.getByRole('button',{name:'Cancel marker edit',exact:true}).click();await panel.getByRole('button',{name:'Jump to context row 4 at 12s',exact:true}).click();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('12');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');await panel.getByRole('button',{name:'Close marker source context',exact:true}).click();await expect(panel).toHaveCount(0);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('12');await timeline.getByLabel('Instructor marker note',{exact:true}).fill('');const wait=p.waitForEvent('download');await portable.getByRole('button',{name:'Download review case JSON',exact:true}).click();const target=testInfo.outputPath('context-after.json');await(await wait).saveAs(target);expect(JSON.parse(fs.readFileSync(target,'utf8'))).toEqual(original);expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});


test('instructor saved-note search combines with queue and preserves all hidden original case notes',async({page:p,context:c},testInfo)=>{
  test.setTimeout(60000);const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8'));original.debrief.markers=Array.from({length:24},(_,i)=>({id:'note-'+String(i).padStart(2,'0'),time_s:i/2,kind:i===1?'Follow-up':'Question',text:i%2?'Needle note '+i:'Other note '+i,discussed:false}));original.debrief.notes='Private complete summary';const file=testInfo.outputPath('search-original.json');fs.writeFileSync(file,JSON.stringify(original));const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
  await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(file);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');await p.getByLabel('Visible review panel group').selectOption('debrief');const timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true}),list=timeline.getByRole('list',{name:'Instructor review markers',exact:true}),search=timeline.getByLabel('Find saved instructor note text',{exact:true});await timeline.getByRole('button',{name:'Next marker page',exact:true}).click();await expect(timeline).toContainText('Showing 11 to 20 of 24');await search.fill(' NEEDLE ');await expect(timeline).toContainText('Showing 1 to 10 of 12');await expect(list.getByText('Other note 0',{exact:true})).toHaveCount(0);await expect(list.getByRole('listitem')).toHaveCount(10);await timeline.getByRole('button',{name:'Next marker page',exact:true}).click();await expect(list.getByRole('listitem')).toHaveCount(2);await timeline.getByLabel('Instructor timeline view').selectOption('followups');await expect(list.getByRole('listitem')).toHaveCount(1);await expect(list.getByText('Needle note 1',{exact:true})).toBeVisible();
  for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await search.scrollIntoViewIfNeeded();await p.screenshot({path:testInfo.outputPath('marker-search-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
  const wait=p.waitForEvent('download');await portable.getByRole('button',{name:'Download review case JSON',exact:true}).click();const target=testInfo.outputPath('search-filtered-full.json');await(await wait).saveAs(target);expect(JSON.parse(fs.readFileSync(target,'utf8'))).toEqual(original);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await search.fill('not in any saved note');await expect(timeline).toContainText('No markers match this view');await search.fill('');await timeline.getByLabel('Instructor timeline view').selectOption('all');await expect(timeline).toContainText('Showing 1 to 10 of 24');expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});


test('instructor recovery restores exact saved review after removal and clear without losing draft or moving clocks',async({page:p,context:c},testInfo)=>{
  test.setTimeout(60000);const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8'));original.debrief.markers=[{id:'first',time_s:8,kind:'Question',text:'<b>Fabricated recovery note</b>',discussed:false},{id:'second',time_s:8,kind:'Follow-up',text:'Separate same-time recovery note',discussed:true}];original.debrief.notes='Private original summary';const file=testInfo.outputPath('recovery-original.json');fs.writeFileSync(file,JSON.stringify(original));const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
  await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(file);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');await p.getByLabel('Replay position',{exact:true}).fill('8');await p.getByLabel('Visible review panel group').selectOption('debrief');const timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true}),recovery=timeline.getByRole('region',{name:'Previous instructor review recovery',exact:true}),list=timeline.getByRole('list',{name:'Instructor review markers',exact:true});await expect(recovery.getByRole('button',{name:'Preview previous instructor review',exact:true})).toBeDisabled();await list.getByRole('button',{name:'Remove marker at 8.0s',exact:true}).first().click();await timeline.getByRole('button',{name:'Confirm remove instructor marker',exact:true}).click();await timeline.getByLabel('Discussion summary',{exact:true}).fill('Current private summary to replace');await timeline.getByLabel('Instructor marker note',{exact:true}).fill('Retain unadded draft');await recovery.getByRole('button',{name:'Preview previous instructor review',exact:true}).click();const preview=timeline.getByLabel('Instructor recovery before and after',{exact:true});await expect(preview).toContainText('Before summary: Current private summary to replace');await expect(preview).toContainText('After summary: Private original summary');await expect(preview.getByText('<b>Fabricated recovery note</b>',{exact:true})).toBeVisible();await expect(preview.locator('b')).toHaveCount(0);
  for(const[width,height,name]of[[1280,1050,'desktop'],[390,1050,'mobile']]){await p.setViewportSize({width,height});await preview.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('instructor-recovery-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
  await timeline.getByLabel('Discussion summary',{exact:true}).fill('Changed after preview');await recovery.getByRole('button',{name:'Confirm restore instructor review',exact:true}).click();await expect(recovery.getByRole('alert')).toContainText('state changed');await expect(list.getByRole('listitem')).toHaveCount(1);await recovery.getByRole('button',{name:'Preview previous instructor review',exact:true}).click();await recovery.getByRole('button',{name:'Confirm restore instructor review',exact:true}).click();await expect(list.getByRole('listitem')).toHaveCount(2);await expect(timeline.getByLabel('Instructor marker note',{exact:true})).toHaveValue('Retain unadded draft');await expect(recovery.getByRole('button',{name:'Preview previous instructor review',exact:true})).toBeDisabled();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');await timeline.getByLabel('Instructor marker note',{exact:true}).fill('');
  const download=async name=>{const wait=p.waitForEvent('download');await portable.getByRole('button',{name:'Download review case JSON',exact:true}).click();const target=testInfo.outputPath(name);await(await wait).saveAs(target);return JSON.parse(fs.readFileSync(target,'utf8'));};expect(await download('recovered-case.json')).toEqual(original);await timeline.getByRole('button',{name:'Clear instructor review',exact:true}).click();await timeline.getByRole('button',{name:'Confirm clear review',exact:true}).click();await expect(list.getByRole('listitem')).toHaveCount(0);await recovery.getByRole('button',{name:'Preview previous instructor review',exact:true}).click();await recovery.getByRole('button',{name:'Confirm restore instructor review',exact:true}).click();expect(await download('clear-recovered-case.json')).toEqual(original);expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});


test('packaged instructor originals independently unzip then explicitly restore source and review offline',async({page:p,context:c},testInfo)=>{
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),directory=testInfo.outputPath('instructor-originals');fs.mkdirSync(directory,{recursive:true});
 const source=path.join(directory,'source.csv'),sidecar=path.join(directory,'sidecar.json'),archive=path.join(directory,'sensitive.zip'),extracted=path.join(directory,'extracted');
 original.debrief.markers=[{id:'fixed-a',time_s:8,kind:'Question',text:'Fixed fabricated handoff note',discussed:false},{id:'fixed-b',time_s:8,kind:'Follow-up',text:'Independent same-time note',discussed:true}];original.debrief.notes='Fixed fabricated handoff summary';fs.writeFileSync(source,original.source.csv_text);fs.writeFileSync(sidecar,JSON.stringify(original.debrief));
 const receipt=JSON.parse(execFileSync(process.execPath,['scripts/package-instructor-review.mjs',source,sidecar,'--include-sensitive-originals','--output',archive],{cwd:root,encoding:'utf8'}));expect(receipt.file_count).toBe(4);
 // Independently inspect CRC and extract only this test's own newly generated fixed archive.
 execFileSync('python',['-c','import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.namelist()==["originals/source.csv","originals/instructor.json","validation.json","HANDOFF.txt"]; z.extractall(sys.argv[2])',archive,extracted]);
 expect(fs.readFileSync(path.join(extracted,'originals/source.csv'))).toEqual(fs.readFileSync(source));expect(fs.readFileSync(path.join(extracted,'originals/instructor.json'))).toEqual(fs.readFileSync(sidecar));
 const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.goto(origin+'offline-review.html');await c.setOffline(true);
 await p.getByLabel('Choose flight CSV',{exact:true}).setInputFiles(path.join(extracted,'originals/source.csv'));await p.getByLabel('Visible review panel group').selectOption('debrief');const timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true});
 await timeline.getByLabel('Import debrief JSON').setInputFiles(path.join(extracted,'originals/instructor.json'));await expect(timeline.getByRole('button',{name:'Replace with imported review',exact:true})).toBeVisible();await expect(timeline.getByLabel('Discussion summary')).toHaveValue('');
 await timeline.getByRole('button',{name:'Replace with imported review',exact:true}).click();await expect(timeline.getByLabel('Discussion summary')).toHaveValue(original.debrief.notes);await expect(timeline.getByText('Fixed fabricated handoff note',{exact:true})).toBeVisible();await expect(timeline.getByText('Independent same-time note',{exact:true})).toBeVisible();expect(await timeline.getByLabel('Discussed at 8.0s',{exact:true}).count()).toBe(2);
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await timeline.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('instructor-handoff-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 await timeline.getByText('Fixed fabricated handoff note',{exact:true}).evaluate(e=>e.scrollIntoView({block:'center'}));await p.screenshot({path:testInfo.outputPath('instructor-handoff-mobile-notes.png')});
 const waiting=p.waitForEvent('download');await timeline.getByRole('button',{name:'Download debrief JSON',exact:true}).click();const saved=testInfo.outputPath('restored-sidecar.json');await(await waiting).saveAs(saved);expect(JSON.parse(fs.readFileSync(saved,'utf8'))).toEqual(original.debrief);expect(errors).toEqual([]);expect(requests).toEqual([]);
});


test('standalone instructor pair ZIP prepares only after consent and downloaded originals reopen exactly without changing replay',async({page:p,context:c},testInfo)=>{
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8'));original.debrief.markers=[{id:'fixed-a',time_s:8,kind:'Question',text:'Fixed fabricated browser handoff note',discussed:false},{id:'fixed-b',time_s:8,kind:'Follow-up',text:'Fixed fabricated independent same-time note',discussed:true}];original.debrief.notes='Fixed fabricated browser handoff summary';const sidecar=JSON.stringify(original.debrief,null,2)+'\n';
 const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
 await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true}),sourceCase=testInfo.outputPath('original-case.json');fs.writeFileSync(sourceCase,JSON.stringify(original));await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(sourceCase);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');
 await p.getByLabel('Go to local handoff task').selectOption('instructor');const tool=p.getByRole('region',{name:'Instructor original pair handoff',exact:true}),download=tool.getByRole('button',{name:'Download instructor originals ZIP',exact:true}),prepare=tool.getByRole('button',{name:'Validate and prepare instructor originals ZIP',exact:true});
 await expect(tool).toBeFocused();await expect(download).toBeDisabled();await tool.getByLabel('Instructor handoff source file',{exact:true}).setInputFiles({name:'PRIVATE.csv',mimeType:'text/csv',buffer:Buffer.from(original.source.csv_text)});await tool.getByLabel('Instructor handoff sidecar file',{exact:true}).setInputFiles({name:'PRIVATE.json',mimeType:'application/json',buffer:Buffer.from(sidecar)});await expect(prepare).toBeDisabled();await tool.getByLabel('Acknowledge sensitive instructor originals ZIP').check();await prepare.click();await expect(download).toBeEnabled();await expect(tool.getByLabel('Acknowledge sensitive instructor originals ZIP')).not.toBeChecked();await expect(prepare).toBeDisabled();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');
 await p.getByLabel('Go to local handoff task').selectOption('compare');await p.getByLabel('Go to local handoff task').selectOption('instructor');await expect(download).toBeEnabled();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');
 const inventory=tool.getByRole('region',{name:'Validated instructor pair inventory',exact:true});await expect(inventory).not.toContainText('PRIVATE');await expect(inventory).toContainText('2 saved instructor annotations');for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await tool.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('browser-instructor-handoff-'+name+'.png')});await inventory.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('browser-instructor-handoff-'+name+'-inventory.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const waiting=p.waitForEvent('download');await download.click();const saved=testInfo.outputPath('browser-instructor.zip');await(await waiting).saveAs(saved);const extracted=testInfo.outputPath('browser-instructor-extracted');execFileSync('python',['-c','import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.namelist()==["originals/source.csv","originals/instructor.json","validation.json","HANDOFF.txt"]; z.extractall(sys.argv[2])',saved,extracted]);expect(fs.readFileSync(path.join(extracted,'originals/source.csv'),'utf8')).toBe(original.source.csv_text);expect(fs.readFileSync(path.join(extracted,'originals/instructor.json'),'utf8')).toBe(sidecar);
 const receipt=JSON.parse(execFileSync(process.execPath,['scripts/verify-instructor-sidecar.mjs',path.join(extracted,'originals/source.csv'),path.join(extracted,'originals/instructor.json')],{cwd:root,encoding:'utf8'}));expect(receipt.saved_markers).toBe(2);
 await tool.getByLabel('Instructor handoff source expected SHA-256').fill('e'.repeat(64));await expect(download).toBeDisabled();await tool.getByLabel('Instructor handoff source expected SHA-256').fill('');await expect(download).toBeDisabled();await expect(tool.getByLabel('Acknowledge sensitive instructor originals ZIP')).not.toBeChecked();await tool.getByRole('button',{name:'Clear instructor originals handoff',exact:true}).click();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await p.getByLabel('Visible review panel group').selectOption('debrief');const timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true});await expect(timeline.getByLabel('Discussion summary')).toHaveValue(original.debrief.notes);
 const beforeDownload=p.waitForEvent('download');await portable.getByRole('button',{name:'Download review case JSON',exact:true}).click();const unchanged=testInfo.outputPath('workspace-after-handoff.json');await(await beforeDownload).saveAs(unchanged);expect(JSON.parse(fs.readFileSync(unchanged,'utf8'))).toEqual(original);
 expect(await p.evaluate(()=>window.effects)).toEqual([]);await c.setOffline(false);await p.reload();await c.setOffline(true);await expect(p.getByLabel('Replay position',{exact:true})).toHaveCount(0);await p.getByLabel('Choose flight CSV',{exact:true}).setInputFiles(path.join(extracted,'originals/source.csv'));await p.getByLabel('Visible review panel group').selectOption('debrief');await timeline.getByLabel('Import debrief JSON').setInputFiles(path.join(extracted,'originals/instructor.json'));await expect(timeline.getByLabel('Discussion summary')).toHaveValue('');await timeline.getByRole('button',{name:'Replace with imported review',exact:true}).click();await expect(timeline.getByLabel('Discussion summary')).toHaveValue(original.debrief.notes);await expect(timeline.getByText('Fixed fabricated browser handoff note',{exact:true})).toBeVisible();expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});


test('same-source private instructor combination resolves disagreements explicitly and reopens a new sidecar without touching originals or active replay',async({page:p,context:c},testInfo)=>{
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),marker=(id,text,extra={})=>({id,time_s:8,kind:'Question',text,discussed:false,...extra});original.debrief.markers=[marker('conflict','PRIVATE left disagreement'),marker('equal','PRIVATE equal saved note'),marker('left-only','PRIVATE omitted candidate note')];original.debrief.notes='PRIVATE left whole summary';const left=JSON.stringify(original.debrief),right={...original.debrief,markers:[marker('conflict','PRIVATE <b>right literal</b>',{time_s:4,kind:'Follow-up',discussed:true}),marker('equal','PRIVATE equal saved note'),marker('right-only','PRIVATE separate same-time note')],notes:'PRIVATE right whole summary'},rightText=JSON.stringify(right),expected={...original.debrief,markers:[right.markers[0],right.markers[1],right.markers[2]],notes:right.notes};
 const errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
 await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true}),file=testInfo.outputPath('combination-before.json');fs.writeFileSync(file,JSON.stringify(original));await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(file);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');await pair.getByLabel('Comparison notes',{exact:true}).fill('PRIVATE comparison unchanged');
 await p.getByLabel('Go to local handoff task').selectOption('combine');const tool=p.getByRole('region',{name:'Instructor review combination tool',exact:true}),validate=tool.getByRole('button',{name:'Validate originals for private combination',exact:true});await expect(tool).toBeFocused();for(const[role,text]of[['source',original.source.csv_text],['left',left],['right',rightText]])await tool.getByLabel('Combination '+role+' file',{exact:true}).setInputFiles({name:role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await expect(validate).toBeDisabled();await tool.getByLabel('Acknowledge private instructor combination').check();await validate.click();const decisions=tool.getByRole('region',{name:'Private instructor combination decisions',exact:true}),prepare=tool.getByRole('button',{name:'Prepare explicitly chosen instructor sidecar',exact:true}),download=tool.getByRole('button',{name:'Download combined instructor JSON',exact:true});await expect(decisions).toBeVisible();await expect(tool.getByLabel('Acknowledge private instructor combination')).not.toBeChecked();await expect(decisions).toContainText('4 distinct annotation IDs; 1 same-ID disagreements');await expect(prepare).toBeDisabled();await expect(download).toBeDisabled();expect(downloads).toEqual([]);
 const rows=decisions.getByRole('list',{name:'All combination annotation choices',exact:true}),conflict=rows.getByRole('listitem').filter({has:p.getByRole('heading',{name:'Annotation 1, ID conflict',exact:true})});await expect(conflict.getByText('PRIVATE <b>right literal</b>',{exact:true})).toBeVisible();expect(await conflict.locator('b').count()).toBe(0);await decisions.getByRole('button',{name:'Select unresolved unique and equal annotations from both',exact:true}).click();await expect(conflict.getByRole('combobox')).toHaveValue('');await conflict.getByRole('combobox').selectOption('right');await decisions.getByLabel('Combination annotation 3 choice',{exact:true}).selectOption('omit');await expect(prepare).toBeDisabled();await decisions.getByLabel('Combination summary choice',{exact:true}).selectOption('right');await prepare.click();const candidate=tool.getByRole('region',{name:'Combined instructor candidate',exact:true});await expect(candidate).toContainText('3 selected annotations. 1 IDs omitted');await expect(candidate).toContainText('PRIVATE right whole summary');await expect(candidate).not.toContainText('PRIVATE omitted candidate note');await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');expect(downloads).toEqual([]);
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await conflict.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('instructor-combination-'+name+'-choices.png')});await candidate.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('instructor-combination-'+name+'-candidate.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const waiting=p.waitForEvent('download');await download.click();const saved=testInfo.outputPath('combined-sidecar.json');await(await waiting).saveAs(saved);expect(JSON.parse(fs.readFileSync(saved,'utf8'))).toEqual(expected);const source=testInfo.outputPath('combination-source.csv');fs.writeFileSync(source,original.source.csv_text);const receipt=JSON.parse(execFileSync(process.execPath,['scripts/verify-instructor-sidecar.mjs',source,saved],{cwd:root,encoding:'utf8'}));expect(receipt.saved_markers).toBe(3);
 await p.getByLabel('Go to local handoff task').selectOption('instructor');await p.getByLabel('Go to local handoff task').selectOption('combine');await expect(download).toBeEnabled();await decisions.getByLabel('Combination summary choice',{exact:true}).selectOption('left');await expect(download).toBeDisabled();await decisions.getByLabel('Combination summary choice',{exact:true}).selectOption('right');await expect(download).toBeDisabled();await prepare.click();await expect(download).toBeEnabled();const untouched=p.waitForEvent('download');await portable.getByRole('button',{name:'Download review case JSON',exact:true}).click();const after=testInfo.outputPath('combination-active-unchanged.json');await(await untouched).saveAs(after);expect(JSON.parse(fs.readFileSync(after,'utf8'))).toEqual(original);
 await tool.getByRole('button',{name:'Clear instructor combination',exact:true}).click();await expect(decisions).toHaveCount(0);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');await expect(pair.getByLabel('Comparison notes',{exact:true})).toHaveValue('PRIVATE comparison unchanged');await p.getByLabel('Visible review panel group').selectOption('debrief');const timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true});await timeline.getByLabel('Import debrief JSON').setInputFiles(saved);await expect(timeline.getByLabel('Discussion summary')).toHaveValue(original.debrief.notes);await timeline.getByRole('button',{name:'Replace with imported review',exact:true}).click();await expect(timeline.getByLabel('Discussion summary')).toHaveValue(expected.notes);await expect(timeline.getByText('PRIVATE <b>right literal</b>',{exact:true})).toBeVisible();await expect(timeline.getByText('PRIVATE separate same-time note',{exact:true})).toBeVisible();await expect(timeline.getByText('PRIVATE omitted candidate note',{exact:true})).toHaveCount(0);expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});


test('instructor combination decision progress resumes only against freshly checked exact originals and explicit replacement preview',async({page:p,context:c},testInfo)=>{
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),marker=(id,text)=>({id,time_s:8,kind:'Question',text,discussed:false});original.debrief.markers=[marker('same','PRIVATE left note'),marker('left-only','PRIVATE retained note')];original.debrief.notes='PRIVATE left summary';const left=JSON.stringify(original.debrief),right=JSON.stringify({...original.debrief,markers:[marker('same','PRIVATE right note')],notes:'PRIVATE right summary'}),texts={source:original.source.csv_text,left,right},errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.goto(origin+'offline-review.html');await c.setOffline(true);await p.getByText('Load synthetic sample',{exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');await p.getByLabel('Go to local handoff task').selectOption('combine');const tool=p.getByRole('region',{name:'Instructor review combination tool',exact:true}),validate=tool.getByRole('button',{name:'Validate originals for private combination',exact:true});const fill=async values=>{for(const role of['source','left','right'])await tool.getByLabel('Combination '+role+' file',{exact:true}).setInputFiles({name:role+'.txt',mimeType:'text/plain',buffer:Buffer.from(values[role])});await tool.getByLabel('Acknowledge private instructor combination').check();await validate.click();await expect(tool.getByRole('region',{name:'Private instructor combination decisions',exact:true})).toBeVisible();};await fill(texts);
 await tool.getByLabel('Combination annotation 2 choice',{exact:true}).selectOption('right');const pending=p.waitForEvent('download');await tool.getByRole('button',{name:'Download instructor decision progress',exact:true}).click();const saved=testInfo.outputPath('incomplete-progress.json');await(await pending).saveAs(saved);const plan=JSON.parse(fs.readFileSync(saved,'utf8'));expect(plan.choices).toEqual([{id:'left-only',choice:''},{id:'same',choice:'right'}]);expect(plan.summary_choice).toBe('');expect(fs.readFileSync(saved,'utf8')).not.toContain('PRIVATE');
 await tool.getByRole('button',{name:'Clear instructor combination',exact:true}).click();await fill(texts);const progress=tool.getByRole('region',{name:'Instructor combination decision progress',exact:true}),input=progress.getByLabel('Import instructor decision progress',{exact:true});await input.setInputFiles(saved);const preview=progress.getByRole('region',{name:'Instructor decision progress replacement preview',exact:true});await expect(preview).toContainText('imported 1 resolved and 1 unresolved');await expect(tool.getByLabel('Combination annotation 2 choice',{exact:true})).toHaveValue('');await expect(preview.getByRole('list',{name:'Every imported decision progress choice'})).toContainText('ID same. Current unresolved; proposed right');
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await preview.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('instructor-progress-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 await preview.getByRole('button',{name:'Keep current instructor decisions',exact:true}).click();await expect(preview).toHaveCount(0);await expect(tool.getByLabel('Combination annotation 2 choice',{exact:true})).toHaveValue('');await input.setInputFiles(saved);await expect(preview).toBeVisible();await tool.getByLabel('Combination annotation 1 choice',{exact:true}).selectOption('omit');await expect(preview).toHaveCount(0);await expect(tool.getByLabel('Combination annotation 1 choice',{exact:true})).toHaveValue('omit');
 const currentInput=tool.getByLabel('Import instructor decision progress',{exact:true});await currentInput.setInputFiles(saved);await tool.getByRole('button',{name:'Restore reviewed instructor decisions',exact:true}).click();await expect(tool.getByLabel('Combination annotation 1 choice',{exact:true})).toHaveValue('');await expect(tool.getByLabel('Combination annotation 2 choice',{exact:true})).toHaveValue('right');await expect(tool.getByLabel('Combination summary choice',{exact:true})).toHaveValue('');await expect(tool.getByRole('button',{name:'Download combined instructor JSON',exact:true})).toBeDisabled();await expect(tool.getByRole('button',{name:'Prepare explicitly chosen instructor sidecar',exact:true})).toBeDisabled();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');
 await tool.getByLabel('Combination annotation 1 choice',{exact:true}).selectOption('left');await tool.getByLabel('Combination summary choice',{exact:true}).selectOption('empty');await tool.getByRole('button',{name:'Prepare explicitly chosen instructor sidecar',exact:true}).click();await expect(tool.getByRole('button',{name:'Download combined instructor JSON',exact:true})).toBeEnabled();await tool.getByLabel('Import instructor decision progress',{exact:true}).setInputFiles(saved);await tool.getByRole('button',{name:'Restore reviewed instructor decisions',exact:true}).click();await expect(tool.getByRole('button',{name:'Download combined instructor JSON',exact:true})).toBeDisabled();
 await tool.getByRole('button',{name:'Clear instructor combination',exact:true}).click();await fill({...texts,left:left+'\n'});await tool.getByLabel('Import instructor decision progress',{exact:true}).setInputFiles(saved);await expect(tool.getByText('Plan refused.',{exact:false})).toBeVisible();await expect(tool.getByRole('region',{name:'Instructor decision progress replacement preview',exact:true})).toHaveCount(0);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');expect(errors).toEqual([]);expect(requests).toEqual([]);
});


test('explicit instructor notes become new Pending checklist prompts with optional held-row references and a reusable outcome-free template',async({page:p,context:c},testInfo)=>{
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8'));original.debrief.markers=[{id:'same-time-a',time_s:8,kind:'Question',text:'PRIVATE <b>literal instructor question</b>',discussed:true},{id:'same-time-b',time_s:8,kind:'Follow-up',text:'x'.repeat(1000),discussed:true}];original.debrief.notes='PRIVATE original summary, not an agenda outcome';const sidecar=JSON.stringify(original.debrief),errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
 await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true}),file=testInfo.outputPath('agenda-before-case.json');fs.writeFileSync(file,JSON.stringify(original));await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(file);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');
 await p.getByLabel('Go to local handoff task').selectOption('instructorAgenda');const tool=p.getByRole('region',{name:'Instructor discussion agenda tool',exact:true}),validate=tool.getByRole('button',{name:'Validate originals for instructor agenda',exact:true});await expect(tool).toBeFocused();for(const[role,text]of[['source',original.source.csv_text],['sidecar',sidecar]])await tool.getByLabel('Instructor agenda '+role+' file',{exact:true}).setInputFiles({name:role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await expect(validate).toBeDisabled();await tool.getByLabel('Acknowledge private instructor agenda').check();await validate.click();const preview=tool.getByRole('region',{name:'Private instructor agenda selection',exact:true});await expect(preview).toContainText('2 original annotations, 0 selected');await expect(tool.getByLabel('Acknowledge private instructor agenda')).not.toBeChecked();const originals=preview.getByRole('list',{name:'Original instructor notes for agenda',exact:true});await expect(originals.getByText('PRIVATE <b>literal instructor question</b>',{exact:true})).toBeVisible();expect(await originals.locator('b').count()).toBe(0);await expect(originals).toContainText('Earlier held original row 3 at 4s, age 4s. DATA GAP, no observation at marker time.');
 await preview.getByLabel('Select instructor annotation 2 for agenda',{exact:true}).check();await preview.getByLabel('Instructor agenda title',{exact:true}).fill('Fixed fabricated facilitated agenda');const prepare=tool.getByRole('button',{name:'Prepare selected instructor discussion agenda',exact:true}),download=tool.getByRole('button',{name:'Download source-bound instructor checklist',exact:true});await expect(preview.getByLabel('Instructor agenda prompt 1',{exact:true})).toHaveValue('x'.repeat(1000));await expect(prepare).toBeDisabled();await preview.getByLabel('Instructor agenda prompt 1',{exact:true}).fill('Explicitly shortened private follow-up prompt');await preview.getByLabel('Select instructor annotation 1 for agenda',{exact:true}).check();await preview.getByRole('button',{name:'Move agenda prompt 2 earlier',exact:true}).click();await expect(preview.getByLabel('Instructor agenda prompt 1',{exact:true})).toHaveValue('PRIVATE <b>literal instructor question</b>');await expect(preview.getByLabel('Instructor agenda reference 1',{exact:true})).toHaveValue('none');await preview.getByLabel('Instructor agenda reference 1',{exact:true}).selectOption('held');await prepare.click();const candidate=tool.getByRole('region',{name:'Prepared instructor discussion agenda',exact:true});await expect(candidate).toContainText('Status Pending, blank notes, explicit original row 3');await expect(candidate).not.toContainText('PRIVATE original summary');await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');expect(downloads).toEqual([]);
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await candidate.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('instructor-agenda-'+name+'.png')});await preview.getByLabel('Instructor agenda title',{exact:true}).evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('instructor-agenda-edit-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const save=async(button,path)=>{const waiting=p.waitForEvent('download');await button.click();await(await waiting).saveAs(path);};const reviewPath=testInfo.outputPath('agenda-checklist.json'),templatePath=testInfo.outputPath('agenda-template.json');await save(download,reviewPath);await save(tool.getByRole('button',{name:'Download reusable instructor agenda template',exact:true}),templatePath);const review=JSON.parse(fs.readFileSync(reviewPath,'utf8')),template=JSON.parse(fs.readFileSync(templatePath,'utf8'));expect(review.items).toEqual([{id:'instructor-agenda-1',prompt:'PRIVATE <b>literal instructor question</b>',status:'Pending',note:'',row:3},{id:'instructor-agenda-2',prompt:'Explicitly shortened private follow-up prompt',status:'Pending',note:'',row:null}]);expect(template.items).toEqual(review.items.map(({id,prompt})=>({id,prompt})));expect(Object.keys(template)).toEqual(['format','title','items']);await preview.getByLabel('Instructor agenda title',{exact:true}).fill('Changed title');await expect(download).toBeDisabled();await preview.getByLabel('Instructor agenda title',{exact:true}).fill(review.title);await expect(download).toBeDisabled();
 const after=testInfo.outputPath('agenda-active-unchanged.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),after);expect(JSON.parse(fs.readFileSync(after,'utf8'))).toEqual(original);await tool.getByRole('button',{name:'Clear instructor agenda',exact:true}).click();await expect(preview).toHaveCount(0);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await p.getByLabel('Visible review panel group').selectOption('debrief');const checklist=p.getByRole('article',{name:'Reusable discussion checklist',exact:true});await checklist.getByLabel('Import discussion checklist JSON').setInputFiles(reviewPath);await expect(checklist.getByLabel('Discussion checklist counts')).toContainText('0/30 saved prompts');await checklist.getByRole('button',{name:'Replace discussion checklist',exact:true}).click();await expect(checklist.getByLabel('Discussion checklist counts')).toContainText('2/30 saved prompts. Pending: 2; Discussed: 0; Not applicable: 0');await expect(checklist.getByRole('button',{name:'Seek checklist original row 3',exact:true})).toBeVisible();await checklist.getByLabel('Import discussion checklist JSON').setInputFiles(templatePath);await expect(checklist.getByLabel('Discussion checklist import preview')).toContainText('all prompts reset to Pending, notes/references blank');await checklist.getByRole('button',{name:'Replace discussion checklist',exact:true}).click();await expect(checklist.getByRole('button',{name:'Seek checklist original row 3',exact:true})).toHaveCount(0);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');const timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true});await expect(timeline.getByLabel('Discussion summary')).toHaveValue(original.debrief.notes);expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('two exact-source discussion checklist originals compare full private fields and original ordinals offline without outcome transfer or active changes',async({page:p,context:c},testInfo)=>{
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),sha=crypto.createHash('sha256').update(original.source.csv_text).digest('hex'),item=(id,patch={})=>({id,prompt:'PRIVATE <b>literal shared question</b>',status:'Pending',note:'',row:null,...patch}),base={format:'skydash-debrief-checklist-v1',replay_model:original.debrief.replay_model,source_sha256:sha,title:'PRIVATE left original',items:[item('same'),item('changed',{row:4}),item('only-left')]};const right={...base,title:'PRIVATE right original',items:[item('changed',{prompt:'PRIVATE right edited question',status:'Discussed',note:'PRIVATE reviewer note',row:3}),item('same'),item('only-right')]},errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
 await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true}),file=testInfo.outputPath('checklist-before-case.json');fs.writeFileSync(file,JSON.stringify(original));await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(file);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');
 await p.getByLabel('Go to local handoff task').selectOption('checklistCompare');const tool=p.getByRole('region',{name:'Checklist review comparison tool',exact:true}),check=tool.getByRole('button',{name:'Compare original checklist reviews',exact:true}),download=tool.getByRole('button',{name:'Download private checklist comparison',exact:true});await expect(tool).toBeFocused();for(const[role,text]of[['source',original.source.csv_text],['left',JSON.stringify(base)],['right',JSON.stringify(right)]])await tool.getByLabel('Checklist comparison '+role+' file',{exact:true}).setInputFiles({name:role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await expect(check).toBeDisabled();await tool.getByLabel('Acknowledge private checklist comparison').check();await check.click();const result=tool.getByRole('region',{name:'Private checklist comparison result',exact:true});await expect(result).toContainText('Exact-ID rows: equal 1, changed 1, left-only 1, right-only 1');await expect(tool.getByLabel('Acknowledge private checklist comparison')).not.toBeChecked();await expect(result.getByRole('region',{name:'left checklist item same',exact:true})).toContainText('PRIVATE <b>literal shared question</b>');expect(await result.locator('b').count()).toBe(0);await expect(result.getByRole('region',{name:'left checklist item changed',exact:true})).toContainText('Previous spacing 8s / GAP over 5s');await expect(result.getByRole('region',{name:'right checklist item changed',exact:true})).toContainText('PRIVATE reviewer note');expect(downloads).toEqual([]);
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await result.getByRole('heading',{name:'ID changed: changed',exact:true}).evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('checklist-comparison-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const save=async(button,path)=>{const waiting=p.waitForEvent('download');await button.click();await(await waiting).saveAs(path);},reportPath=testInfo.outputPath('checklist-comparison.txt');await save(download,reportPath);const text=fs.readFileSync(reportPath,'utf8');for(const value of['PRIVATE right edited question','PRIVATE reviewer note','left ordinal 1','right ordinal 2',sha,'only-left','only-right','not a grade'])expect(text).toContain(value);for(const value of['latitude','longitude','altitude_m','battery_pct'])expect(text).not.toContain(value);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');const after=testInfo.outputPath('checklist-active-unchanged.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),after);expect(JSON.parse(fs.readFileSync(after,'utf8'))).toEqual(original);
 await p.getByLabel('Go to local handoff task').selectOption('checklistCompare');await tool.getByLabel('Checklist comparison right expected SHA-256',{exact:true}).fill('e'.repeat(64));await expect(result).toHaveCount(0);await expect(download).toBeDisabled();await tool.getByLabel('Checklist comparison right expected SHA-256',{exact:true}).fill('');await expect(download).toBeDisabled();await tool.getByLabel('Acknowledge private checklist comparison').check();await check.click();await expect(result).toBeVisible();await tool.getByRole('button',{name:'Clear checklist comparison',exact:true}).click();await expect(result).toHaveCount(0);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('original discussion checklist static private print preserves exact saved words and context without active replay changes or executable HTML',async({page:p,context:c},testInfo)=>{
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),sha=crypto.createHash('sha256').update(original.source.csv_text).digest('hex'),review={format:'skydash-debrief-checklist-v1',replay_model:original.debrief.replay_model,source_sha256:sha,title:'PRIVATE <img src=x onerror=alert(1)> saved agenda',items:[{id:'gap',prompt:'PRIVATE <script>literal prompt</script>',status:'Discussed',note:'PRIVATE <b>saved reason</b>\nsecond line',row:4},{id:'none',prompt:'PRIVATE second question',status:'Not applicable',note:'PRIVATE reviewer reason, not verified applicability',row:null}]},errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
 await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true}),file=testInfo.outputPath('print-before-case.json');fs.writeFileSync(file,JSON.stringify(original));await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(file);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');await p.getByLabel('Go to local handoff task').selectOption('checklistPrint');const tool=p.getByRole('region',{name:'Original checklist print tool',exact:true}),check=tool.getByRole('button',{name:'Prepare original checklist print',exact:true}),download=tool.getByRole('button',{name:'Download private checklist HTML',exact:true});await expect(tool).toBeFocused();for(const[role,text]of[['source',original.source.csv_text],['review',JSON.stringify(review)]])await tool.getByLabel('Checklist print '+role+' file',{exact:true}).setInputFiles({name:role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await expect(check).toBeDisabled();await tool.getByLabel('Acknowledge private original checklist print').check();await check.click();const preview=tool.getByRole('region',{name:'Private checklist print preview',exact:true});await expect(preview).toContainText(review.title);await expect(preview).toContainText('Original row 4 at 12s, previous spacing 8s / GAP over 5s');await expect(preview).toContainText(review.items[0].note);expect(await preview.locator('img,script,b').count()).toBe(0);await expect(tool.getByLabel('Acknowledge private original checklist print')).not.toBeChecked();expect(downloads).toEqual([]);
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await preview.getByRole('list',{name:'Original checklist print prompts',exact:true}).evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('checklist-print-preview-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const save=async(button,path)=>{const waiting=p.waitForEvent('download');await button.click();await(await waiting).saveAs(path);},htmlPath=testInfo.outputPath('private-checklist.html');await save(download,htmlPath);const html=fs.readFileSync(htmlPath,'utf8');expect(html).toContain('Content-Security-Policy');for(const text of['<script','<img','<form','<input','<iframe','<link','<a '])expect(html).not.toContain(text);expect(html).toContain('&lt;script&gt;literal prompt&lt;/script&gt;');expect(html).toContain('PRIVATE &lt;b&gt;saved reason&lt;/b&gt;');for(const text of['28.6139','77.209','battery_pct','altitude_m'])expect(html).not.toContain(text);const printPage=await c.newPage(),printRequests=[];printPage.on('request',r=>printRequests.push(r.url()));printPage.on('pageerror',e=>errors.push(e.message));await printPage.setContent(html);await expect(printPage.getByRole('heading',{level:1})).toHaveText(review.title);expect(await printPage.locator('script,img,form,input,iframe,a').count()).toBe(0);await expect(printPage.locator('main')).toContainText(review.items[0].prompt);await expect(printPage.locator('main')).toContainText(review.items[0].note);await expect(printPage.locator('.prompt')).toHaveCount(2);
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await printPage.setViewportSize({width,height});await printPage.screenshot({path:testInfo.outputPath('checklist-static-report-'+name+'.png'),fullPage:true});expect(await printPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}await printPage.emulateMedia({media:'print'});await printPage.pdf({path:testInfo.outputPath('checklist-static-report.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});expect(printRequests).toEqual([]);await printPage.close();
 const after=testInfo.outputPath('print-active-unchanged.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),after);expect(JSON.parse(fs.readFileSync(after,'utf8'))).toEqual(original);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');await p.getByLabel('Go to local handoff task').selectOption('checklistPrint');await tool.getByLabel('Checklist print source expected SHA-256',{exact:true}).fill('e'.repeat(64));await expect(preview).toHaveCount(0);await expect(download).toBeDisabled();await tool.getByLabel('Checklist print source expected SHA-256',{exact:true}).fill('');await expect(download).toBeDisabled();await tool.getByRole('button',{name:'Clear checklist print',exact:true}).click();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('discussion original ZIP preserves checklist and explicit optional instructor raw originals and manually reopens them independently offline',async({page:p,context:c},testInfo)=>{
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8'));original.debrief.markers=[{id:'separate-instructor-id',time_s:8,kind:'Question',text:'PRIVATE independent instructor question',discussed:true}];original.debrief.notes='PRIVATE independent instructor summary';const source=original.source.csv_text,sidecar=JSON.stringify(original.debrief,null,2)+'\n',checklist={format:'skydash-debrief-checklist-v1',replay_model:original.debrief.replay_model,source_sha256:crypto.createHash('sha256').update(source).digest('hex'),title:'PRIVATE exact checklist title',items:[{id:'separate-checklist-id',prompt:'PRIVATE checklist prompt',status:'Discussed',note:'PRIVATE checklist note',row:4},{id:'not-applicable',prompt:'PRIVATE independent question',status:'Not applicable',note:'PRIVATE reviewer reason',row:null}]},checklistText=' '+JSON.stringify(checklist,null,2)+'\n',errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
 await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true}),casePath=testInfo.outputPath('discussion-before-case.json');fs.writeFileSync(casePath,JSON.stringify(original));await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles(casePath);await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');await p.getByLabel('Go to local handoff task').selectOption('discussionOriginals');const tool=p.getByRole('region',{name:'Discussion originals handoff',exact:true}),prepare=tool.getByRole('button',{name:'Validate and prepare discussion originals ZIP',exact:true}),download=tool.getByRole('button',{name:'Download discussion originals ZIP',exact:true}),optional=tool.getByLabel('Include original instructor sidecar in discussion ZIP');await expect(tool).toBeFocused();await expect(optional).not.toBeChecked();await expect(tool.getByLabel('Discussion handoff instructor file',{exact:true})).toHaveCount(0);for(const[role,text]of[['source',source],['checklist',checklistText]])await tool.getByLabel('Discussion handoff '+role+' file',{exact:true}).setInputFiles({name:'PRIVATE-'+role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await expect(prepare).toBeDisabled();await tool.getByLabel('Acknowledge sensitive discussion originals ZIP').check();await prepare.click();const inventory=tool.getByRole('region',{name:'Validated discussion originals inventory',exact:true});await expect(inventory).toContainText('Instructor original not included');expect(downloads).toEqual([]);const save=async(button,target)=>{const waiting=p.waitForEvent('download');await button.click();await(await waiting).saveAs(target);},extract=(zip,dir,withInstructor)=>{const names=['originals/source.csv','originals/checklist.json',...(withInstructor?['originals/instructor.json']:[]),'validation.json','HANDOFF.txt'];execFileSync('python',['-c','import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert z.namelist()==json.loads(sys.argv[3]);z.extractall(sys.argv[2])',zip,dir,JSON.stringify(names)]);};
 const pairZip=testInfo.outputPath('discussion-pair.zip'),pairDir=testInfo.outputPath('discussion-pair-extracted');await save(download,pairZip);extract(pairZip,pairDir,false);expect(fs.readFileSync(path.join(pairDir,'originals/checklist.json'),'utf8')).toBe(checklistText);await optional.check();await expect(download).toBeDisabled();await expect(tool.getByLabel('Acknowledge sensitive discussion originals ZIP')).not.toBeChecked();await tool.getByLabel('Discussion handoff instructor file',{exact:true}).setInputFiles({name:'PRIVATE-instructor.json',mimeType:'application/json',buffer:Buffer.from(sidecar)});await tool.getByLabel('Discussion handoff instructor expected SHA-256',{exact:true}).fill(crypto.createHash('sha256').update(sidecar).digest('hex'));await tool.getByLabel('Acknowledge sensitive discussion originals ZIP').check();await prepare.click();await expect(inventory).toContainText('Instructor original explicitly included, 1 saved annotations');await expect(inventory).not.toContainText('PRIVATE');await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await inventory.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('discussion-originals-'+name+'.png')});await optional.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('discussion-originals-selection-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const zip=testInfo.outputPath('discussion-full.zip'),dir=testInfo.outputPath('discussion-full-extracted');await save(download,zip);extract(zip,dir,true);for(const[role,text]of[['source.csv',source],['checklist.json',checklistText],['instructor.json',sidecar]])expect(fs.readFileSync(path.join(dir,'originals',role),'utf8')).toBe(text);const receipt=JSON.parse(fs.readFileSync(path.join(dir,'validation.json'),'utf8'));expect(receipt).toMatchObject({instructor_included:true,saved_prompts:2,saved_instructor_markers:1});expect(JSON.stringify(receipt)).not.toContain('PRIVATE');expect(fs.readFileSync(path.join(dir,'HANDOFF.txt'),'utf8')).toContain('NOT accepted');const unchanged=testInfo.outputPath('discussion-active-unchanged.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),unchanged);expect(JSON.parse(fs.readFileSync(unchanged,'utf8'))).toEqual(original);await p.getByLabel('Go to local handoff task').selectOption('discussionOriginals');await optional.uncheck();await expect(download).toBeDisabled();await optional.check();await expect(tool.getByLabel('Discussion handoff instructor expected SHA-256',{exact:true})).toHaveValue('');await expect(tool.getByLabel('Discussion handoff instructor file',{exact:true})).toHaveValue('');await tool.getByRole('button',{name:'Clear discussion originals handoff',exact:true}).click();await expect(optional).not.toBeChecked();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');expect(await p.evaluate(()=>window.effects)).toEqual([]);
 await c.setOffline(false);await p.reload();await c.setOffline(true);await p.getByLabel('Choose flight CSV',{exact:true}).setInputFiles(path.join(dir,'originals/source.csv'));await p.getByLabel('Visible review panel group').selectOption('debrief');const discussion=p.getByRole('article',{name:'Reusable discussion checklist',exact:true}),timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true});await discussion.getByLabel('Import discussion checklist JSON').setInputFiles(path.join(dir,'originals/checklist.json'));await expect(discussion.getByLabel('Discussion checklist counts')).toContainText('0/30 saved prompts');await discussion.getByRole('button',{name:'Replace discussion checklist',exact:true}).click();await expect(discussion.getByLabel('Discussion checklist counts')).toContainText('2/30 saved prompts. Pending: 0; Discussed: 1; Not applicable: 1');await expect(discussion.getByRole('button',{name:'Seek checklist original row 4',exact:true})).toBeVisible();await timeline.getByLabel('Import debrief JSON').setInputFiles(path.join(dir,'originals/instructor.json'));await expect(timeline.getByLabel('Discussion summary')).toHaveValue('');await timeline.getByRole('button',{name:'Replace with imported review',exact:true}).click();await expect(timeline.getByLabel('Discussion summary')).toHaveValue(original.debrief.notes);await expect(discussion.getByLabel('Discussion checklist counts')).toContainText('Discussed: 1; Not applicable: 1');await expect(timeline.getByText('PRIVATE independent instructor question',{exact:true})).toBeVisible();expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('received discussion ZIP freshly checks originals and downloads one exact role for separate confirmed reopening offline',async({page:p,context:c},testInfo)=>{
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),source=original.source.csv_text,checklist={format:'skydash-debrief-checklist-v1',replay_model:original.debrief.replay_model,source_sha256:crypto.createHash('sha256').update(source).digest('hex'),title:'PRIVATE received title',items:[{id:'private-received',prompt:'PRIVATE received prompt',status:'Discussed',note:'PRIVATE received note',row:4}]};original.debrief.markers=[{id:'private-instructor-separate',time_s:8,kind:'Question',text:'PRIVATE received instructor',discussed:true}];original.debrief.notes='PRIVATE received instructor summary';const texts={source,checklist:' '+JSON.stringify(checklist,null,2)+'\n',instructor:JSON.stringify(original.debrief,null,2)+'\n'},errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
 await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles({name:'before.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');
 const save=async(button,target)=>{const waiting=p.waitForEvent('download');await button.click();const d=await waiting;await d.saveAs(target);return d.suggestedFilename();};await p.getByLabel('Go to local handoff task').selectOption('discussionOriginals');const sender=p.getByRole('region',{name:'Discussion originals handoff',exact:true});for(const role of['source','checklist'])await sender.getByLabel('Discussion handoff '+role+' file',{exact:true}).setInputFiles({name:'PRIVATE-'+role,mimeType:'text/plain',buffer:Buffer.from(texts[role])});await sender.getByLabel('Acknowledge sensitive discussion originals ZIP').check();await sender.getByRole('button',{name:'Validate and prepare discussion originals ZIP',exact:true}).click();const zip4=testInfo.outputPath('received-four.zip');await save(sender.getByRole('button',{name:'Download discussion originals ZIP',exact:true}),zip4);await sender.getByLabel('Include original instructor sidecar in discussion ZIP').check();await sender.getByLabel('Discussion handoff instructor file',{exact:true}).setInputFiles({name:'PRIVATE-instructor',mimeType:'text/plain',buffer:Buffer.from(texts.instructor)});await sender.getByLabel('Acknowledge sensitive discussion originals ZIP').check();await sender.getByRole('button',{name:'Validate and prepare discussion originals ZIP',exact:true}).click();const zip5=testInfo.outputPath('received-five.zip');await save(sender.getByRole('button',{name:'Download discussion originals ZIP',exact:true}),zip5);
 await p.getByLabel('Go to local handoff task').selectOption('receivedDiscussion');const tool=p.getByRole('region',{name:'Received discussion originals ZIP',exact:true}),check=tool.getByRole('button',{name:'Check discussion ZIP originals',exact:true}),inventory=tool.getByRole('region',{name:'Checked received discussion inventory',exact:true});await expect(tool).toBeFocused();await tool.getByLabel('Received discussion ZIP file',{exact:true}).setInputFiles(zip4);await check.click();await expect(inventory).toContainText('Instructor original absent');await expect(tool.getByRole('option',{name:'instructor',exact:true})).toHaveCount(0);const beforeDownloads=downloads.length;await tool.getByLabel('Received discussion ZIP file',{exact:true}).setInputFiles(zip5);for(const role of['source','checklist','instructor'])await tool.getByLabel('Received discussion '+role+' expected SHA-256',{exact:true}).fill(crypto.createHash('sha256').update(texts[role]).digest('hex'));await tool.getByLabel('Received discussion archive expected SHA-256',{exact:true}).fill(crypto.createHash('sha256').update(fs.readFileSync(zip5)).digest('hex'));await check.click();await expect(inventory).toContainText('Instructor original present, 1 saved annotations');await expect(inventory).not.toContainText('PRIVATE');expect(downloads.length).toBe(beforeDownloads);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');
 const output={};for(const role of['source','checklist','instructor']){await tool.getByLabel('Received discussion original role',{exact:true}).selectOption(role);await expect(tool.getByLabel('Acknowledge sensitive received discussion original')).not.toBeChecked();await tool.getByLabel('Acknowledge sensitive received discussion original').check();output[role]=testInfo.outputPath('recovered-'+(role==='source'?'source.csv':role+'.json'));expect(await save(tool.getByRole('button',{name:'Recheck and download selected discussion original',exact:true}),output[role])).toBe(role==='source'?'source.csv':role+'.json');expect(fs.readFileSync(output[role],'utf8')).toBe(texts[role]);await expect(tool.getByLabel('Acknowledge sensitive received discussion original')).not.toBeChecked();}
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await inventory.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('received-discussion-inventory-'+name+'.png')});await tool.getByLabel('Acknowledge sensitive received discussion original').evaluate(e=>e.scrollIntoView({block:'center'}));await p.screenshot({path:testInfo.outputPath('received-discussion-download-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const unchanged=testInfo.outputPath('received-active-unchanged.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),unchanged);expect(JSON.parse(fs.readFileSync(unchanged,'utf8'))).toEqual(original);await p.getByLabel('Go to local handoff task').selectOption('receivedDiscussion');await tool.getByLabel('Received discussion checklist expected SHA-256',{exact:true}).fill('e'.repeat(64));await expect(inventory).toHaveCount(0);await check.click();await expect(tool.getByRole('status',{name:'Received discussion ZIP status'})).toContainText('refused');await tool.getByLabel('Received discussion checklist expected SHA-256',{exact:true}).fill('');await expect(inventory).toHaveCount(0);await tool.getByRole('button',{name:'Clear received discussion ZIP',exact:true}).click();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');expect(await p.evaluate(()=>window.effects)).toEqual([]);
 await c.setOffline(false);await p.reload();await c.setOffline(true);await p.getByLabel('Choose flight CSV',{exact:true}).setInputFiles(output.source);await p.getByLabel('Visible review panel group').selectOption('debrief');const discussion=p.getByRole('article',{name:'Reusable discussion checklist',exact:true}),timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true});await discussion.getByLabel('Import discussion checklist JSON').setInputFiles(output.checklist);await expect(discussion.getByLabel('Discussion checklist counts')).toContainText('0/30 saved prompts');await discussion.getByRole('button',{name:'Replace discussion checklist',exact:true}).click();await expect(discussion.getByLabel('Discussion checklist counts')).toContainText('1/30 saved prompts. Pending: 0; Discussed: 1');await timeline.getByLabel('Import debrief JSON').setInputFiles(output.instructor);await expect(timeline.getByLabel('Discussion summary')).toHaveValue('');await timeline.getByRole('button',{name:'Replace with imported review',exact:true}).click();await expect(timeline.getByLabel('Discussion summary')).toHaveValue(original.debrief.notes);await expect(discussion.getByRole('list',{name:'Saved discussion prompts',exact:true})).toContainText('PRIVATE received prompt');expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('complete private discussion packet recomputes checked ZIP originals into escaped static offline print without restoring replay',async({page:p,context:c},testInfo)=>{
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8'));original.debrief.markers=[{id:'independent-gap',time_s:8,kind:'Question',text:'PRIVATE <script>instructor words</script>',discussed:true},{id:'independent-exact',time_s:12,kind:'Follow-up',text:'PRIVATE exact unknown source channels',discussed:false}];original.debrief.notes='PRIVATE <b>full summary</b>';const source=original.source.csv_text,checklist={format:'skydash-debrief-checklist-v1',replay_model:original.debrief.replay_model,source_sha256:crypto.createHash('sha256').update(source).digest('hex'),title:'PRIVATE <img src=x> exact agenda',items:[{id:'independent-prompt',prompt:'PRIVATE <script>literal checklist question</script>',status:'Discussed',note:'PRIVATE <b>saved note</b>\nsecond line',row:4}]},texts={source,checklist:JSON.stringify(checklist),instructor:JSON.stringify(original.debrief)},errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles({name:'before.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');
 const save=async(button,target)=>{const waiting=p.waitForEvent('download');await button.click();await(await waiting).saveAs(target);};await p.getByLabel('Go to local handoff task').selectOption('discussionOriginals');const sender=p.getByRole('region',{name:'Discussion originals handoff',exact:true});await sender.getByLabel('Include original instructor sidecar in discussion ZIP').check();for(const[role,text]of Object.entries(texts))await sender.getByLabel('Discussion handoff '+role+' file',{exact:true}).setInputFiles({name:role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await sender.getByLabel('Acknowledge sensitive discussion originals ZIP').check();await sender.getByRole('button',{name:'Validate and prepare discussion originals ZIP',exact:true}).click();const zip=testInfo.outputPath('private-discussion.zip');await save(sender.getByRole('button',{name:'Download discussion originals ZIP',exact:true}),zip);await p.getByLabel('Go to local handoff task').selectOption('receivedDiscussion');const receiver=p.getByRole('region',{name:'Received discussion originals ZIP',exact:true});await receiver.getByLabel('Received discussion ZIP file',{exact:true}).setInputFiles(zip);await receiver.getByRole('button',{name:'Check discussion ZIP originals',exact:true}).click();const tool=receiver.getByRole('region',{name:'Received discussion private packet',exact:true}),prepare=tool.getByRole('button',{name:'Prepare complete private discussion HTML',exact:true}),download=tool.getByRole('button',{name:'Download complete private discussion HTML',exact:true});await expect(prepare).toBeDisabled();await tool.getByLabel('Acknowledge complete sensitive discussion packet').check();const prior=downloads.length;await prepare.click();await expect(tool.getByLabel('Prepared complete private packet')).toContainText('Instructor original included, 2 annotations');await expect(tool.getByLabel('Acknowledge complete sensitive discussion packet')).not.toBeChecked();expect(downloads.length).toBe(prior);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await tool.evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('discussion-packet-controls-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const htmlPath=testInfo.outputPath('complete-private-discussion.html');await save(download,htmlPath);const html=fs.readFileSync(htmlPath,'utf8');for(const text of['<script','<img','<iframe','<form','<input','<a ','<link'])expect(html).not.toContain(text);expect(html).toContain('PRIVATE &lt;script&gt;literal checklist question&lt;/script&gt;');expect(html).toContain('PRIVATE &lt;script&gt;instructor words&lt;/script&gt;');expect(html).toContain('PRIVATE &lt;b&gt;full summary&lt;/b&gt;');expect(html).toContain('original row 3 at 4s, age 4s');expect(html).toContain('Held original row, no observation at marker time.');expect(html).toContain('source altitude unknown; ground speed 5m/s; battery unknown');const report=await c.newPage(),reportRequests=[];report.on('request',r=>reportRequests.push(r.url()));report.on('pageerror',e=>errors.push(e.message));await report.setContent(html);await expect(report.getByRole('heading',{level:1})).toHaveText('Private checklist and included instructor review');await expect(report.getByRole('region',{name:'Original checklist chapter'})).toContainText(checklist.items[0].prompt);await expect(report.getByRole('region',{name:'Original instructor chapter'})).toContainText(original.debrief.notes);expect(await report.locator('script,img,iframe,form,input,a,link').count()).toBe(0);for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await report.setViewportSize({width,height});await report.screenshot({path:testInfo.outputPath('discussion-private-report-'+name+'.png'),fullPage:true});expect(await report.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}await report.emulateMedia({media:'print'});await report.pdf({path:testInfo.outputPath('discussion-private-report.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});expect(reportRequests).toEqual([]);await report.close();
 const after=testInfo.outputPath('private-discussion-active-unchanged.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),after);expect(JSON.parse(fs.readFileSync(after,'utf8'))).toEqual(original);await p.getByLabel('Go to local handoff task').selectOption('receivedDiscussion');await receiver.getByLabel('Received discussion original role',{exact:true}).selectOption('checklist');await expect(download).toBeEnabled();await receiver.getByLabel('Received discussion source expected SHA-256',{exact:true}).fill('e'.repeat(64));await expect(tool).toHaveCount(0);await receiver.getByLabel('Received discussion source expected SHA-256',{exact:true}).fill('');await receiver.getByRole('button',{name:'Check discussion ZIP originals',exact:true}).click();await expect(receiver.getByRole('button',{name:'Download complete private discussion HTML',exact:true})).toBeDisabled();await expect(receiver.getByLabel('Acknowledge complete sensitive discussion packet')).not.toBeChecked();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('received discussion snapshots compare separate privacy-limited exact-ID aggregates without extraction or active replay changes',async({page:p,context:c},testInfo)=>{
 test.setTimeout(120000);
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),hash=text=>crypto.createHash('sha256').update(text).digest('hex'),source=original.source.csv_text,checklist={format:'skydash-debrief-checklist-v1',replay_model:original.debrief.replay_model,source_sha256:hash(source),title:'SECRET-SNAPSHOT-TITLE',items:[{id:'SECRET-C1',prompt:'SECRET-PROMPT-ONE',status:'Discussed',note:'SECRET-NOTE-ONE',row:4},{id:'SECRET-C2',prompt:'SECRET-PROMPT-TWO',status:'Pending',note:'',row:null}]};original.debrief.markers=[{id:'SECRET-I1',time_s:8,kind:'Question',text:'SECRET-INSTRUCTOR-ONE',discussed:false},{id:'SECRET-I2',time_s:8,kind:'Observation',text:'SECRET-INSTRUCTOR-TWO',discussed:true}];original.debrief.notes='SECRET-SNAPSHOT-SUMMARY';
 const errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});
 await p.goto(origin+'offline-review.html');await c.setOffline(true);const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles({name:'before.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');
 const save=async(button,target)=>{const waiting=p.waitForEvent('download');await button.click();const d=await waiting;await d.saveAs(target);return d.suggestedFilename();};
 await p.getByLabel('Go to local handoff task').selectOption('discussionOriginals');const sender=p.getByRole('region',{name:'Discussion originals handoff',exact:true});
 const make=async(name,csv,review,instructor)=>{await sender.getByLabel('Include original instructor sidecar in discussion ZIP').setChecked(Boolean(instructor));for(const[role,text]of Object.entries({source:csv,checklist:JSON.stringify(review),...(instructor?{instructor:JSON.stringify(instructor)}:{})}))await sender.getByLabel('Discussion handoff '+role+' file',{exact:true}).setInputFiles({name:'SECRET-'+role,mimeType:'text/plain',buffer:Buffer.from(text)});await sender.getByLabel('Acknowledge sensitive discussion originals ZIP').check();await sender.getByRole('button',{name:'Validate and prepare discussion originals ZIP',exact:true}).click();const target=testInfo.outputPath(name+'.zip');await save(sender.getByRole('button',{name:'Download discussion originals ZIP',exact:true}),target);return target;};
 const left=await make('left-discussion',source,checklist,original.debrief),rightChecklist=structuredClone(checklist),rightInstructor=structuredClone(original.debrief);rightChecklist.items.reverse();rightChecklist.items[1].note+=' changed';rightChecklist.title+=' changed';rightInstructor.markers[0].text+=' changed';rightInstructor.markers[1].id='SECRET-I3';rightInstructor.notes+=' changed';const right=await make('right-discussion',source,rightChecklist,rightInstructor),absent=await make('no-instructor-discussion',source,rightChecklist,null),otherCSV=source.replaceAll('\n','\r\n'),otherChecklist={...rightChecklist,source_sha256:hash(otherCSV)},other=await make('different-csv-discussion',otherCSV,otherChecklist,null);
 await p.getByLabel('Go to local handoff task').selectOption('discussionCompare');const tool=p.getByRole('region',{name:'Received discussion snapshot comparison',exact:true}),check=tool.getByRole('button',{name:'Check both discussion snapshots',exact:true}),download=tool.getByRole('button',{name:'Download discussion comparison JSON',exact:true}),result=tool.getByRole('region',{name:'Checked discussion snapshot differences',exact:true});await expect(tool).toBeFocused();await expect(check).toBeDisabled();await tool.getByLabel('Left discussion comparison ZIP',{exact:true}).setInputFiles(left);await tool.getByLabel('Right discussion comparison ZIP',{exact:true}).setInputFiles(right);const prior=downloads.length;await check.click();await expect(download).toBeEnabled();await expect(result).not.toContainText('SECRET-');expect(downloads.length).toBe(prior);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');
 const jsonPath=testInfo.outputPath('discussion-snapshot-differences.json');expect(await save(download,jsonPath)).toBe('skydash-discussion-snapshot-comparison.json');const value=JSON.parse(fs.readFileSync(jsonPath,'utf8'));expect(value).toMatchObject({format:'skydash-discussion-snapshot-comparison-v1',archiveBytesEqual:false,exactSourceBytesEqual:true,checklist:{titleChanged:true,normalizedContentEqualIgnoringOrder:false,savedOrderEqual:false,exactIdRows:{equal:1,changed:1,leftOnly:0,rightOnly:0},changedFields:{prompt:0,status:0,note:1,row:0},sameIdOrdinalDifferences:2},instructor:{state:'both-present',comparison:{summaryChanged:true,exactIdRows:{equal:0,changed:1,leftOnly:1,rightOnly:1},changedFields:{time_s:0,kind:0,text:1,discussed:0}}}});for(const word of['SECRET-',source,'28.6141','77.2094'])expect(fs.readFileSync(jsonPath,'utf8')).not.toContain(word);for(const side of[value.left,value.right])for(const raw of Object.values(side.originals))expect(raw.expected_digest_matched).toBe(false);
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});for(const[kind,label]of[['checklist','Checklist aggregate differences'],['instructor','Instructor aggregate differences']]){const card=tool.getByRole('region',{name:label,exact:true});await card.scrollIntoViewIfNeeded();await card.screenshot({path:testInfo.outputPath('discussion-comparison-'+kind+'-'+name+'.png')});}await tool.getByRole('heading',{name:'Checklist and optional instructor differences, without restoring replay',exact:true}).scrollIntoViewIfNeeded();await p.screenshot({path:testInfo.outputPath('discussion-comparison-controls-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 await tool.getByLabel('Right discussion comparison source expected SHA-256',{exact:true}).fill('f'.repeat(64));await expect(download).toBeDisabled();await expect(result).toHaveCount(0);await check.click();await expect(tool.getByRole('status',{name:'Discussion comparison status',exact:true})).toContainText('refused');await tool.getByLabel('Right discussion comparison source expected SHA-256',{exact:true}).fill('');await expect(download).toBeDisabled();await tool.getByLabel('Right discussion comparison ZIP',{exact:true}).setInputFiles(absent);await check.click();await expect(download).toBeEnabled();await expect(tool.getByRole('region',{name:'Instructor aggregate differences',exact:true})).toContainText('not present on both sides');await tool.getByLabel('Right discussion comparison ZIP',{exact:true}).setInputFiles(other);await check.click();await expect(result).toContainText('all suppressed');await expect(tool.getByRole('region',{name:'Checklist aggregate differences',exact:true})).toHaveCount(0);const suppressed=testInfo.outputPath('discussion-different-source.json');await save(download,suppressed);expect(JSON.parse(fs.readFileSync(suppressed,'utf8'))).toMatchObject({exactSourceBytesEqual:false,checklist:null,instructor:null});
 const unchanged=testInfo.outputPath('discussion-comparison-active-unchanged.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),unchanged);expect(JSON.parse(fs.readFileSync(unchanged,'utf8'))).toEqual(original);await p.getByLabel('Go to local handoff task').selectOption('discussionCompare');await tool.getByRole('button',{name:'Clear discussion snapshot comparison',exact:true}).click();await expect(download).toBeDisabled();await expect(check).toBeDisabled();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('two received discussion ZIPs feed explicit private instructor combination without extraction or replay changes',async({page:p,context:c},testInfo)=>{
 test.setTimeout(120000);
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),source=original.source.csv_text,hash=text=>crypto.createHash('sha256').update(text).digest('hex'),checklist={format:'skydash-debrief-checklist-v1',replay_model:original.debrief.replay_model,source_sha256:hash(source),title:'EXCLUDED-CHECKLIST-TITLE',items:[{id:'excluded-prompt',prompt:'EXCLUDED-CHECKLIST-WORDS',status:'Discussed',note:'EXCLUDED-REASON',row:4}]};original.debrief.markers=[{id:'same-id',time_s:8,kind:'Question',text:'PRIVATE <script>left disagreement</script>',discussed:false},{id:'left-only',time_s:8,kind:'Follow-up',text:'PRIVATE independent left',discussed:true}];original.debrief.notes='PRIVATE left whole summary';const right=structuredClone(original.debrief);right.markers[0].text='PRIVATE <b>right disagreement</b>';right.markers[0].discussed=true;right.markers[1].id='right-only';right.markers[1].text='PRIVATE independent right';right.markers[1].discussed=false;right.notes='PRIVATE right whole summary';
 const errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});await p.goto(origin+'offline-review.html');await c.setOffline(true);
 const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles({name:'before.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');
 const save=async(button,target)=>{const waiting=p.waitForEvent('download');await button.click();const d=await waiting;await d.saveAs(target);return d.suggestedFilename();};const baselinePath=testInfo.outputPath('received-combination-before.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),baselinePath);const beforeSnapshot=JSON.parse(fs.readFileSync(baselinePath,'utf8'));await p.getByLabel('Go to local handoff task').selectOption('discussionOriginals');const sender=p.getByRole('region',{name:'Discussion originals handoff',exact:true});
 const make=async(name,instructor)=>{await sender.getByLabel('Include original instructor sidecar in discussion ZIP').setChecked(Boolean(instructor));for(const[role,text]of Object.entries({source,checklist:JSON.stringify(checklist),...(instructor?{instructor:JSON.stringify(instructor)}:{})}))await sender.getByLabel('Discussion handoff '+role+' file',{exact:true}).setInputFiles({name:role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await sender.getByLabel('Acknowledge sensitive discussion originals ZIP').check();await sender.getByRole('button',{name:'Validate and prepare discussion originals ZIP',exact:true}).click();const target=testInfo.outputPath(name+'.zip');await save(sender.getByRole('button',{name:'Download discussion originals ZIP',exact:true}),target);return target;};
 const leftZIP=await make('left-combination-discussion',original.debrief),rightZIP=await make('right-combination-discussion',right),absent=await make('absent-combination-discussion',null);
 await p.getByLabel('Go to local handoff task').selectOption('combine');const tool=p.getByRole('region',{name:'Instructor review combination tool',exact:true}),route=tool.getByLabel('Instructor combination input route'),ack=tool.getByLabel('Acknowledge private instructor combination'),check=tool.getByRole('button',{name:'Validate originals for private combination',exact:true}),prepare=tool.getByRole('button',{name:'Prepare explicitly chosen instructor sidecar',exact:true}),download=tool.getByRole('button',{name:'Download combined instructor JSON',exact:true});await expect(route).toHaveValue('originals');await route.selectOption('discussion');await expect(tool.getByLabel('Combination source file',{exact:true})).toHaveCount(0);await tool.getByLabel('Combination left discussion ZIP',{exact:true}).setInputFiles(leftZIP);await tool.getByLabel('Combination right discussion ZIP',{exact:true}).setInputFiles(absent);await ack.check();await check.click();await expect(tool.getByRole('status',{exact:true})).toContainText('refused');await expect(tool.getByRole('region',{name:'Private instructor combination decisions',exact:true})).toHaveCount(0);await expect(ack).not.toBeChecked();
 await tool.getByLabel('Combination right discussion ZIP',{exact:true}).setInputFiles(rightZIP);await tool.getByLabel('Combination left discussion archive expected SHA-256',{exact:true}).fill(hash(fs.readFileSync(leftZIP)));await tool.getByLabel('Combination right discussion source expected SHA-256',{exact:true}).fill(hash(source));await tool.getByLabel('Combination right discussion instructor expected SHA-256',{exact:true}).fill(hash(JSON.stringify(right)));await expect(check).toBeDisabled();const beforeDownloads=downloads.length;await ack.check();await check.click();const decisions=tool.getByRole('region',{name:'Private instructor combination decisions',exact:true}),evidence=tool.getByRole('region',{name:'Checked discussion combination archive evidence',exact:true});await expect(evidence).toContainText('Both checklists validated but are excluded and unchanged');await expect(evidence).not.toContainText('EXCLUDED-CHECKLIST-WORDS');await expect(evidence).toContainText('Independent archive expectation matched');await expect(evidence).toContainText('Independent raw-file expectation not supplied');await expect(ack).not.toBeChecked();await expect(prepare).toBeDisabled();await expect(download).toBeDisabled();expect(downloads.length).toBe(beforeDownloads);const list=decisions.getByRole('list',{name:'All combination annotation choices',exact:true}),same=list.locator('li').filter({has: p.getByRole('heading',{name:/ID same-id$/})});await expect(same.getByRole('combobox')).toHaveValue('');await decisions.getByRole('button',{name:'Select unresolved unique and equal annotations from both',exact:true}).click();await expect(same.getByRole('combobox')).toHaveValue('');await same.getByRole('combobox').selectOption('right');await expect(prepare).toBeDisabled();await tool.getByLabel('Combination summary choice').selectOption('right');await prepare.click();await expect(tool.getByRole('region',{name:'Combined instructor candidate',exact:true})).toContainText('3 selected annotations');await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');expect(await same.locator('script,b').count()).toBe(0);
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await same.screenshot({path:testInfo.outputPath('received-combination-decisions-'+name+'.png')});await route.scrollIntoViewIfNeeded();await p.screenshot({path:testInfo.outputPath('received-combination-controls-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const candidatePath=testInfo.outputPath('received-combined-instructor.json');expect(await save(download,candidatePath)).toBe('skydash-combined-instructor-review.json');const combined=JSON.parse(fs.readFileSync(candidatePath,'utf8'));expect(combined).toMatchObject({format:original.debrief.format,replay_model:original.debrief.replay_model,source_sha256:hash(source),notes:right.notes});expect(combined.markers).toHaveLength(3);const byID=Object.fromEntries(combined.markers.map(row=>[row.id,row]));for(const row of[right.markers[0],original.debrief.markers[1],right.markers[1]])expect(byID[row.id]).toEqual(row);expect(fs.readFileSync(candidatePath,'utf8')).not.toContain('EXCLUDED');
 const progressPath=testInfo.outputPath('received-combination-decisions.json');await save(decisions.getByRole('button',{name:'Download instructor decision progress',exact:true}),progressPath);await tool.getByLabel('Combination right discussion source expected SHA-256',{exact:true}).fill('f'.repeat(64));await expect(decisions).toHaveCount(0);await expect(ack).not.toBeChecked();await tool.getByLabel('Combination right discussion source expected SHA-256',{exact:true}).fill(hash(source));await ack.check();await check.click();const sameAgain=tool.getByRole('list',{name:'All combination annotation choices',exact:true}).locator('li').filter({has:p.getByRole('heading',{name:/ID same-id$/})});await expect(sameAgain.getByRole('combobox')).toHaveValue('');await decisions.getByLabel('Import instructor decision progress').setInputFiles(progressPath);await expect(decisions.getByRole('region',{name:'Instructor decision progress replacement preview',exact:true})).toBeVisible();await expect(sameAgain.getByRole('combobox')).toHaveValue('');await decisions.getByRole('button',{name:'Restore reviewed instructor decisions',exact:true}).click();await expect(sameAgain.getByRole('combobox')).toHaveValue('right');await expect(download).toBeDisabled();await prepare.click();await expect(download).toBeEnabled();
 const unchanged=testInfo.outputPath('received-combination-active-unchanged.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),unchanged);expect(JSON.parse(fs.readFileSync(unchanged,'utf8'))).toEqual(beforeSnapshot);await p.getByLabel('Go to local handoff task').selectOption('combine');await route.selectOption('originals');await expect(decisions).toHaveCount(0);await expect(ack).not.toBeChecked();await ack.check();await expect(check).toBeDisabled();await route.selectOption('discussion');await expect(tool.getByLabel('Combination left discussion ZIP',{exact:true})).toHaveValue('');await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('complete private received discussion comparison prints all exact original words only after separate consent without restoring replay',async({page:p,context:c},testInfo)=>{
 test.setTimeout(120000);
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),source=original.source.csv_text,hash=text=>crypto.createHash('sha256').update(text).digest('hex'),checklist={format:'skydash-debrief-checklist-v1',replay_model:original.debrief.replay_model,source_sha256:hash(source),title:'PRIVATE <img src=x> left title',items:[{id:'first-prompt',prompt:'PRIVATE <script>first prompt</script>',status:'Discussed',note:'PRIVATE <b>first saved note</b>\nsecond line',row:4},{id:'second-prompt',prompt:'PRIVATE second prompt',status:'Not applicable',note:'PRIVATE saved reason',row:null}]};original.debrief.markers=[{id:'first-instructor',time_s:8,kind:'Question',text:'PRIVATE <script>first instructor</script>',discussed:true},{id:'second-instructor',time_s:8,kind:'Follow-up',text:'PRIVATE second instructor',discussed:false}];original.debrief.notes='PRIVATE <b>left summary</b>';
 const errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});await p.goto(origin+'offline-review.html');await c.setOffline(true);
 const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles({name:'before.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');
 const save=async(button,target)=>{const waiting=p.waitForEvent('download');await button.click();const d=await waiting;await d.saveAs(target);return d.suggestedFilename();};await p.getByLabel('Go to local handoff task').selectOption('discussionOriginals');const sender=p.getByRole('region',{name:'Discussion originals handoff',exact:true});await sender.getByLabel('Include original instructor sidecar in discussion ZIP').check();
 const make=async(name,review,instructor)=>{for(const[role,text]of Object.entries({source,checklist:JSON.stringify(review),instructor:JSON.stringify(instructor)}))await sender.getByLabel('Discussion handoff '+role+' file',{exact:true}).setInputFiles({name:role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await sender.getByLabel('Acknowledge sensitive discussion originals ZIP').check();await sender.getByRole('button',{name:'Validate and prepare discussion originals ZIP',exact:true}).click();const target=testInfo.outputPath(name+'.zip');await save(sender.getByRole('button',{name:'Download discussion originals ZIP',exact:true}),target);return target;};
 const left=await make('left-private-snapshot',checklist,original.debrief),rightChecklist=structuredClone(checklist),rightInstructor=structuredClone(original.debrief);rightChecklist.title='PRIVATE <b>right title</b>';rightChecklist.items.reverse();rightChecklist.items[0].id='right-only-prompt';rightChecklist.items[1].note+=' changed';rightInstructor.markers[0].text+=' changed';rightInstructor.markers[1].id='right-only-instructor';rightInstructor.notes='PRIVATE <iframe>right summary</iframe>';const right=await make('right-private-snapshot',rightChecklist,rightInstructor);
 await p.getByLabel('Go to local handoff task').selectOption('discussionCompare');const comparison=p.getByRole('region',{name:'Received discussion snapshot comparison',exact:true});for(const[side,zip]of[['Left',left],['Right',right]])await comparison.getByLabel(side+' discussion comparison ZIP',{exact:true}).setInputFiles(zip);await comparison.getByRole('button',{name:'Check both discussion snapshots',exact:true}).click();const tool=comparison.getByRole('region',{name:'Private received discussion comparison packet',exact:true}),ack=tool.getByLabel('Acknowledge complete sensitive discussion comparison'),prepare=tool.getByRole('button',{name:'Prepare complete private comparison HTML',exact:true}),download=tool.getByRole('button',{name:'Download complete private comparison HTML',exact:true});await expect(prepare).toBeDisabled();await expect(download).toBeDisabled();const prior=downloads.length;await ack.check();await prepare.click();await expect(tool.getByLabel('Prepared sensitive discussion comparison')).toContainText('Left checklist 2 prompts, Right checklist 2 prompts');await expect(ack).not.toBeChecked();await expect(prepare).toBeDisabled();expect(downloads.length).toBe(prior);await expect(tool).not.toContainText('PRIVATE <script>');await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');
 await p.setViewportSize({width:390,height:1000});await ack.scrollIntoViewIfNeeded();await p.screenshot({path:testInfo.outputPath('private-comparison-controls-mobile.png')});
 const htmlPath=testInfo.outputPath('complete-private-comparison.html');expect(await save(download,htmlPath)).toBe('skydash-private-discussion-comparison.html');const html=fs.readFileSync(htmlPath,'utf8');for(const text of['<script','<img','<iframe','<form','<input','<a ','<link',source,'28.6141','77.2094'])expect(html).not.toContain(text);for(const text of['PRIVATE &lt;img src=x&gt; left title','PRIVATE &lt;b&gt;right title&lt;/b&gt;','PRIVATE &lt;script&gt;first prompt&lt;/script&gt;','PRIVATE &lt;script&gt;first instructor&lt;/script&gt; changed','PRIVATE &lt;iframe&gt;right summary&lt;/iframe&gt;','Original context row 3 at 4s, age 4s','Held original row, no observation at annotation time','Exact-ID relation: left-only','Exact-ID relation: right-only','Saved ordinal 1','Saved ordinal 2'])expect(html).toContain(text);
 const report=await c.newPage(),reportRequests=[];report.on('request',r=>reportRequests.push(r.url()));report.on('pageerror',e=>errors.push(e.message));await report.setContent(html);await expect(report.getByRole('heading',{level:1})).toHaveText('Private Left / Right discussion comparison');await expect(report.getByRole('region',{name:'Private checklist comparison chapter'})).toContainText(checklist.items[0].prompt);await expect(report.getByRole('region',{name:'Private instructor comparison chapter'})).toContainText(rightInstructor.notes);expect(await report.locator('script,img,iframe,form,input,a,link').count()).toBe(0);for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await report.setViewportSize({width,height});await report.screenshot({path:testInfo.outputPath('private-comparison-report-'+name+'.png'),fullPage:true});for(const[kind,label]of[['checklist','Private checklist comparison chapter'],['instructor','Private instructor comparison chapter']])await report.getByRole('region',{name:label,exact:true}).locator('.item').first().screenshot({path:testInfo.outputPath('private-comparison-'+kind+'-'+name+'.png')});expect(await report.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}await report.emulateMedia({media:'print'});await report.pdf({path:testInfo.outputPath('private-comparison-report.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});expect(reportRequests).toEqual([]);await report.close();
 const unchanged=testInfo.outputPath('private-comparison-active-unchanged.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),unchanged);expect(JSON.parse(fs.readFileSync(unchanged,'utf8'))).toEqual(original);await p.getByLabel('Go to local handoff task').selectOption('discussionCompare');await comparison.getByLabel('Left discussion comparison archive expected SHA-256',{exact:true}).fill('f'.repeat(64));await expect(tool).toHaveCount(0);await comparison.getByLabel('Left discussion comparison archive expected SHA-256',{exact:true}).fill('');await comparison.getByRole('button',{name:'Check both discussion snapshots',exact:true}).click();await expect(ack).not.toBeChecked();await expect(download).toBeDisabled();await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('explicit checklist combination preserves whole reviewer items across originals and received ZIP routes without changing active review',async({page:p,context:c},testInfo)=>{
 test.setTimeout(120000);
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),source=original.source.csv_text,hash=value=>crypto.createHash('sha256').update(value).digest('hex'),item=(id,patch={})=>({id,prompt:'PRIVATE <script>left prompt</script>',status:'Pending',note:'',row:null,...patch}),left={format:'skydash-debrief-checklist-v1',replay_model:original.debrief.replay_model,source_sha256:hash(source),title:'PRIVATE left title',items:[item('same'),item('left-only',{prompt:'PRIVATE independent left',status:'Discussed',note:'PRIVATE left note',row:4})]},right={...left,title:'PRIVATE right title',items:[item('right-only',{prompt:'PRIVATE independent right',note:'(empty)',row:4}),item('same',{prompt:'PRIVATE <b>right prompt</b>',status:'Not applicable',note:'PRIVATE right reason',row:4})]},errors=[],requests=[],downloads=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});await p.goto(origin+'offline-review.html');await c.setOffline(true);
 const save=async(button,target)=>{const pending=p.waitForEvent('download');await button.click();const d=await pending;await d.saveAs(target);return d.suggestedFilename();},portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles({name:'before.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Visible review panel group').selectOption('debrief');const active=p.getByRole('article',{name:'Reusable discussion checklist',exact:true});await active.getByLabel('Import discussion checklist JSON').setInputFiles({name:'active.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(left))});await active.getByRole('button',{name:'Replace discussion checklist',exact:true}).click();await p.getByLabel('Visible review panel group').selectOption('all');await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');
 const beforeCase=testInfo.outputPath('checklist-combination-before-case.json'),beforeChecklist=testInfo.outputPath('checklist-combination-before-checklist.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),beforeCase);await save(active.getByRole('button',{name:'Download checklist review JSON',exact:true}),beforeChecklist);await p.getByLabel('Go to local handoff task').selectOption('checklistCombine');const tool=p.getByRole('region',{name:'Checklist review combination tool',exact:true}),route=tool.getByLabel('Checklist combination input route'),ack=tool.getByLabel('Acknowledge private checklist combination'),check=tool.getByRole('button',{name:'Validate originals for checklist combination',exact:true}),prepare=tool.getByRole('button',{name:'Prepare explicitly chosen checklist',exact:true}),download=tool.getByRole('button',{name:'Download combined checklist JSON',exact:true});await expect(tool).toBeFocused();await expect(route).toHaveValue('originals');for(const[role,text]of Object.entries({source,left:JSON.stringify(left),right:JSON.stringify(right)}))await tool.getByLabel('Checklist combination '+role+' file',{exact:true}).setInputFiles({name:role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await expect(check).toBeDisabled();await tool.getByLabel('Checklist combination source expected SHA-256',{exact:true}).fill('a'.repeat(64));await ack.check();await check.click();await expect(tool.getByRole('status',{exact:true})).toContainText('refused');await expect(ack).not.toBeChecked();await tool.getByLabel('Checklist combination source expected SHA-256',{exact:true}).fill(hash(source));const count=downloads.length;await ack.check();await check.click();const decisions=tool.getByRole('region',{name:'Private checklist combination decisions',exact:true}),same=tool.getByRole('list',{name:'All checklist combination item choices',exact:true}).locator('li').filter({has:p.getByRole('heading',{name:'ID same: changed',exact:true})});await expect(ack).not.toBeChecked();await expect(prepare).toBeDisabled();await expect(download).toBeDisabled();expect(downloads.length).toBe(count);await expect(same).toContainText('Original ordinal differs: true');await expect(same.getByRole('region',{name:'right combination item same',exact:true})).toContainText('PRIVATE right reason');await expect(same.getByRole('region',{name:'right combination item same',exact:true})).toContainText('GAP over5s');expect(await same.locator('script,b').count()).toBe(0);await decisions.getByRole('button',{name:'Select unresolved nonconflicting items from both',exact:true}).click();await expect(tool.getByLabel('Checklist combination item same choice')).toHaveValue('');await tool.getByLabel('Checklist combination item same choice').selectOption('right');await expect(prepare).toBeDisabled();await tool.getByLabel('Checklist combination title choice').selectOption('right');await prepare.click();const candidate=tool.getByRole('region',{name:'Combined checklist candidate',exact:true});await expect(candidate).toContainText('3 chosen items');await expect(candidate).toContainText('Not applicable');const firstPath=testInfo.outputPath('combined-checklist-original-route.json');expect(await save(download,firstPath)).toBe('skydash-combined-discussion-checklist.json');const expected={...left,title:right.title,items:[right.items[1],left.items[1],right.items[0]]};expect(JSON.parse(fs.readFileSync(firstPath,'utf8'))).toEqual(expected);
 await p.getByLabel('Go to local handoff task').selectOption('discussionOriginals');const sender=p.getByRole('region',{name:'Discussion originals handoff',exact:true}),make=async(name,review,include)=>{await sender.getByLabel('Include original instructor sidecar in discussion ZIP').setChecked(include);for(const[role,text]of Object.entries({source,checklist:JSON.stringify(review),...(include?{instructor:JSON.stringify({...original.debrief,notes:'EXCLUDED-INSTRUCTOR-WORDS'})}:{})}))await sender.getByLabel('Discussion handoff '+role+' file',{exact:true}).setInputFiles({name:role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await sender.getByLabel('Acknowledge sensitive discussion originals ZIP').check();await sender.getByRole('button',{name:'Validate and prepare discussion originals ZIP',exact:true}).click();const target=testInfo.outputPath(name+'.zip');await save(sender.getByRole('button',{name:'Download discussion originals ZIP',exact:true}),target);return target;};const a=await make('left-checklist-discussion',left,false),b=await make('right-checklist-discussion',right,true);await p.getByLabel('Go to local handoff task').selectOption('checklistCombine');await route.selectOption('discussion');await expect(decisions).toHaveCount(0);await expect(ack).not.toBeChecked();await tool.getByLabel('Checklist combination left discussion ZIP',{exact:true}).setInputFiles(a);await tool.getByLabel('Checklist combination right discussion ZIP',{exact:true}).setInputFiles(b);await tool.getByLabel('Checklist combination left discussion archive expected SHA-256',{exact:true}).fill(hash(fs.readFileSync(a)));await tool.getByLabel('Checklist combination right discussion source expected SHA-256',{exact:true}).fill(hash(source));await tool.getByLabel('Checklist combination right discussion checklist expected SHA-256',{exact:true}).fill(hash(JSON.stringify(right)));await ack.check();await check.click();const evidence=tool.getByRole('region',{name:'Checked checklist combination ZIP evidence',exact:true});await expect(evidence).toContainText('Instructor original absent');await expect(evidence).toContainText('Instructor original included and checked');await expect(evidence).not.toContainText('EXCLUDED-INSTRUCTOR-WORDS');await expect(evidence).toContainText('Independent archive expectation matched');await expect(evidence).toContainText('Independent raw-file expectation not supplied');await expect(tool.getByLabel('Checklist combination item same choice')).toHaveValue('');await decisions.getByRole('button',{name:'Select unresolved nonconflicting items from both',exact:true}).click();await tool.getByLabel('Checklist combination item same choice').selectOption('right');await tool.getByLabel('Checklist combination title choice').selectOption('right');await prepare.click();
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await same.screenshot({path:testInfo.outputPath('checklist-combination-decisions-'+name+'.png')});await candidate.screenshot({path:testInfo.outputPath('checklist-combination-candidate-'+name+'.png')});await route.scrollIntoViewIfNeeded();await p.screenshot({path:testInfo.outputPath('checklist-combination-controls-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const finalPath=testInfo.outputPath('combined-checklist-zip-route.json');await save(download,finalPath);expect(JSON.parse(fs.readFileSync(finalPath,'utf8'))).toEqual(expected);const afterCase=testInfo.outputPath('checklist-combination-after-case.json'),afterChecklist=testInfo.outputPath('checklist-combination-after-checklist.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),afterCase);await save(active.getByRole('button',{name:'Download checklist review JSON',exact:true}),afterChecklist);expect(JSON.parse(fs.readFileSync(afterCase,'utf8'))).toEqual(JSON.parse(fs.readFileSync(beforeCase,'utf8')));expect(JSON.parse(fs.readFileSync(afterChecklist,'utf8'))).toEqual(JSON.parse(fs.readFileSync(beforeChecklist,'utf8')));await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');await p.getByLabel('Go to local handoff task').selectOption('checklistCombine');await tool.getByLabel('Checklist combination right discussion checklist expected SHA-256',{exact:true}).fill('f'.repeat(64));await expect(decisions).toHaveCount(0);await tool.getByLabel('Checklist combination right discussion checklist expected SHA-256',{exact:true}).fill(hash(JSON.stringify(right)));await expect(check).toBeDisabled();await route.selectOption('originals');await expect(tool.getByLabel('Checklist combination source file',{exact:true})).toHaveValue('');await route.selectOption('discussion');await expect(tool.getByLabel('Checklist combination left discussion ZIP',{exact:true})).toHaveValue('');await expect(ack).not.toBeChecked();
 await active.getByLabel('Import discussion checklist JSON').setInputFiles(finalPath);await expect(active.getByLabel('Discussion checklist import preview')).toContainText('3 imported prompts');await expect(active.getByLabel('Discussion checklist counts')).toContainText('2/30 saved prompts');await active.getByRole('button',{name:'Replace discussion checklist',exact:true}).click();await expect(active.getByLabel('Discussion checklist counts')).toContainText('3/30 saved prompts');const reopened=testInfo.outputPath('combined-checklist-reopened.json');await save(active.getByRole('button',{name:'Download checklist review JSON',exact:true}),reopened);expect(JSON.parse(fs.readFileSync(reopened,'utf8'))).toEqual(expected);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('discussion intake checks each selected ZIP independently with honest fingerprint relations and refused rows without active review changes',async({page:p,context:c},testInfo)=>{
 test.setTimeout(120000);
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),source=original.source.csv_text,hash=value=>crypto.createHash('sha256').update(value).digest('hex'),review={format:'skydash-debrief-checklist-v1',replay_model:original.debrief.replay_model,source_sha256:hash(source),title:'PRIVATE intake left checklist',items:[{id:'private-intake-item',prompt:'PRIVATE intake prompt',status:'Discussed',note:'PRIVATE intake note',row:4}]};original.debrief.markers=[{id:'private-intake-marker',time_s:8,kind:'Question',text:'PRIVATE intake instructor',discussed:true}];original.debrief.notes='PRIVATE intake summary';const errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});await p.goto(origin+'offline-review.html');await c.setOffline(true);
 const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles({name:'before.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');const save=async(button,target)=>{const waiting=p.waitForEvent('download');await button.click();const d=await waiting;await d.saveAs(target);return d.suggestedFilename();};
 await p.getByLabel('Go to local handoff task').selectOption('discussionOriginals');const sender=p.getByRole('region',{name:'Discussion originals handoff',exact:true});const make=async(name,csv,checklist,include=true)=>{await sender.getByLabel('Include original instructor sidecar in discussion ZIP').setChecked(include);const instructor={...original.debrief,source_sha256:hash(csv)};for(const[role,text]of Object.entries({source:csv,checklist:JSON.stringify(checklist),...(include?{instructor:JSON.stringify(instructor)}:{})}))await sender.getByLabel('Discussion handoff '+role+' file',{exact:true}).setInputFiles({name:'PRIVATE-'+role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await sender.getByLabel('Acknowledge sensitive discussion originals ZIP').check();await sender.getByRole('button',{name:'Validate and prepare discussion originals ZIP',exact:true}).click();const target=testInfo.outputPath(name+'.zip');await save(sender.getByRole('button',{name:'Download discussion originals ZIP',exact:true}),target);return target;};const left=await make('PRIVATE-intake-left',source,review),rightReview={...review,title:'PRIVATE intake right checklist'},right=await make('PRIVATE-intake-right',source,rightReview),absent=await make('PRIVATE-intake-no-instructor',source,review,false),otherSource=source.replaceAll('\n','\r\n'),other=await make('PRIVATE-intake-other-raw-source',otherSource,{...review,source_sha256:hash(otherSource)}),bad=testInfo.outputPath('PRIVATE-intake-damaged.zip'),badBytes=Buffer.from(fs.readFileSync(left));badBytes[50]^=1;fs.writeFileSync(bad,badBytes);
 await p.getByLabel('Go to local handoff task').selectOption('discussionIntake');const tool=p.getByRole('region',{name:'Discussion originals intake queue',exact:true}),check=tool.getByRole('button',{name:'Check selected discussion ZIPs',exact:true}),download=tool.getByRole('button',{name:'Download discussion intake JSON',exact:true}),result=tool.getByRole('region',{name:'Checked discussion intake inventories',exact:true});await expect(tool).toBeFocused();await expect(check).toBeDisabled();await tool.getByLabel('Discussion intake ZIP files',{exact:true}).setInputFiles([left,bad,right,left,absent,other]);await expect(result).toHaveCount(0);await expect(tool.getByLabel('Selected discussion intake bounds')).toContainText('Selected 6 input files');const chosen=tool.getByRole('list',{name:'Selected discussion intake inputs',exact:true}).locator(':scope > li');for(const[index,role,digest]of[[1,'source',hash(source)],[3,'checklist',hash(JSON.stringify(rightReview))],[4,'archive',hash(fs.readFileSync(left))],[6,'source',hash(otherSource)]]){await chosen.nth(index-1).getByText('Optional independent expectations for input '+index,{exact:true}).click();await tool.getByLabel('Intake input '+index+' '+role+' expected SHA-256',{exact:true}).fill(digest);}const prior=downloads.length;await check.click();await expect(result).toContainText('Complete archive checks: 5; refused inputs: 1');
 await expect(result).not.toContainText('PRIVATE');await expect(result.getByLabel('Intake input 2 result',{exact:true})).toContainText('REFUSED, no originals verified');await expect(result.getByLabel('Intake input 4 result',{exact:true})).toContainText('Archive digest matches earlier selected input: 1');await expect(result.getByLabel('Intake input 5 result',{exact:true})).toContainText('absent, not empty or complete');await expect(result.getByLabel('Intake input 6 result',{exact:true})).toContainText('Raw-source digest matches earlier selected input: none');expect(downloads.length).toBe(prior);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await result.getByLabel('Intake input 1 result',{exact:true}).evaluate(e=>e.scrollIntoView({block:'center'}));await p.screenshot({path:testInfo.outputPath('discussion-intake-inventory-'+name+'.png')});await result.getByLabel('Intake input 2 result',{exact:true}).screenshot({path:testInfo.outputPath('discussion-intake-refused-'+name+'.png')});await result.getByLabel('Intake input 4 result',{exact:true}).screenshot({path:testInfo.outputPath('discussion-intake-fingerprints-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const receiptPath=testInfo.outputPath('discussion-intake-partial.json');expect(await save(download,receiptPath)).toBe('skydash-discussion-intake.json');const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));expect(receipt).toMatchObject({format:'skydash-discussion-intake-v1',checked_archives:5,refused_archives:1});expect(receipt.entries[1]).toEqual({ordinal:2,state:'refused'});expect(receipt.entries.map(row=>row.state==='checked'?[row.ordinal,row.archiveDigestMatchesEarlierOrdinal,row.sourceDigestMatchesEarlierOrdinal]:[row.ordinal])).toEqual([[1,null,null],[2],[3,null,1],[4,1,1],[5,null,1],[6,null,null]]);expect(receipt.entries[0].inventory.originals.source.expected_digest_matched).toBe(true);expect(receipt.entries[2].inventory.originals.checklist.expected_digest_matched).toBe(true);expect(receipt.entries[3].inventory.expectedArchiveDigestMatched).toBe(true);expect(receipt.entries[3].inventory.originals.source.expected_digest_matched).toBe(false);for(const text of['PRIVATE','private-intake-item','private-intake-marker',source,'28.6141','77.2094'])expect(JSON.stringify(receipt)).not.toContain(text);
 const rawPin=tool.getByLabel('Intake input 3 checklist expected SHA-256',{exact:true});await rawPin.fill('f'.repeat(64));await expect(result).toHaveCount(0);await expect(download).toBeDisabled();await check.click();await expect(result).toContainText('Complete archive checks: 4; refused inputs: 2');await expect(result.getByLabel('Intake input 3 result',{exact:true})).toContainText('REFUSED');await rawPin.fill(hash(JSON.stringify(rightReview)));await expect(result).toHaveCount(0);await check.click();await expect(result).toContainText('Complete archive checks: 5; refused inputs: 1');await tool.getByLabel('Discussion intake ZIP files',{exact:true}).setInputFiles([absent,other]);await expect(result).toHaveCount(0);await expect(download).toBeDisabled();await expect(tool.getByLabel('Intake input 1 archive expected SHA-256',{exact:true})).toHaveValue('');await check.click();await expect(result).toContainText('Complete archive checks: 2; refused inputs: 0');await expect(result.getByRole('list',{name:'All discussion intake results',exact:true}).locator(':scope > li')).toHaveCount(2);await expect(result.getByLabel('Intake input 2 result',{exact:true})).toContainText('Raw-source digest matches earlier selected input: none');
 const unchanged=testInfo.outputPath('discussion-intake-active-unchanged.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),unchanged);expect(JSON.parse(fs.readFileSync(unchanged,'utf8'))).toEqual(original);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');await p.getByLabel('Go to local handoff task').selectOption('discussionIntake');await tool.getByRole('button',{name:'Clear discussion intake queue',exact:true}).click();await expect(result).toHaveCount(0);await expect(check).toBeDisabled();await p.getByLabel('Go to local handoff task').selectOption('discussionOriginals');await expect(sender.getByRole('button',{name:'Download discussion originals ZIP',exact:true})).toBeEnabled();expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('selected whole discussion originals privately preview then separately package exact chosen bytes without changing active reviews',async({page:p,context:c},testInfo)=>{
 test.setTimeout(120000);
 const original=JSON.parse(fs.readFileSync(src+'/case.json','utf8')),source=original.source.csv_text,hash=text=>crypto.createHash('sha256').update(text).digest('hex'),leftChecklist={format:'skydash-debrief-checklist-v1',replay_model:original.debrief.replay_model,source_sha256:hash(source),title:'PRIVATE <img src=x> left agenda',items:[{id:'gap-prompt',prompt:'PRIVATE <script>left question</script>',status:'Discussed',note:'PRIVATE left saved note\nsecond line',row:4},{id:'other-prompt',prompt:'PRIVATE other question',status:'Not applicable',note:'PRIVATE saved reason',row:null}]};original.debrief.markers=[{id:'later-first',time_s:8,kind:'Question',text:'PRIVATE <script>left original-first instructor</script>',discussed:true},{id:'earlier-second',time_s:0,kind:'Follow-up',text:'PRIVATE left original-second instructor',discussed:false}];original.debrief.notes='PRIVATE <b>left whole summary</b>';
 const rightChecklist=structuredClone(leftChecklist),rightInstructor=structuredClone(original.debrief);rightChecklist.title='PRIVATE <b>right chosen agenda</b>';rightChecklist.items.reverse();rightChecklist.items[0].prompt='PRIVATE selected right first question';rightChecklist.items[1].note='PRIVATE selected right whole note';rightInstructor.notes='PRIVATE excluded right summary';rightInstructor.markers[0].text='PRIVATE excluded right instructor';
 const texts={left:{source,checklist:' '+JSON.stringify(leftChecklist,null,2)+'\n',instructor:JSON.stringify(original.debrief,null,2)+'\n'},right:{source,checklist:JSON.stringify(rightChecklist)+'\n ',instructor:' '+JSON.stringify(rightInstructor)+'\n'}};
 const errors=[],requests=[],downloads=[];p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('blob:'))requests.push(r.url());});await p.addInitScript(()=>{window.effects=[];for(const[proto,name]of[[Storage.prototype,'setItem'],[IDBFactory.prototype,'open'],[window,'fetch']]){const old=proto[name];proto[name]=function(...args){window.effects.push(name);return old.apply(this,args);};}});await p.goto(origin+'offline-review.html');await c.setOffline(true);
 const portable=p.getByRole('article',{name:'Portable review case',exact:true});await portable.getByLabel('Open review case JSON',{exact:true}).setInputFiles({name:'before.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(original))});await portable.getByRole('button',{name:'Replace local workspace with case',exact:true}).click();await p.getByLabel('Replay position',{exact:true}).fill('8');const pair=p.getByRole('article',{name:'Two-flight comparison',exact:true});await pair.getByText('Load synthetic baseline',{exact:true}).click();await pair.getByLabel('Comparison time',{exact:true}).fill('6');
 const save=async(button,target)=>{const waiting=p.waitForEvent('download');await button.click();const d=await waiting;await d.saveAs(target);return d.suggestedFilename();};const baselinePath=testInfo.outputPath('selected-normalized-before.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),baselinePath);const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));expect(baseline.debrief).toEqual({...original.debrief,markers:[...original.debrief.markers].sort((a,b)=>a.time_s-b.time_s)});await p.getByLabel('Go to local handoff task').selectOption('discussionOriginals');const sender=p.getByRole('region',{name:'Discussion originals handoff',exact:true});await sender.getByLabel('Include original instructor sidecar in discussion ZIP').check();
 const make=async(side)=>{for(const[role,text]of Object.entries(texts[side]))await sender.getByLabel('Discussion handoff '+role+' file',{exact:true}).setInputFiles({name:role+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await sender.getByLabel('Acknowledge sensitive discussion originals ZIP').check();await sender.getByRole('button',{name:'Validate and prepare discussion originals ZIP',exact:true}).click();const target=testInfo.outputPath(side+'-selected-input.zip');await save(sender.getByRole('button',{name:'Download discussion originals ZIP',exact:true}),target);return target;};const left=await make('left'),right=await make('right');
 await p.getByLabel('Go to local handoff task').selectOption('discussionCompare');const comparison=p.getByRole('region',{name:'Received discussion snapshot comparison',exact:true}),check=comparison.getByRole('button',{name:'Check both discussion snapshots',exact:true});for(const[side,zip]of[['Left',left],['Right',right]])await comparison.getByLabel(side+' discussion comparison ZIP',{exact:true}).setInputFiles(zip);for(const[side,role,digest]of[['Left','archive',hash(fs.readFileSync(left))],['Right','source',hash(source)],['Right','checklist',hash(texts.right.checklist)],['Left','instructor',hash(texts.left.instructor)]])await comparison.getByLabel(side+' discussion comparison '+role+' expected SHA-256',{exact:true}).fill(digest);await check.click();const tool=comparison.getByRole('region',{name:'Selected complete discussion originals handoff',exact:true}),choice=tool.getByLabel('Selected handoff checklist side'),instructor=tool.getByLabel('Selected handoff instructor side'),ack=tool.getByLabel('Acknowledge selected complete private reviews'),inspect=tool.getByRole('button',{name:'Preview selected complete private originals',exact:true}),zipAck=tool.getByLabel('Acknowledge selected sensitive originals ZIP'),prepare=tool.getByRole('button',{name:'Prepare selected complete originals ZIP',exact:true}),download=tool.getByRole('button',{name:'Download selected discussion originals ZIP',exact:true}),preview=tool.getByRole('region',{name:'Selected complete private originals preview',exact:true});await expect(choice).toHaveValue('');await expect(instructor).toHaveValue('');await expect(inspect).toBeDisabled();await expect(zipAck).toBeDisabled();await expect(tool).not.toContainText('PRIVATE ');await choice.selectOption('right');await instructor.selectOption('left');await expect(inspect).toBeDisabled();
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await choice.evaluate(e=>e.parentElement.parentElement.scrollIntoView({block:'center'}));await p.screenshot({path:testInfo.outputPath('selected-discussion-choices-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 const before=downloads.length;await ack.check();await inspect.click();await expect(preview).toContainText(rightChecklist.title);await expect(preview).toContainText(rightChecklist.items[0].prompt);await expect(preview).toContainText('Original row 4 at 12s; previous spacing 8s / GAP over5s');await expect(preview).toContainText(original.debrief.notes);await expect(preview).toContainText('Gap-held context');await expect(preview).not.toContainText(rightInstructor.notes);await expect(preview).not.toContainText('28.6141');expect(await preview.locator('script,img,iframe').count()).toBe(0);await expect(preview.getByRole('list',{name:'All selected original instructor annotations'}).locator('li').first()).toContainText('later-first');await expect(ack).not.toBeChecked();await expect(prepare).toBeDisabled();expect(downloads.length).toBe(before);
 for(const[width,height,name]of[[1280,1000,'desktop'],[390,1000,'mobile']]){await p.setViewportSize({width,height});await preview.getByRole('list',{name:'All selected original checklist items'}).evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('selected-discussion-checklist-'+name+'.png')});await preview.getByRole('list',{name:'All selected original instructor annotations'}).evaluate(e=>e.scrollIntoView({block:'start'}));await p.screenshot({path:testInfo.outputPath('selected-discussion-instructor-'+name+'.png')});expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);}
 await zipAck.check();await prepare.click();await expect(tool.getByLabel('Prepared selected discussion ZIP')).toContainText('5 fixed entries');await expect(zipAck).not.toBeChecked();expect(downloads.length).toBe(before);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');const zip=testInfo.outputPath('selected-five.zip'),receiptPath=testInfo.outputPath('selected-receipt.json');expect(await save(download,zip)).toBe('skydash-selected-discussion-originals.zip');expect(await save(tool.getByRole('button',{name:'Download selected handoff receipt JSON',exact:true}),receiptPath)).toBe('skydash-selected-discussion-handoff-receipt.json');const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));expect(receipt).toMatchObject({format:'skydash-selected-discussion-handoff-v1',selection:{checklist:'right',instructor:'left'},output_archive_sha256:hash(fs.readFileSync(zip))});for(const role of['source','checklist','instructor'])expect(receipt.output_originals[role].expected_digest_matched).toBe(true);for(const text of['PRIVATE ',source,'28.6141','gap-prompt','later-first'])expect(JSON.stringify(receipt)).not.toContain(text);
 const contents=JSON.parse(execFileSync('python',['-c','import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.dumps({n:z.read(n).decode() for n in z.namelist()}))',zip],{encoding:'utf8'}));expect(Object.keys(contents)).toEqual(['originals/source.csv','originals/checklist.json','originals/instructor.json','validation.json','HANDOFF.txt']);for(const[role,text]of[['source.csv',source],['checklist.json',texts.right.checklist],['instructor.json',texts.left.instructor]])expect(contents['originals/'+role]).toBe(text);const cli=await(await load('verify-discussion-archive')).verifyDiscussionArchive(zip);expect(cli).toMatchObject({archive_files:5,instructor_included:true,saved_checklist_prompts:2,saved_instructor_markers:2});
 await instructor.selectOption('omit');await expect(preview).toHaveCount(0);await expect(download).toBeDisabled();await ack.check();await inspect.click();await expect(preview).toContainText('Instructor explicitly omitted');await zipAck.check();await prepare.click();await expect(tool.getByLabel('Prepared selected discussion ZIP')).toContainText('4 fixed entries');const omitted=testInfo.outputPath('selected-four.zip');await save(download,omitted);expect(await(await load('verify-discussion-archive')).verifyDiscussionArchive(omitted)).toMatchObject({archive_files:4,instructor_included:false});await comparison.getByLabel('Right discussion comparison checklist expected SHA-256',{exact:true}).fill('f'.repeat(64));await expect(tool).toHaveCount(0);await comparison.getByLabel('Right discussion comparison checklist expected SHA-256',{exact:true}).fill(hash(texts.right.checklist));await check.click();await expect(choice).toHaveValue('');await expect(instructor).toHaveValue('');await expect(ack).not.toBeChecked();await expect(download).toBeDisabled();
 const unchanged=testInfo.outputPath('selected-active-unchanged.json');await save(portable.getByRole('button',{name:'Download review case JSON',exact:true}),unchanged);expect(JSON.parse(fs.readFileSync(unchanged,'utf8'))).toEqual(baseline);await expect(p.getByLabel('Replay position',{exact:true})).toHaveValue('8');await expect(pair.getByLabel('Comparison time',{exact:true})).toHaveValue('6');expect(await p.evaluate(()=>window.effects)).toEqual([]);
 await p.getByLabel('Go to local handoff task').selectOption('receivedDiscussion');const receiver=p.getByRole('region',{name:'Received discussion originals ZIP',exact:true});await receiver.getByLabel('Received discussion ZIP file',{exact:true}).setInputFiles(zip);await receiver.getByRole('button',{name:'Check discussion ZIP originals',exact:true}).click();await expect(receiver.getByRole('region',{name:'Checked received discussion inventory',exact:true})).toContainText('Instructor original present, 2 saved annotations');const output={};for(const role of['source','checklist','instructor']){await receiver.getByLabel('Received discussion original role',{exact:true}).selectOption(role);await receiver.getByLabel('Acknowledge sensitive received discussion original').check();output[role]=testInfo.outputPath('selected-recovered-'+(role==='source'?'source.csv':role+'.json'));await save(receiver.getByRole('button',{name:'Recheck and download selected discussion original',exact:true}),output[role]);expect(fs.readFileSync(output[role],'utf8')).toBe(role==='source'?source:role==='checklist'?texts.right.checklist:texts.left.instructor);}
 await c.setOffline(false);await p.reload();await c.setOffline(true);await p.getByLabel('Choose flight CSV',{exact:true}).setInputFiles(output.source);await p.getByLabel('Visible review panel group').selectOption('debrief');const discussion=p.getByRole('article',{name:'Reusable discussion checklist',exact:true}),timeline=p.getByRole('article',{name:'Instructor debrief timeline',exact:true});await discussion.getByLabel('Import discussion checklist JSON').setInputFiles(output.checklist);await expect(discussion.getByLabel('Discussion checklist counts')).toContainText('0/30 saved prompts');await discussion.getByRole('button',{name:'Replace discussion checklist',exact:true}).click();await expect(discussion.getByRole('list',{name:'Saved discussion prompts',exact:true})).toContainText(rightChecklist.items[0].prompt);await timeline.getByLabel('Import debrief JSON').setInputFiles(output.instructor);await expect(timeline.getByLabel('Discussion summary')).toHaveValue('');await timeline.getByRole('button',{name:'Replace with imported review',exact:true}).click();await expect(timeline.getByLabel('Discussion summary')).toHaveValue(original.debrief.notes);await expect(discussion.getByLabel('Discussion checklist counts')).toContainText('2/30 saved prompts');expect(await p.evaluate(()=>window.effects)).toEqual([]);expect(errors).toEqual([]);expect(requests).toEqual([]);
});
