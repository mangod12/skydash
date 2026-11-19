import { describe, expect, it } from 'vitest';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { actionRegister } from './debriefActions';
import { checklistReview, checklistTemplate } from './debriefChecklist';
import { FOLLOWUP_VERSION, followupPacket, readFollowupPacket, followupReport } from './debriefFollowup';
const log = { model_version: LOG_VERSION, sha256: 'a'.repeat(64), filename: 'source.csv', samples: parseFlightCSV(SAMPLE_LOG) };
const action = { id: 'a1', row: 4, text: 'Private follow-up', owner: 'Owner label', target: 'Not scheduled', status: 'Closed', closure: 'Reviewer assertion' };
const prompt = { id: 'p1', prompt: 'Private discussion', status: 'Not applicable', note: 'Unverified reason', row: 4 };
const actions = () => actionRegister(log, [action]), checklist = () => checklistReview(log, 'Title', [prompt]);
const packet = () => followupPacket(log, actions(), checklist());
const read = data => readFollowupPacket(JSON.stringify(data), log);
describe('two-section source-bound follow-up packet', () => {
  it('roundtrips only saved action/checklist fields and source models without CSV/coordinates/other reviews', () => {
    const data = packet(); expect(data.format).toBe(FOLLOWUP_VERSION); expect(read(data)).toEqual(data); expect(Object.keys(data).sort()).toEqual(['actions', 'checklist', 'format', 'replay_model', 'source_sha256']);
    for (const text of ['csv_text', 'latitude', 'longitude', 'markers', 'envelope', 'comparison']) expect(JSON.stringify(data)).not.toContain(text);
  });
  it.each([{ format: 'future' }, { replay_model: 'future' }, { source_sha256: 'b'.repeat(64) }, { extra: true }, { actions: null }, { checklist: null }])('rejects wrong source/models/outer fields %j', patch => expect(() => read({ ...packet(), ...patch })).toThrow());
  it('checks both nested source fingerprints and models independently rather than trusting outer hash', () => {
    for (const key of ['actions', 'checklist']) for (const patch of [{ source_sha256: 'b'.repeat(64) }, { replay_model: 'future' }, { evidence: {} }, { format: 'future' }]) { const data = packet(); data[key] = { ...data[key], ...patch }; expect(() => read(data)).toThrow(); }
  });
  it('rejects reusable checklist templates, bad rows, closure and Not applicable reason before any section can be applied', () => {
    expect(() => followupPacket(log, actions(), checklistTemplate(log, 'Title', [prompt]))).toThrow('never a reusable template');
    const invalid = [{ actions: { ...actions(), items: [{ ...action, closure: '' }] } }, { actions: { ...actions(), items: [{ ...action, row: 7 }] } }, { checklist: { ...checklist(), items: [{ ...prompt, note: '' }] } }, { checklist: { ...checklist(), items: [{ ...prompt, row: 0 }] } }]; for (const patch of invalid) expect(() => read({ ...packet(), ...patch })).toThrow();
  });
  it('rejects malformed/array/null and oversized UTF8 while supporting explicit empty lists in both sections', () => {
    for (const value of ['{', '[]', 'null']) expect(() => readFollowupPacket(value, log)).toThrow(); expect(() => readFollowupPacket('汉'.repeat(180000), log)).toThrow('512KiB'); const data = followupPacket(log, actionRegister(log, []), checklistReview(log, 'Empty', [])); expect(read(data).actions.items).toEqual([]); expect(read(data).checklist.items).toEqual([]);
  });
  it('reports all private annotations with recomputed original row/gap/unknown evidence and explicit exclusions', () => {
    const text = followupReport(log, actions(), checklist()); for (const expected of ['Private follow-up', 'Owner label', 'Reviewer assertion', 'Private discussion', 'Unverified reason', 'Original data row 4 at 12s', 'Original row 4 at 12s', '8s / gap over 5s', 'Source altitude unknown', log.sha256, 'never claims to be a full workspace backup', 'EXCLUDED:']) expect(text).toContain(expected); expect(text).not.toContain('28.614'); expect(text).not.toContain('77.209');
  });
  it('returns independent copies, preserves order, never mutates sources or section data', () => {
    const a = actions(), c = checklist(), before = JSON.stringify({ log, a, c }); const data = followupPacket(log, a, c); expect(data.actions.items[0]).not.toBe(a.items[0]); expect(data.checklist.items[0]).not.toBe(c.items[0]); data.actions.items[0].text = 'Changed'; expect(JSON.stringify({ log, a, c })).toBe(before);
  });
});
