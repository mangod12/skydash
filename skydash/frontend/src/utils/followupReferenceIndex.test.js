import { describe, expect, it } from 'vitest';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { actionRegister } from './debriefActions';
import { checklistReview } from './debriefChecklist';
import { followupPacket } from './debriefFollowup';
import { followupReferenceIndex, followupIndexRows, followupReferenceReport } from './followupReferenceIndex';
const log = { model_version: LOG_VERSION, sha256: 'a'.repeat(64), filename: 'source.csv', samples: parseFlightCSV(SAMPLE_LOG) };
const action = { id: 'a1', row: 4, text: 'Private action', owner: 'Owner label', target: 'No deadline', status: 'Closed', closure: 'Unverified outcome' };
const prompt = { id: 'p1', prompt: 'Private discussion', status: 'Not applicable', note: 'Reviewer reason', row: null };
const packet = (a = [action], c = [prompt]) => followupPacket(log, actionRegister(log, a), checklistReview(log, 'Private title', c));
describe('saved follow-up source reference index', () => {
  it('groups same original row across both sections, source sorts rows and keeps reviewer positions', () => {
    const data = packet([action, { ...action, id: 'a2', row: 1 }, { ...action, id: 'a3' }], [{ ...prompt, row: 4 }, { ...prompt, id: 'p2', row: 1 }]); const result = followupReferenceIndex(log, data);
    expect(result.rows.map(row => row.row)).toEqual([1, 4]); expect(result.rows[1].actions.map(ref => ref.position)).toEqual([1, 3]); expect(result.rows[1].checklist[0].position).toBe(1); expect(result.rows[0].checklist[0].position).toBe(2); expect(result.actionCount).toBe(3); expect(result.referencedPromptCount).toBe(2); expect(result.rows).toHaveLength(2);
  });
  it('never invents a source row for null references and separates equal IDs in different sections', () => {
    const result = followupReferenceIndex(log, packet([action], [{ ...prompt, id: 'a1' }, { ...prompt, id: 'p2', row: 4 }])); expect(result.unreferenced[0].item.id).toBe('a1'); expect(result.unreferenced[0].position).toBe(1); expect(result.unreferencedPromptCount).toBe(1); expect(result.referencedPromptCount).toBe(1); expect(result.rows[0].checklist[0].position).toBe(2);
  });
  it('recomputes exact source time, previous original gap and missing readings without interpolation', () => {
    const result = followupReferenceIndex(log, packet()); const row = result.rows[0]; expect(row.time).toBe(12); expect(row.spacing).toBe(8); expect(row.gapBefore).toBe(true); expect(row.altitude).toBeNull(); expect(row.battery).toBeNull(); expect(row.speed).toBe(5); expect(row).not.toHaveProperty('latitude'); expect(row).not.toHaveProperty('longitude');
    const first = followupReferenceIndex(log, packet([{ ...action, row: 1 }])).rows[0]; expect(first.spacing).toBeNull(); expect(first.gapBefore).toBe(false); expect(first.speed).toBe(0);
  });
  it('exact five-second spacing is not a gap and no references bridge unsampled intervals', () => {
    const source = { ...log, samples: [{ ...log.samples[0], time_s: 0 }, { ...log.samples[0], time_s: 5 }] }; const data = followupPacket(source, actionRegister(source, [{ ...action, row: 2 }]), checklistReview(source, 'Title', [])); const result = followupReferenceIndex(source, data); expect(result.rows).toHaveLength(1); expect(result.rows[0].gapBefore).toBe(false); expect(result.rows[0].spacing).toBe(5);
  });
  it('filter selects rows by reference kind but retains both annotation kinds on matching rows', () => {
    const result = followupReferenceIndex(log, packet([action, { ...action, id: 'a2', row: 1 }], [{ ...prompt, row: 4 }, { ...prompt, id: 'p2', row: 2 }])); expect(followupIndexRows(result, 'actions').map(row => row.row)).toEqual([1, 4]); expect(followupIndexRows(result, 'actions')[1].checklist).toHaveLength(1); expect(followupIndexRows(result, 'checklist').map(row => row.row)).toEqual([2, 4]); expect(() => followupIndexRows(result, 'invalid')).toThrow();
  });
  it('supports empty saved lists and all-unreferenced checklist without invented zero-row evidence', () => {
    const empty = followupReferenceIndex(log, packet([], [])); expect(empty.rows).toEqual([]); expect(empty.actionCount).toBe(0); expect(empty.referencedPromptCount).toBe(0);
    const only = followupReferenceIndex(log, packet([], [prompt])); expect(only.rows).toEqual([]); expect(only.unreferenced).toHaveLength(1); expect(only.referencedPromptCount).toBe(0);
  });
  it('validates outer/nested source, models, row bounds and duplicate IDs before indexing', () => {
    for (const mutate of [p => { p.source_sha256 = 'b'.repeat(64); }, p => { p.actions.source_sha256 = 'b'.repeat(64); }, p => { p.checklist.replay_model = 'future'; }, p => { p.actions.items[0].row = 7; }, p => { p.checklist.items[0].row = 0; }, p => { p.actions.items.push({ ...action }); }]) { const data = packet(); mutate(data); expect(() => followupReferenceIndex(log, data)).toThrow(); }
  });
  it('returns independent saved annotations and source values without mutation', () => {
    const data = packet(), before = JSON.stringify({ data, log }); const result = followupReferenceIndex(log, data); result.rows[0].actions[0].item.text = 'New'; result.rows[0].time = 0; result.unreferenced[0].item.prompt = 'Changed'; expect(JSON.stringify({ data, log })).toBe(before);
  });
  it('reports every matching row/private annotation and unreferenced prompt, no coordinates or csv', () => {
    const report = followupReferenceReport(log, packet([action], [prompt, { ...prompt, id: 'p2', row: 4 }]));
    for (const text of ['Private title', 'Private action', 'Private discussion', 'Owner label', 'No deadline', 'Unverified outcome', 'Reviewer reason', 'Original data row 4 at 12s', '8s / gap over 5s', 'Source altitude unknown', 'Checklist prompt position 1', 'Checklist prompt position 2', log.sha256, 'not review coverage']) expect(report).toContain(text);
    for (const text of ['28.614', '77.209', 'csv_text', 'latitude', 'longitude']) expect(report).not.toContain(text);
    const filtered = followupReferenceReport(log, packet([action], [{ ...prompt, prompt: 'Unreferenced-only secret' }]), 'actions'); expect(filtered).not.toContain('Unreferenced-only secret'); expect(filtered).toContain('Private action');
  });
  it('supports maximum lists and exports all original referenced rows beyond page12', () => {
    const source = { ...log, samples: Array.from({ length: 50 }, (_, i) => ({ ...log.samples[0], time_s: i })) }; const a = Array.from({ length: 50 }, (_, i) => ({ ...action, id: `a${i}`, row: 50 - i })), c = Array.from({ length: 30 }, (_, i) => ({ ...prompt, id: `p${i}`, row: i % 2 ? null : i + 1 })); const data = followupPacket(source, actionRegister(source, a), checklistReview(source, 'Title', c)); const result = followupReferenceIndex(source, data); expect(result.rows).toHaveLength(50); expect(result.unreferenced).toHaveLength(15); const text = followupReferenceReport(source, data); expect(text).toContain('All 50/50'); expect(text).toContain('Original data row 50 at 49s'); expect(text).toContain('ID p29');
  });
});
