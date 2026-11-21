// Fixed fabricated originals only. No caller data, file reads, storage or replay state.
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV, flightCSVHash } from './flightLog';
import { createReviewCase } from './reviewCase';
import { createNotebookSourceBundle } from './notebookSourceBundle';
import { createPairedReviewBundle } from './pairedReviewBundle';
import { convertMappedCSV, readMappingCSV } from './csvColumnMapping';
import { exportMappingRecipe } from './mappingRecipe';
const sha = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
export async function syntheticTrainingOriginals() {
  const base = { filename: 'SYNTHETIC-sample.csv', title: 'SYNTHETIC example, not a real flight', notes: '', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) };
  const original = 'clock,lat,lon\n1000,28.6,77.2\n3000,28.61,77.21\n', mapping = { columns: { time_s: 0, latitude: 1, longitude: 2, altitude_m: null, ground_speed_m_s: null, battery_pct: null }, timeUnit: 'ms', timeOrigin: 'subtract-first', altitudeUnit: 'm', speedUnit: 'm/s', coordinateReference: 'WGS84-decimal-degrees' };
  const recipe = exportMappingRecipe(readMappingCSV(original).headers, mapping, 'SYNTHETIC fixture, not OEM data'), converted = await convertMappedCSV(original, 'SYNTHETIC-original.csv', mapping);
  const baseline = { ...converted, filename: 'SYNTHETIC-converted.csv', title: 'SYNTHETIC mapped baseline', notes: '', model_version: LOG_VERSION, samples: parseFlightCSV(converted.csv_text) };
  const review = { title: base.title, notes: 'SYNTHETIC analyst discussion only. Not a training completion or readiness assessment.' }, debrief = { markers: [{ id: 'synthetic-question', time_s: 8, kind: 'Question', text: 'SYNTHETIC discussion prompt, not an observed real event.', discussed: false }], notes: 'SYNTHETIC instructor example. All data and reviews are fabricated.' };
  const files = { 'sample.csv': SAMPLE_LOG, 'case.json': await createReviewCase(base, review, debrief, null), 'notebook.json': await createNotebookSourceBundle(base, [{ id: 'synthetic-copy', first_row: 2, last_row: 4, label: 'SYNTHETIC saved copy', notes: 'Overlapping or repeated saved copies would still not be independent flights.' }]), 'paired.json': await createPairedReviewBundle({ log: base, review, debrief, envelope: null }, { baseline, notes: 'SYNTHETIC A/B examples. Roles are not flight identities or alignment proof.', alignment: null }) };
  const training = JSON.stringify({ format: 'skydash-training-intake-manifest-v2', bundles: await Promise.all(['case', 'notebook', 'paired'].map(async kind => ({ kind, path: kind + '.json', sha256: await sha(files[kind + '.json']) }))) }, null, 2);
  const lineageFiles = { 'original.csv': original, 'recipe.json': recipe, 'converted.csv': converted.csv_text }, lineage = JSON.stringify({ format: 'skydash-training-lineage-manifest-v1', conversions: [{ original: { path: 'original.csv', sha256: await sha(original) }, recipe: { path: 'recipe.json', sha256: await sha(recipe) }, converted: { path: 'converted.csv', sha256: await sha(converted.csv_text) } }] }, null, 2);
  return { files, training, lineageFiles, lineage };
}
