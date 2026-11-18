import { LOG_VERSION, MAX_LOG_BYTES, parseFlightCSV, flightCSVHash } from './flightLog';
import { ALIGNMENT_VERSION, COMPARISON_VERSION, comparisonAlignment } from './flightComparison';
export const COMPARISON_REVIEW_VERSION = 'skydash-comparison-review-v1';
export const MAX_COMPARISON_REVIEW_BYTES = 2 * 1024 * 1024;
export const COMPARISON_REVIEW_SCOPE = 'PORTABLE COMPARISON REVIEW. Contains exact baseline coordinates, private comparison notes and manual anchor labels. Primary CSV is not embedded: download and keep it separately. No automatic upload or sharing. Editable, not signed or authenticated; source fingerprints prove bytes only. Imported labels and notes are unverified reviewer text, not sensor facts or same-event evidence.';
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const text = (value, max, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
async function checked(data, primary) {
  if (!exact(data, ['format', 'replay_model', 'comparison_model', 'alignment_model', 'primary_sha256', 'baseline', 'alignment', 'notes']) || data.format !== COMPARISON_REVIEW_VERSION || data.replay_model !== LOG_VERSION || data.comparison_model !== COMPARISON_VERSION || data.alignment_model !== ALIGNMENT_VERSION || primary?.model_version !== LOG_VERSION) throw new Error('Unsupported comparison review fields or model versions.');
  if (!/^[a-f0-9]{64}$/.test(data.primary_sha256) || data.primary_sha256 !== primary.sha256) throw new Error('Primary fingerprint mismatch. Load the exact matching primary CSV first.');
  // Reparse and hash the actual primary bytes rather than trusting supplied metadata.
  parseFlightCSV(primary.csv_text);
  if (await flightCSVHash(primary.csv_text) !== data.primary_sha256) throw new Error('Current primary CSV does not match its fingerprint. Nothing was replaced.');
  if (!exact(data.baseline, ['filename', 'title', 'csv_text', 'sha256']) || !text(data.baseline.filename, 120, true) || !text(data.baseline.title, 120, true) || !/^[a-f0-9]{64}$/.test(data.baseline.sha256)) throw new Error('Invalid comparison baseline metadata.');
  if (typeof data.baseline.csv_text !== 'string' || new Blob([data.baseline.csv_text]).size > MAX_LOG_BYTES) throw new Error('Comparison baseline CSV must be at most 1MiB.');
  const samples = parseFlightCSV(data.baseline.csv_text);
  if (await flightCSVHash(data.baseline.csv_text) !== data.baseline.sha256) throw new Error('Comparison baseline fingerprint mismatch. Nothing was replaced.');
  if (!text(data.notes, 4000)) throw new Error('Comparison notes must be text up to 4,000 characters.');
  const baseline = { ...data.baseline, samples, model_version: LOG_VERSION };
  if (data.alignment !== null) {
    if (!exact(data.alignment, ['primaryIndex', 'baselineIndex', 'label'])) throw new Error('Invalid comparison anchor fields.');
    comparisonAlignment({ ...primary, samples: parseFlightCSV(primary.csv_text) }, baseline, data.alignment);
  }
  return { baseline, alignment: data.alignment, notes: data.notes, data };
}
export async function createComparisonReview(primary, baseline, notes = '', alignment = null) {
  if (!primary || !baseline) throw new Error('Load both sources before exporting a comparison review.');
  if (baseline.model_version !== LOG_VERSION) throw new Error('Unsupported comparison baseline replay model.');
  const data = { format: COMPARISON_REVIEW_VERSION, replay_model: LOG_VERSION, comparison_model: COMPARISON_VERSION, alignment_model: ALIGNMENT_VERSION,
    primary_sha256: primary.sha256, baseline: { filename: baseline.filename, title: baseline.title, csv_text: baseline.csv_text, sha256: baseline.sha256 }, alignment, notes };
  await checked(data, primary);
  const contents = JSON.stringify(data, null, 2);
  if (new Blob([contents]).size > MAX_COMPARISON_REVIEW_BYTES) throw new Error('Comparison review exceeds 2MiB. Keep separate CSV and text report exports.');
  return contents;
}
export async function readComparisonReview(contents, primary) {
  if (typeof contents !== 'string' || new Blob([contents]).size > MAX_COMPARISON_REVIEW_BYTES) throw new Error('Comparison review JSON must be at most 2MiB.');
  let data; try { data = JSON.parse(contents); } catch { throw new Error('Comparison review is not valid JSON.'); }
  return checked(data, primary);
}
