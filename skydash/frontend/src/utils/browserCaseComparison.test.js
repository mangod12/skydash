import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { webcrypto, createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { browserCaseComparison } from './browserCaseComparison';
import { createReviewCase, readReviewCase } from './reviewCase';
import { SAMPLE_LOG, LOG_VERSION, flightCSVHash, parseFlightCSV } from './flightLog';
import { reportReviewCaseComparison } from '../../scripts/report-review-case-comparison.mjs';
import { compareReviewCases } from '../../scripts/compare-review-cases.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const file = text => { const bytes = typeof text === 'string' ? Buffer.from(text) : text; return { name: 'PRIVATE.json', size: bytes.length, arrayBuffer: vi.fn(async () => bytes) }; };
const side = (raw, expected = '') => ({ file: file(raw), expected });
let raw, dir;
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); dir = await mkdtemp(join(tmpdir(), 'skydash-browser-case-'));
  const log = { filename: 'PRIVATE.csv', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) };
  raw = await createReviewCase(log, { title: 'PRIVATE title', notes: 'PRIVATE analyst' }, { markers: [], notes: 'PRIVATE instructor' }, null);
});
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, { recursive: true, force: true }); });
it('matches actual current CLI HTML and receipt semantics for equal sources and changed private sections, without Buffer', async () => {
  const changed = JSON.parse(raw); changed.review.notes += ' changed'; changed.debrief.notes += ' changed'; const right = JSON.stringify(changed), a = side(raw, hash(raw).toUpperCase()), b = side(right);
  const previous = globalThis.Buffer; let result; try { globalThis.Buffer = undefined; result = await browserCaseComparison(a, b); } finally { globalThis.Buffer = previous; }
  await writeFile(join(dir,'left.json'),raw); await writeFile(join(dir,'right.json'),right);
  expect(result.html).toBe(await reportReviewCaseComparison(join(dir,'left.json'),join(dir,'right.json'),{expectedLeftSha256:a.expected}));
  const data = await compareReviewCases(join(dir,'left.json'),join(dir,'right.json')); expect(data.review.analyst_notes).toBe('changed'); expect(data.review.title).toBe('unchanged'); expect(result.sourceEqual).toBe(true);
  for (const text of ['PRIVATE','28.6139','77.209','<script','<img','<iframe','<link','<form']) expect(result.html).not.toContain(text);
  expect(result.html).toContain('Analyst notes: changed'); expect(result.html).toContain('No independent complete-case expectation supplied for this side.');
});
it('gates every review flag on exact source bytes even if all review text stays equal', async () => {
  const changed = JSON.parse(raw); changed.source.csv_text += '\n'; changed.source.sha256 = await flightCSVHash(changed.source.csv_text); changed.debrief.source_sha256 = changed.source.sha256;
  const result = await browserCaseComparison(side(raw),side(JSON.stringify(changed)));
  expect(result.sourceEqual).toBe(false); expect(result.html.match(/not compared, source changed/g)).toHaveLength(6); expect(result.html).toContain('Source CSV bytes differ. Review sections NOT compared.');
});
it('formatting/key order affects exact bytes but not normalized content and does not invent chronology', async () => {
  const changed = Object.fromEntries(Object.entries(JSON.parse(raw)).reverse()), result = await browserCaseComparison(side(raw),side(JSON.stringify(changed)));
  expect(result.html).toContain('Complete artifact bytes: different'); expect(result.html).toContain('Validated case content: equal'); expect(result.html).toContain('Analyst notes: unchanged'); expect(result.html).toContain('not verified earlier/later');
});
it.each(['left','right'])('checks independent %s raw-file expectation before parsing and never accepts wrong pins', async position => {
  const a = side(raw), b = side(raw); (position === 'left' ? a : b).expected = 'a'.repeat(64);
  await expect(browserCaseComparison(a,b)).rejects.toThrow('expectation mismatch');
  const bad = side('{invalid JSON','a'.repeat(64)); await expect(browserCaseComparison(bad,b)).rejects.toThrow('expectation mismatch');
});
it.each([null,{}, {file:{size:0,arrayBuffer:vi.fn()}}, {file:{size:2*1024*1024+1,arrayBuffer:vi.fn()}}, {file:{size:1,arrayBuffer:vi.fn()},expected:'bad'}])('preflights both files before any reads',async invalid => {
  const a = side(raw); await expect(browserCaseComparison(a,invalid)).rejects.toThrow(); expect(a.file.arrayBuffer).not.toHaveBeenCalled();
});
it('rejects changed file size, invalid UTF8, nested source mismatch, unsupported model, marker bounds and receipt substitutes', async () => {
  const changed = side(raw); changed.file.size++; await expect(browserCaseComparison(changed,side(raw))).rejects.toThrow('size');
  await expect(browserCaseComparison(side(new Uint8Array([255,254])),side(raw))).rejects.toThrow();
  for(const mutate of [d=>{d.source.sha256='a'.repeat(64);},d=>{d.replay_model='unsupported';},d=>{d.debrief.markers=[{id:'bad'}];},d=>{d.format='receipt';}]) { const data = JSON.parse(raw); mutate(data); await expect(browserCaseComparison(side(raw),side(JSON.stringify(data)))).rejects.toThrow(); }
  await expect(readReviewCase(raw)).resolves.toBeTruthy();
});
it('filename metadata is separate from source equality and private whitespace is content', async()=>{
  const data=JSON.parse(raw);data.source.filename='OTHER.csv';data.review.notes+=' ';
  const result=await browserCaseComparison(side(raw),side(JSON.stringify(data)));
  expect(result.sourceEqual).toBe(true);expect(result.html).toContain('Source filename metadata: different');expect(result.html).toContain('Analyst notes: changed');expect(result.html).not.toContain('OTHER.csv');
});
