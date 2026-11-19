import { describe, expect, it } from 'vitest';
import { LOG_VERSION } from './flightLog';
import { BLOCK_VERSION, recordedBlocks, filterRecordedBlocks, recordedBlockReport } from './recordedBlocks';
const source = times => ({ model_version: LOG_VERSION, sha256: 'a'.repeat(64), filename: 'PRIVATE_FILENAME', notes: 'PRIVATE_NOTE', samples: times.map((time_s, index) => ({ time_s, latitude: 28.123, longitude: 77.123, altitude_m: index === 1 ? null : 0, ground_speed_m_s: 0, battery_pct: null })) });
const log = source([0, 2, 4, 12, 14, 30]);
describe('recorded original-row blocks', () => {
  it('partitions every original row once, gap endpoints belong to separate blocks with both boundary spacings', () => {
    const data = recordedBlocks(log); expect(data.map(block => [block.number, block.first, block.last, block.start, block.end, block.span, block.count, block.intervals, block.before, block.after])).toEqual([[1, 1, 3, 0, 4, 4, 3, 2, null, 8], [2, 4, 5, 12, 14, 2, 2, 1, 8, 16], [3, 6, 6, 30, 30, 0, 1, 0, 16, null]]); expect(data.flatMap(block => Array.from({ length: block.count }, (_, i) => block.first + i))).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('exact5s stays together, fractional strictover5 splits, no expected-rate assumptions', () => {
    const data = recordedBlocks(source([0, 5, 10, 15.001])); expect(data.map(block => block.count)).toEqual([3, 1]); expect(data[0].after).toBeCloseTo(5.001); expect(data[1].span).toBe(0); expect(data[0]).not.toHaveProperty('coverage');
  });
  it('counts missing cells independently, zero is known and missing does not split blocks', () => {
    const data = recordedBlocks(log); expect(data[0].channels.map(channel => [channel.known, channel.missing])).toEqual([[2, 1], [3, 0], [0, 3]]); expect(data[1].channels[0].known).toBe(2); expect(data[0].hasMissing).toBe(true); expect(data[0].count).toBe(3);
  });
  it('filters without renumbering, reordering or recomputing prior spacing and rejects unknown filter', () => {
    const data = recordedBlocks(log); expect(filterRecordedBlocks(data, 'singleton').map(block => block.number)).toEqual([3]); expect(filterRecordedBlocks(data, 'singleton')[0].before).toBe(16); expect(filterRecordedBlocks(data, 'missing')).toHaveLength(3); expect(() => filterRecordedBlocks(data, 'unsafe')).toThrow();
  });
  it('one block with no gaps has source start/end rather than inventing boundary intervals', () => {
    const data = recordedBlocks(source([0, .1])); expect(data).toHaveLength(1); expect(data[0]).toMatchObject({ before: null, after: null, intervals: 1, span: .1, first: 1, last: 2 }); expect(filterRecordedBlocks(data, 'singleton')).toEqual([]);
  });
  it('zero optional-missing is not claimed complete, no matching filter explicit', () => {
    const log = source([0, 2]); log.samples.forEach(sample => { sample.altitude_m = 0; sample.battery_pct = 0; }); expect(filterRecordedBlocks(recordedBlocks(log), 'missing')).toEqual([]); expect(recordedBlockReport(log, 'missing')).toContain('No matching blocks, not proof of completeness');
  });
  it('two gaps make singleton endpoints and allgap source keeps every row', () => { const data = recordedBlocks(source([0, 6, 12, 18])); expect(data).toHaveLength(4); expect(data.every(block => block.count === 1 && block.span === 0 && block.intervals === 0)).toBe(true); expect(data.map(block => block.first)).toEqual([1, 2, 3, 4]); });
  it('supports10000rows without source mutation, all block exports beyond page and immutable outputs', () => {
    const many = source(Array.from({ length: 10000 }, (_, i) => i * 2 + Math.floor(i / 2) * 4)), before = JSON.stringify(many); const data = recordedBlocks(many); expect(data).toHaveLength(5000); data[0].channels[0].known = 100000; expect(JSON.stringify(many)).toBe(before); expect(recordedBlockReport(many)).toContain('Block 5000: original rows 9999 through 10000');
  });
  it('report lists filtered original blocks, unknown overlap caveats/model/source identity but no coordinates/readings/notes', () => {
    const text = recordedBlockReport(log, 'singleton'); for (const value of [BLOCK_VERSION, LOG_VERSION, log.sha256, 'Filter singleton; 1/3 matching', 'Block 3: original rows 6 through 6', 'before: 16s / gap over 5s; after: none, source end', 'Battery: 0/1 known, 1 missing', 'Timestamp span is not observed duration', 'may overlap across rows']) expect(text).toContain(value); for (const value of ['PRIVATE_FILENAME', 'PRIVATE_NOTE', '28.123', '77.123', 'latitude', 'longitude', 'csv_text', 'Block 1:']) expect(text).not.toContain(value);
  });
  it.each([null, { ...log, model_version: 'future' }, { ...log, samples: [] }])('rejects unsupported source', value => expect(() => recordedBlocks(value)).toThrow());
});
