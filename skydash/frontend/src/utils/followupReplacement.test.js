import { describe, it, expect } from 'vitest';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { actionRegister } from './debriefActions';
import { checklistReview } from './debriefChecklist';
import { followupPacket } from './debriefFollowup';
import { ACTION_DIFF_FIELDS, CHECKLIST_DIFF_FIELDS, followupReplacementDiff, followupDiffReport } from './followupReplacement';
const log = { model_version: LOG_VERSION, sha256: 'a'.repeat(64), filename: 'source.csv', samples: parseFlightCSV(SAMPLE_LOG) };
const action = { id: 'a1', row: 4, text: 'Discuss evidence', owner: 'Reviewer', target: 'Not scheduled', status: 'Open', closure: '' };
const prompt = { id: 'p1', prompt: 'Discuss missing cells', status: 'Pending', note: '', row: null };
const packet = (a = [action], c = [prompt], title = 'Discussion') => followupPacket(log, actionRegister(log, a), checklistReview(log, title, c));
describe('explicit follow-up replacement comparison', () => {
  it('equal packets have no field/position/title changes and return independent copies', () => {
    const current = packet(), before = JSON.stringify(current), result = followupReplacementDiff(log, current, current);
    expect(result.actionCounts).toEqual({ added: 0, removed: 0, changed: 0, unchanged: 1, positionChanged: 0 }); expect(result.checklistCounts).toEqual(result.actionCounts); expect(result.titleChanged).toBe(false); result.actions[0].before.text = 'New'; expect(JSON.stringify(current)).toBe(before);
  });
  it.each(ACTION_DIFF_FIELDS)('reports exact action field change: %s', field => {
    const values = { row: 1, text: 'Changed', owner: 'Other', target: '', status: 'Closed', closure: 'Reason' };
    const next = { ...action, [field]: values[field] }; if (field === 'status') next.closure = 'Closure reason';
    const result = followupReplacementDiff(log, packet(), packet([next])); expect(result.actions[0].kind).toBe('changed'); expect(result.actions[0].changedFields).toContain(field); expect(result.actions[0].positionChanged).toBe(false);
  });
  it.each(CHECKLIST_DIFF_FIELDS)('reports exact checklist field change: %s', field => {
    const values = { prompt: 'Changed', status: 'Discussed', note: 'Reason', row: 1 };
    const result = followupReplacementDiff(log, packet(), packet([action], [{ ...prompt, [field]: values[field] }])); expect(result.checklist[0].changedFields).toEqual([field]); expect(result.checklistCounts.changed).toBe(1);
  });
  it('IDs, not similar text, decide removal/addition and sections never share identity', () => {
    const next = packet([{ ...action, id: 'a2' }], [{ ...prompt, id: 'a1' }]); const result = followupReplacementDiff(log, packet(), next);
    expect(result.actions.map(row => [row.id, row.kind])).toEqual([['a1', 'removed'], ['a2', 'added']]); expect(result.checklist.map(row => [row.id, row.kind])).toEqual([['p1', 'removed'], ['a1', 'added']]); expect(result.actionCounts.unchanged).toBe(0);
  });
  it('separates list position from content and preserves before order then new incoming IDs', () => {
    const a2 = { ...action, id: 'a2' }, a3 = { ...action, id: 'a3' };
    const result = followupReplacementDiff(log, packet([action, a2]), packet([a3, a2, action]));
    expect(result.actions.map(row => row.id)).toEqual(['a1', 'a2', 'a3']); expect(result.actions.map(row => [row.kind, row.beforePosition, row.afterPosition, row.positionChanged])).toEqual([['unchanged', 1, 3, true], ['unchanged', 2, 2, false], ['added', null, 1, false]]); expect(result.actionCounts.positionChanged).toBe(1);
  });
  it('handles title-only, whitespace-only, empty lists and explicit clearing independently', () => {
    const changed = followupReplacementDiff(log, packet(), packet([{ ...action, text: action.text + ' ' }], [prompt], 'Other title')); expect(changed.titleChanged).toBe(true); expect(changed.actions[0].kind).toBe('changed');
    const removed = followupReplacementDiff(log, packet(), packet([], [], 'Empty')); expect(removed.actionCounts.removed).toBe(1); expect(removed.checklistCounts.removed).toBe(1); expect(followupReplacementDiff(log, packet([], []), packet([], [])).actions).toEqual([]);
  });
  it('strictly validates both packets, nested fingerprints, unknown fields and duplicate IDs', () => {
    for (const side of ['before', 'after']) for (const mutate of [p => { p.source_sha256 = 'b'.repeat(64); }, p => { p.checklist.source_sha256 = 'b'.repeat(64); }, p => { p.actions.items.push({ ...action }); }, p => { p.actions.extra = true; }]) {
      const a = packet(), b = packet(); mutate(side === 'before' ? a : b); expect(() => followupReplacementDiff(log, a, b)).toThrow();
    }
  });
  it('reports every before/after annotation and raw status without coordinates or claimed original-row evidence', () => {
    const text = followupDiffReport(log, packet(), packet([{ ...action, status: 'Closed', closure: 'Unverified outcome', owner: 'Other reviewer' }], [{ ...prompt, row: 4, status: 'Not applicable', note: 'Unverified reason' }], 'Revised'));
    for (const value of ['BEFORE title: Discussion', 'AFTER title: Revised', 'Owner', 'Not a merge', 'row: 4', 'Unverified outcome', 'Unverified reason', 'Other reviewer', log.sha256]) expect(text.toLowerCase()).toContain(value.toLowerCase());
    expect(text).not.toContain('28.614'); expect(text).not.toContain('77.209'); expect(text).not.toContain('12s'); expect(text).not.toContain('csv_text');
  });
  it('covers maximum saved lists without truncation or mutation and includes unchanged items in report', () => {
    const a = Array.from({ length: 50 }, (_, i) => ({ ...action, id: `a${i}` })), c = Array.from({ length: 30 }, (_, i) => ({ ...prompt, id: `p${i}` })); const current = packet(a, c), before = JSON.stringify(current);
    const result = followupReplacementDiff(log, current, current); expect(result.actionCounts.unchanged).toBe(50); expect(result.checklistCounts.unchanged).toBe(30); const text = followupDiffReport(log, current, current); expect(text).toContain('ID a49: unchanged'); expect(text).toContain('ID p29: unchanged'); expect(JSON.stringify(current)).toBe(before);
  });
});
