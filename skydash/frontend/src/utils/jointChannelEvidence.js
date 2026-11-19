import { LOG_VERSION } from './flightLog';
import { QUALITY_CHANNELS } from './sourceEvidence';
export const JOINT_VERSION = 'skydash-joint-channel-evidence-v1';
export const JOINT_CHANNELS = QUALITY_CHANNELS;
export const JOINT_SCOPE = 'CO-OCCURRING RECORDED CELLS, NOT CONTINUOUS SENSOR COVERAGE. Present means a numeric cell exists for every selected optional channel on that original CSV row, not verified accuracy or suitability. Missing cells do not diagnose an outage. Runs split at every timestamp interval over 5s and every selected-channel presence pattern change. All intervals remain unsampled; no coverage percentage, outage duration, lost-sample count, grades or flight-readiness claim.';
export const JOINT_FILTERS = ['all', 'present', 'missing'];
export function jointChannelEvidence(log, selected) {
  if (log?.model_version !== LOG_VERSION || !Array.isArray(log.samples) || log.samples.length < 2) throw new Error('Load a supported recorded CSV source.');
  if (!Array.isArray(selected) || selected.length < 1 || selected.length > 3 || new Set(selected).size !== selected.length || selected.some(key => !JOINT_CHANNELS.some(channel => channel.key === key))) throw new Error('Select one to three distinct supported optional channels.');
  const channels = JOINT_CHANNELS.filter(channel => selected.includes(channel.key));
  const runs = []; let previous = null, present = 0;
  log.samples.forEach((sample, index) => {
    const missing = channels.filter(channel => sample[channel.key] === null).map(channel => channel.key);
    if (!missing.length) present++;
    const pattern = missing.join(','), spacing = index ? sample.time_s - log.samples[index - 1].time_s : null;
    if (previous && previous.pattern === pattern && spacing <= 5) { previous.last = index + 1; previous.end = sample.time_s; previous.count++; }
    else { previous = { first: index + 1, last: index + 1, start: sample.time_s, end: sample.time_s, count: 1, missing, pattern, precedingSpacing: spacing, startsAfterGap: spacing !== null && spacing > 5 }; runs.push(previous); }
  });
  return { channels, count: log.samples.length, present, missing: log.samples.length - present, runs };
}
export function jointRuns(data, filter) {
  if (!JOINT_FILTERS.includes(filter)) throw new Error('Unsupported joint evidence filter.');
  return data.runs.filter(run => filter === 'all' || (filter === 'present' ? !run.missing.length : Boolean(run.missing.length)));
}
export function jointEvidenceReport(log, selected, filter = 'all') {
  const data = jointChannelEvidence(log, selected), runs = jointRuns(data, filter), labels = keys => data.channels.filter(channel => keys.includes(channel.key)).map(channel => channel.label).join(', ');
  return ['SKYDASH / JOINT CHANNEL EVIDENCE', JOINT_VERSION, JOINT_SCOPE, `Replay model: ${LOG_VERSION}`, `Source: ${log.filename}; exact SHA-256 ${log.sha256}`, `Selected channels: ${data.channels.map(channel => channel.label).join(', ')}`, `Original rows: ${data.count}; all selected cells present: ${data.present}; at least one selected cell missing: ${data.missing}. Counts are rows, never continuous time or completeness.`, `Filter: ${filter}; ${runs.length}/${data.runs.length} matching runs, all matching runs exported in original order, not only this page.`, '', ...runs.flatMap((run, index) => [`${index + 1}. Original rows ${run.first} to ${run.last}; ${run.start}s to ${run.end}s; ${run.count} rows; first-to-last timestamp span ${run.end - run.start}s, not observed duration.`, `Missing selected cells: ${run.missing.length ? labels(run.missing) : 'none; all selected numeric cells present, not verified accuracy'}.`, `Previous original timestamp spacing: ${run.precedingSpacing === null ? 'none, first row' : `${run.precedingSpacing}s${run.startsAfterGap ? ' / gap over 5s, run split' : ''}`}. This spacing may start outside the current filter.`, '']), ...(runs.length ? [] : ['No matching runs. Not proof of completeness or source authenticity.']), 'Unselected channels do not affect grouping. Changes in numeric values alone do not start a new run. Exactly 5s stays within a run when presence pattern matches; over 5s always splits even if pattern is unchanged. Single-row spans are zero, never outage durations. Source altitude datum unverified; ground speed not airspeed; battery percentage not energy. No coordinates, channel values or private reviewer notes included, but source identity/timestamps can be sensitive. Keep exact CSV and selected channel/filter/model to reproduce. Editable, not authenticated or tamper-evident. Session-only derived review, excluded from cases/comparison/notebooks/library; download separately. No source edits, interpolation, uploads, backend writes, automatic persistence/sharing or aircraft commands.'].join('\n');
}
