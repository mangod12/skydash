import { LOG_VERSION } from './flightLog';
export const BLOCK_VERSION = 'skydash-recorded-row-blocks-v1';
export const BLOCK_CHANNELS = [{ key: 'altitude_m', label: 'Source altitude' }, { key: 'ground_speed_m_s', label: 'Ground speed' }, { key: 'battery_pct', label: 'Battery' }];
export const BLOCK_FILTERS = [{ key: 'all', label: 'All row blocks' }, { key: 'missing', label: 'Blocks with any optional cell missing' }, { key: 'singleton', label: 'Single-row blocks' }];
export const BLOCK_SCOPE = 'RECORDED ROW BLOCKS, NOT CONTINUOUS FLIGHT SEGMENTS. Split original rows only where timestamp spacing is strictly over 5s, matching the replay track-break rule. All intervals, including 5s or less, remain unsampled. A block is not verified uninterrupted logging, a sortie, phase, maneuver, complete coverage or aircraft readiness. Missing optional cells do not split a block. Timestamp span is not observed duration or outage length.';
export function recordedBlocks(log) {
  if (log?.model_version !== LOG_VERSION || !Array.isArray(log.samples) || log.samples.length < 2) throw new Error('Load a supported recorded CSV source.');
  const blocks = []; let current;
  log.samples.forEach((sample, index) => {
    const spacing = index ? sample.time_s - log.samples[index - 1].time_s : null;
    if (!current || spacing > 5) { current = { number: blocks.length + 1, first: index + 1, last: index + 1, start: sample.time_s, end: sample.time_s, count: 0, before: spacing, after: null, channels: BLOCK_CHANNELS.map(channel => ({ ...channel, known: 0, missing: 0 })) }; if (blocks.length) blocks.at(-1).after = spacing; blocks.push(current); }
    current.last = index + 1; current.end = sample.time_s; current.count++;
    current.channels.forEach(channel => { if (sample[channel.key] === null) channel.missing++; else channel.known++; });
  });
  return blocks.map(block => ({ ...block, span: block.end - block.start, intervals: block.count - 1, hasMissing: block.channels.some(channel => channel.missing > 0) }));
}
export function filterRecordedBlocks(blocks, filter = 'all') {
  if (!BLOCK_FILTERS.some(item => item.key === filter)) throw new Error('Unsupported row block filter.');
  return blocks.filter(block => filter === 'all' || (filter === 'missing' ? block.hasMissing : block.count === 1));
}
export function recordedBlockReport(log, filter = 'all') {
  const all = recordedBlocks(log), blocks = filterRecordedBlocks(all, filter);
  return ['SKYDASH / RECORDED ROW BLOCK LEDGER', BLOCK_VERSION, BLOCK_SCOPE, `Replay model ${LOG_VERSION}; exact source SHA-256 ${log.sha256}`, `${all.length} original row blocks; ${all.length - 1} separating intervals over 5s; ${log.samples.length} original rows. Block numbering/order always from full source.`, `Filter ${filter}; ${blocks.length}/${all.length} matching blocks. Every matching block below, not only this page.`, '', ...blocks.flatMap(block => [`Block ${block.number}: original rows ${block.first} through ${block.last}; ${block.count} rows; original ${block.start}s to ${block.end}s; timestamp span ${block.span}s; ${block.intervals} internal adjacent intervals, each at most 5s but unsampled.`, `Separating spacing before: ${block.before === null ? 'none, source start' : `${block.before}s / gap over 5s`}; after: ${block.after === null ? 'none, source end' : `${block.after}s / gap over 5s`}. Separating interval endpoints belong to their respective blocks, not to gap observations.`, ...block.channels.map(channel => `${channel.label}: ${channel.known}/${block.count} known, ${channel.missing} missing cells.`), '']), ...(!blocks.length ? ['No matching blocks, not proof of completeness or fault-free flight.'] : []), 'Single-row block has zero timestamp span and no internal intervals, not a duration observation. Known zero counts as known; missing never zero-filled. Optional missing channel counts may overlap across rows and must not be added as distinct missing rows. No splitting, cropping, sorting, interpolation, merging or repair of source CSV. Source fingerprints/times/channel presence counts can be sensitive; no coordinate fields, filenames, channel values, private notes or raw CSV. Keep exact CSV/listed models/filter separately. Editable text, not reopenable/authenticated or tamper-evident. Derived session-only view excluded from cases/packets/library. No automatic storage, sharing, uploads, backend writes or aircraft commands.'].join('\n');
}
