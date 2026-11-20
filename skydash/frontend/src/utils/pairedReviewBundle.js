import { comparisonReport } from './flightComparison';
import { parseFlightCSV } from './flightLog';
import { createReviewCase, readReviewCase, reviewCaseReport } from './reviewCase';
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

export async function pairedReviewBundleReport(text) {
  const opened = await readPairedReviewBundle(text);
  return ['SKYDASH / PAIRED REVIEW HANDOFF REPORT', PAIRED_BUNDLE_VERSION, 'READABLE PAIRED REVIEW HANDOFF. Contains ordered source identities, recomputed evidence, private primary analyst/instructor/evaluated-envelope review, comparison notes and applied manual anchors. Does not embed the exact source CSV bytes. May contain source coordinates within marker context. Excludes notebook copies, independent-window reviews, circle/actions/checklists/follow-up, mapping originals/recipes, replay cursors and unfinished drafts. Not a complete workspace backup.',
    'READABLE SNAPSHOT ONLY. This report cannot reopen sources or reviews. Keep the paired JSON separately. All source statistics below are recomputed from validated exact CSV bytes. Reviewer notes, titles, marker discussion and manual associations are unverified text, not sensor observations or authenticated authorship.',
    'SECTION SCOPES: inclusion/exclusion statements inside existing report sections apply to those sections only. The combined artifact contains private notes and may contain instructor-marker coordinates. Primary-case comparison exclusions apply only to that primary-case section. The comparison section below includes baseline B, comparison notes and applied anchors. All other exclusions in the paired scope still apply. No cursor-specific instantaneous deltas are included.',
    '', '=== PRIMARY A / ANALYST, INSTRUCTOR AND EVALUATED ENVELOPE REVIEW ===', reviewCaseReport(opened.primary),
    '', '=== ORDERED A / B COMPARISON / WHOLE-LOG SUMMARY AND MANUAL ANCHORS ===', comparisonReport(opened.primary.log, opened.comparison.baseline, opened.comparison.notes, opened.comparison.alignment),
    '', 'END OF PAIRED READABLE SNAPSHOT. No certification, flight clearance, independently verified aircraft identity or same-event synchronization. Editable, not signed or tamper-evident. Original OEM CSV/recipe lineage and excluded review panels remain separate. No automatic upload, storage or sharing.'].join('\n');
}
