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
