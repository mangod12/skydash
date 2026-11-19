import { LOG_VERSION } from './flightLog';
import { WINDOW_VERSION } from './reviewWindow';
import { WINDOW_COMPARISON_VERSION, compareSampleWindows } from './sampleWindowComparison';
export const WINDOW_COMPARISON_REVIEW_VERSION = 'skydash-window-comparison-review-v1';
export const MAX_WINDOW_COMPARISON_REVIEW_BYTES = 65536;
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
export function windowComparisonReview(primary, baseline, selection) {
  for (const source of [primary,baseline]) if (source?.model_version !== LOG_VERSION || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('Load both supported exact CSV sources before using a window comparison review.');
  const reviewed = compareSampleWindows(primary, baseline, selection);
  const value = { format:WINDOW_COMPARISON_REVIEW_VERSION, replay_model:LOG_VERSION, window_model:WINDOW_VERSION, comparison_model:WINDOW_COMPARISON_VERSION, primary_sha256:primary.sha256, baseline_sha256:baseline.sha256, selection:{...reviewed.input} };
  if (new Blob([JSON.stringify(value,null,2)]).size > MAX_WINDOW_COMPARISON_REVIEW_BYTES) throw new Error('Window comparison review must be at most 64KiB.');
  return value;
}
export function readWindowComparisonReview(text, primary, baseline) {
  if (typeof text !== 'string' || new Blob([text]).size > MAX_WINDOW_COMPARISON_REVIEW_BYTES) throw new Error('Window comparison review must be at most 64KiB.');
  let value;try { value=JSON.parse(text); } catch { throw new Error('Window comparison review is not valid JSON.'); }
  if (!exact(value,['format','replay_model','window_model','comparison_model','primary_sha256','baseline_sha256','selection']) || value.format!==WINDOW_COMPARISON_REVIEW_VERSION || value.replay_model!==LOG_VERSION || value.window_model!==WINDOW_VERSION || value.comparison_model!==WINDOW_COMPARISON_VERSION) throw new Error('Unsupported window comparison review fields or models.');
  if (value.primary_sha256!==primary?.sha256 || value.baseline_sha256!==baseline?.sha256) throw new Error('Ordered source fingerprints mismatch. Load the exact primary A and baseline B CSVs in their original roles. No automatic swap or remapping.');
  return windowComparisonReview(primary,baseline,value.selection);
}
