// @vitest-environment jsdom
import { createRef } from 'react';
import { TextEncoder, TextDecoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReviewCase from './ReviewCase';
import TrainingEnvelope from './TrainingEnvelope';
import InstructorDebrief from './InstructorDebrief';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV, flightCSVHash } from '../../utils/flightLog';
import { createReviewCase } from '../../utils/reviewCase';
let log;
const review = { title: 'Synthetic case', notes: 'Analyst note' };
const debrief = { markers: [{ id: 'one', time_s: 8, kind: 'Question', text: 'Gap question', discussed: true }], notes: 'Discussion summary' };
const envelope = { profile: { name: 'Synthetic criteria', maxAltitude: 30, maxSpeed: null, minBattery: 93 }, notes: 'Threshold notes' };
const onOpen = vi.fn(), onPause = vi.fn();
const setup = () => render(<ReviewCase log={log} getSnapshot={() => ({ log, review, debrief, envelope })} onOpen={onOpen} onPause={onPause} />);
const blobText = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
const importContents = contents => fireEvent.change(screen.getByLabelText('Open review case JSON'), { target: { files: [{ size: new Blob([contents]).size, arrayBuffer: async () => new TextEncoder().encode(contents).buffer }] } });
beforeEach(async () => { vi.clearAllMocks(); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('TextEncoder', TextEncoder); vi.stubGlobal('TextDecoder', TextDecoder); vi.stubGlobal('fetch', vi.fn()); URL.createObjectURL = vi.fn(() => 'blob:case'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); log = { filename: 'training.csv', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) }; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('portable local case workflow', () => {
  it('downloads one source-containing case and combined text report without a network request', async () => {
    setup(); fireEvent.click(screen.getByText('Download review case JSON')); await screen.findByText(/Download requested/); const data = JSON.parse(await blobText(URL.createObjectURL.mock.calls[0][0])); expect(data.source.csv_text).toBe(SAMPLE_LOG); expect(data.debrief.markers).toEqual(debrief.markers); expect(data.envelope).toEqual(envelope); fireEvent.click(screen.getByText('Download combined case report')); await screen.findByText(/Download requested/); const report = await blobText(URL.createObjectURL.mock.calls[1][0]); expect(report).toContain('Gap question'); expect(report).toContain('Sample 5 at 14s: 35m'); expect(globalThis.fetch).not.toHaveBeenCalled(); expect(onPause).toHaveBeenCalled();
  });
  it('validates and previews a case before explicit replacement, and can cancel', async () => {
    setup(); const contents = await createReviewCase(log, review, debrief, envelope); importContents(contents); await screen.findByText('Replace local workspace with case'); expect(onOpen).not.toHaveBeenCalled(); expect(screen.getByText(/6 samples \/ 16s. 1 instructor markers/)).toBeTruthy(); expect(screen.getByText(/also clears the current comparison/)).toBeTruthy(); fireEvent.click(screen.getByText('Keep current workspace')); expect(onOpen).not.toHaveBeenCalled(); importContents(contents); await screen.findByText('Replace local workspace with case'); fireEvent.click(screen.getByText('Replace local workspace with case')); expect(onOpen).toHaveBeenCalledOnce(); expect(onOpen.mock.calls[0][0].log.csv_text).toBe(SAMPLE_LOG); expect(screen.getByRole('status').textContent).toContain('recomputed');
  });
  it('can open a case without loading a separate CSV first', async () => {
    render(<ReviewCase log={null} getSnapshot={vi.fn()} onOpen={onOpen} onPause={onPause} />); expect(screen.getByText('Download review case JSON').disabled).toBe(true); importContents(await createReviewCase(log, review, debrief, null)); await screen.findByText('Replace local workspace with case'); fireEvent.click(screen.getByText('Replace local workspace with case')); expect(onOpen.mock.calls[0][0].data.envelope).toBeNull();
  });
  it('rejects corrupt and oversized cases without calling replacement or discarding current work', async () => {
    setup(); const data = JSON.parse(await createReviewCase(log, review, debrief, envelope)); data.source.sha256 = 'b'.repeat(64); importContents(JSON.stringify(data)); await screen.findByRole('alert'); expect(screen.getByRole('alert').textContent).toContain('fingerprint'); expect(screen.queryByText('Replace local workspace with case')).toBeNull(); expect(onOpen).not.toHaveBeenCalled(); const arrayBuffer = vi.fn(); fireEvent.change(screen.getByLabelText('Open review case JSON'), { target: { files: [{ size: 2097153, arrayBuffer }] } }); await screen.findByText(/at most 2MiB/); expect(arrayBuffer).not.toHaveBeenCalled();
  });
  it('reports an incomplete-review snapshot or export failure without losing the workspace', async () => {
    render(<ReviewCase log={log} getSnapshot={() => { throw Error('Unevaluated criteria'); }} onOpen={onOpen} onPause={onPause} />); fireEvent.click(screen.getByText('Download review case JSON')); await screen.findByRole('alert'); expect(screen.getByRole('alert').textContent).toContain('Unevaluated criteria'); expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(onOpen).not.toHaveBeenCalled();
  });
  it('disables opening while a primary source operation is still running', () => {
    render(<ReviewCase log={null} workspaceBusy getSnapshot={vi.fn()} onOpen={onOpen} onPause={onPause} />); expect(screen.getByLabelText('Open review case JSON').disabled).toBe(true); expect(screen.getByText('Download review case JSON').disabled).toBe(true);
  });
});
describe('review snapshots protect unfinished work and restore only validated initial review', () => {
  it('restores instructor state, recomputes source context and refuses an unadded marker draft', () => {
    const ref = createRef(); render(<InstructorDebrief ref={ref} log={log} initialReview={debrief} time={0} onSeek={vi.fn()} onPause={onPause} />); expect(screen.getByText('Gap question')).toBeTruthy(); expect(screen.getByText(/Source sample 4s, age 4.0s/)).toBeTruthy(); expect(ref.current.snapshot().markers).toEqual(debrief.markers); fireEvent.change(screen.getByLabelText('Instructor marker note'), { target: { value: 'Unadded draft' } }); expect(() => ref.current.snapshot()).toThrow('Add or clear');
  });
  it('restores evaluated criteria, recomputes evidence, refuses edited criteria until another review', () => {
    const ref = createRef(); render(<TrainingEnvelope ref={ref} log={log} initialReview={envelope} onSeek={vi.fn()} onPause={onPause} />); expect(screen.getByLabelText('Minimum battery result').textContent).toContain('Matches 2'); expect(ref.current.snapshot()).toEqual(envelope); fireEvent.change(screen.getByLabelText('Minimum battery threshold'), { target: { value: '90' } }); expect(() => ref.current.snapshot()).toThrow('Review the current'); fireEvent.click(screen.getByText('Review recorded samples')); expect(ref.current.snapshot().profile.minBattery).toBe(90); expect(ref.current.snapshot().notes).toBe('Threshold notes');
  });
  it('can package no criteria, but refuses a new unevaluated profile draft', () => {
    const ref = createRef(); render(<TrainingEnvelope ref={ref} log={log} onSeek={vi.fn()} onPause={onPause} />); expect(ref.current.snapshot()).toBeNull(); fireEvent.change(screen.getByLabelText('Review profile name'), { target: { value: 'Unevaluated' } }); expect(() => ref.current.snapshot()).toThrow('Unevaluated draft');
  });
});
it('case artifact pins check full raw bytes, accept uppercase, lock during preview, and cancel before changing expectation',async()=>{
 setup();const contents=await createReviewCase(log,review,debrief,envelope);const bytes=new TextEncoder().encode(contents),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');const input=screen.getByLabelText('Expected case artifact SHA-256');fireEvent.change(input,{target:{value:'f'.repeat(64)}});importContents(contents);await screen.findByRole('alert');expect(screen.queryByText('Replace local workspace with case')).toBeNull();expect(onOpen).not.toHaveBeenCalled();fireEvent.change(input,{target:{value:digest.toUpperCase()}});importContents(contents);await screen.findByText('Replace local workspace with case');expect(screen.getByText(/Separately supplied expected digest matched/)).toBeTruthy();expect(input.disabled).toBe(true);fireEvent.click(screen.getByText('Keep current workspace'));expect(input.disabled).toBe(false);importContents(contents+'\n');await screen.findByRole('alert');expect(screen.queryByText('Replace local workspace with case')).toBeNull();expect(onOpen).not.toHaveBeenCalled();expect(globalThis.fetch).not.toHaveBeenCalled();
});
it('blank case pin explicitly skips external check and malformed expectations do not read the file',async()=>{
 setup();const input=screen.getByLabelText('Expected case artifact SHA-256'),arrayBuffer=vi.fn();fireEvent.change(input,{target:{value:'bad'}});fireEvent.change(screen.getByLabelText('Open review case JSON'),{target:{files:[{size:2,arrayBuffer}]}});await screen.findByRole('alert');expect(arrayBuffer).not.toHaveBeenCalled();fireEvent.change(input,{target:{value:''}});importContents(await createReviewCase(log,review,debrief,envelope));await screen.findByText('Replace local workspace with case');expect(screen.getByText(/No external expected digest checked/)).toBeTruthy();
});
it('case expectation stays locked during slow validation and external workspace work',async()=>{
 const view=setup(),input=screen.getByLabelText('Expected case artifact SHA-256');let release;const contents=await createReviewCase(log,review,debrief,envelope);fireEvent.change(screen.getByLabelText('Open review case JSON'),{target:{files:[{size:contents.length,arrayBuffer:()=>new Promise(resolve=>{release=resolve;})}]}});expect(input.disabled).toBe(true);release(new TextEncoder().encode(contents).buffer);await screen.findByText('Replace local workspace with case');fireEvent.click(screen.getByText('Keep current workspace'));view.rerender(<ReviewCase log={log} workspaceBusy getSnapshot={vi.fn()} onOpen={onOpen} onPause={onPause}/>);expect(input.disabled).toBe(true);
});
