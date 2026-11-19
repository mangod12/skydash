import { describe, expect, it } from 'vitest';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from './flightLog';
import { CHECKLIST_VERSION, TEMPLATE_VERSION, checklistReview, checklistTemplate, readChecklist, checklistReport } from './debriefChecklist';
const log = { model_version: LOG_VERSION, sha256: 'a'.repeat(64), filename: 'source.csv', samples: parseFlightCSV(SAMPLE_LOG) };
const item = { id: 'prompt1', prompt: 'Discuss missing channel evidence', status: 'Discussed', note: 'Reviewer says discussed, not verified', row: 4 };
const read = data => readChecklist(JSON.stringify(data), log);
describe('reusable discussion checklist model', () => {
  it('roundtrips exact-source annotations and insertion order without CSV/coordinates or metrics', () => {
    const data = checklistReview(log, 'Our discussion', [item, { ...item, id: 'p2', row: null }]);
    expect(read(data)).toEqual({ kind: 'review', review: data }); expect(data.format).toBe(CHECKLIST_VERSION); expect(data.items[0]).not.toBe(item);
    for (const forbidden of ['samples', 'csv_text', 'latitude', 'longitude', 'time_s', 'battery_pct']) expect(JSON.stringify(data)).not.toContain(forbidden);
  });
  it('template includes title/prompts only, strips source/status/notes/references and resets every import for any source', () => {
    const data = checklistTemplate(log, 'Reusable discussion', [item]); expect(data).toEqual({ format: TEMPLATE_VERSION, title: 'Reusable discussion', items: [{ id: item.id, prompt: item.prompt }] });
    const other = { ...log, sha256: 'b'.repeat(64), samples: [log.samples[0]] };
    const imported = readChecklist(JSON.stringify(data), other); expect(imported.kind).toBe('template'); expect(imported.review.source_sha256).toBe(other.sha256); expect(imported.review.items[0]).toEqual({ id: item.id, prompt: item.prompt, status: 'Pending', note: '', row: null });
  });
  it.each([{ row: 0 }, { row: 7 }, { row: '4' }, { row: 1.5 }, { prompt: '' }, { prompt: 'x'.repeat(501) }, { note: 2 }, { note: 'x'.repeat(1001) }, { status: 'Passed' }, { status: 'Not applicable', note: '  ' }, { id: 'bad id' }, { id: '' }, { extra: true }])('rejects invalid prompt %j', patch => expect(() => checklistReview(log, 'Title', [{ ...item, ...patch }])).toThrow());
  it('requires a reason for Not applicable but permits Pending with prior notes preserved', () => {
    expect(checklistReview(log, 'Title', [{ ...item, status: 'Not applicable' }]).items[0].note).toBe(item.note);
    expect(checklistReview(log, 'Title', [{ ...item, status: 'Pending' }]).items[0].note).toBe(item.note);
  });
  it('validates titles, sources, counts, IDs and never mutates inputs', () => {
    for (const title of ['', ' '.repeat(2), 'x'.repeat(121), null]) expect(() => checklistReview(log, title, [item])).toThrow('title');
    expect(() => checklistReview({ ...log, model_version: 'future' }, 'Title', [item])).toThrow('supported'); expect(() => checklistReview({ ...log, sha256: 'bad' }, 'Title', [item])).toThrow('supported');
    expect(() => checklistReview(log, 'Title', [item, item])).toThrow('duplicate'); expect(() => checklistReview(log, 'Title', Array.from({ length: 31 }, (_, i) => ({ ...item, id: 'i' + i })))).toThrow('30');
    const before = JSON.stringify({ log, item }); checklistReview(log, 'Title', [item]); expect(JSON.stringify({ log, item })).toBe(before);
  });
  it.each([{ format: 'future' }, { replay_model: 'future' }, { source_sha256: 'b'.repeat(64) }, { stats: {} }, { items: null }])('rejects wrong source/models/fields %j', patch => expect(() => read({ ...checklistReview(log, 'Title', [item]), ...patch })).toThrow());
  it('rejects unknown template fields, statuses, source fields and bad prompts rather than importing annotations', () => {
    const data = checklistTemplate(log, 'Title', [item]);
    for (const patch of [{ source_sha256: log.sha256 }, { status: 'Discussed' }, { title: '' }, { items: [item] }, { items: [{ id: 'a', prompt: '' }] }]) expect(() => read({ ...data, ...patch })).toThrow();
  });
  it('rejects malformed/array/null and UTF8 oversize; supports explicit empty review/template', () => {
    for (const text of ['{', '[]', 'null']) expect(() => readChecklist(text, log)).toThrow(); expect(() => readChecklist('汉'.repeat(50000), log)).toThrow('128KiB');
    expect(read(checklistReview(log, 'Empty', [])).review.items).toEqual([]); expect(read(checklistTemplate(log, 'Empty', [])).review.items).toEqual([]);
  });
  it('reports every ordered prompt, exact original unknown evidence/gap or explicit absent row, never coordinates or grades', () => {
    const text = checklistReport(log, 'Private title', [item, { ...item, id: 'p2', row: null, prompt: 'No row' }, { ...item, id: 'p3', row: 1, status: 'Not applicable' }]);
    for (const expected of ['Private title', log.sha256, 'Original row 4 at 12s', '8s / gap over 5s', 'altitude unknown', 'battery unknown', 'No original source row referenced', 'none, first row', 'Not applicable: 1', 'not an operational preflight checklist']) expect(text).toContain(expected);
    expect(text).not.toContain('28.614'); expect(text).not.toContain('unknownm'); expect(text.indexOf(item.prompt)).toBeLessThan(text.indexOf('2. No row'));
  });
  it('bounds serialized UTF8 exports while allowing 30 ordinary maximal prompts', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ ...item, id: 'i' + i, prompt: 'x'.repeat(500), note: 'y'.repeat(1000) })); expect(read(checklistReview(log, 'Title', items)).review.items).toHaveLength(30);
    expect(() => checklistReview(log, 'Title', items.map(item => ({ ...item, prompt: '汉'.repeat(500), note: '汉'.repeat(1000) })))).toThrow('128KiB');
  });
});
