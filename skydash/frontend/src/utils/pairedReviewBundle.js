import { parseFlightCSV } from './flightLog';
import { createReviewCase, readReviewCase } from './reviewCase';
import { createComparisonReview, readComparisonReview } from './comparisonReview';
export const PAIRED_BUNDLE_VERSION = 'skydash-paired-review-bundle-v1';
export const MAX_PAIRED_BUNDLE_BYTES = 4 * 1024 * 1024;
export const PAIRED_BUNDLE_SCOPE = 'PAIRED LOCAL REVIEW HANDOFF. Embeds the entire exact primary and baseline CSVs, including all coordinates outside reviewed windows, primary analyst/instructor/evaluated envelope review, comparison notes and applied manual anchors. Private, editable reviewer text, not authenticated training evidence. No automatic upload, storage or sharing. Excludes notebook copies, independent-window reviews, circle/actions/checklists/follow-up, mapping originals/recipes, replay cursors and unfinished drafts. Keep those separately. No single artifact is a complete workspace backup.';
const exact = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === 'comparison,format,primary_case';
async function checked(data) {
  if (!exact(data) || data.format !== PAIRED_BUNDLE_VERSION) throw new Error('Unsupported paired review bundle fields or format.');
  const primary = await readReviewCase(JSON.stringify(data.primary_case));
  const comparison = await readComparisonReview(JSON.stringify(data.comparison), primary.log);
  return { data: { format: PAIRED_BUNDLE_VERSION, primary_case: primary.data, comparison: comparison.data }, primary, comparison };
}
export async function createPairedReviewBundle(snapshot, pair) {
  if (!snapshot || !pair?.baseline) throw new Error('Load both sources and finish source-bound review edits before exporting a paired bundle.');
  const log = { ...snapshot.log, samples: parseFlightCSV(snapshot.log.csv_text) };
  const primary_case = JSON.parse(await createReviewCase(log, snapshot.review, snapshot.debrief, snapshot.envelope));
  const comparison = JSON.parse(await createComparisonReview(snapshot.log, pair.baseline, pair.notes, pair.alignment));
  const result = await checked({ format: PAIRED_BUNDLE_VERSION, primary_case, comparison });
  const text = JSON.stringify(result.data, null, 2);
  if (new Blob([text]).size > MAX_PAIRED_BUNDLE_BYTES) throw new Error('Paired review bundle exceeds 4MiB. Download separate primary case and comparison review JSON.');
  return text;
}
export async function readPairedReviewBundle(text) {
  if (typeof text !== 'string' || new Blob([text]).size > MAX_PAIRED_BUNDLE_BYTES) throw new Error('Paired review bundle JSON must be at most 4MiB.');
  let data; try { data = JSON.parse(text); } catch { throw new Error('Paired review bundle is not valid JSON.'); }
  return checked(data);
}
