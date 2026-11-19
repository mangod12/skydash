// @vitest-environment jsdom
import { TextEncoder, TextDecoder } from 'node:util';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TrainingEnvelope from './TrainingEnvelope';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from '../../utils/flightLog';
import { envelopeProfileJSON } from '../../utils/trainingEnvelope';
const log = { filename: 'training.csv', model_version: LOG_VERSION, sha256: 'a'.repeat(64), samples: parseFlightCSV(SAMPLE_LOG) };
const props = { log, onSeek: vi.fn(), onPause: vi.fn() };
const set = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const run = () => fireEvent.click(screen.getByText('Review recorded samples'));
const setup = () => { set('Review profile name', 'Instructor exercise'); set('Maximum source altitude threshold', '30'); set('Maximum ground speed threshold', '5'); set('Minimum battery threshold', '93'); run(); };
const blobText = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
const imported = { name: 'Imported criteria', maxAltitude: null, maxSpeed: 0, minBattery: null };
const importData = data => { const text = JSON.stringify(data); fireEvent.change(screen.getByLabelText('Import review profile'), { target: { files: [{ size: text.length, arrayBuffer: async () => new TextEncoder().encode(text).buffer }] } }); };
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('TextDecoder', TextDecoder); vi.stubGlobal('fetch', vi.fn()); URL.createObjectURL = vi.fn(() => 'blob:envelope'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('training envelope review', () => {
  it('does not infer defaults or evaluate before explicit valid criteria', () => {
    render(<TrainingEnvelope {...props} />); expect(screen.queryByLabelText('Generated envelope review')).toBeNull(); run(); expect(screen.getByRole('alert').textContent).toContain('name'); set('Review profile name', 'Name'); run(); expect(screen.getByRole('alert').textContent).toContain('at least one'); expect(screen.queryByLabelText('Generated envelope review')).toBeNull();
  });
  it('displays known/missing counts, strict thresholds and sample evidence, pauses and seeks exact times', () => {
    render(<TrainingEnvelope {...props} />); setup(); const altitude = within(screen.getByLabelText('Maximum source altitude result')); expect(altitude.getByText(/Known 5\/6, missing 1/)).toBeTruthy(); expect(altitude.getByText(/First 14s, last 14s/)).toBeTruthy(); fireEvent.click(altitude.getByText('First maximum source altitude match')); expect(props.onSeek).toHaveBeenLastCalledWith(14); expect(props.onPause).toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled();
    const battery = within(screen.getByLabelText('Minimum battery result')); fireEvent.click(battery.getByText('First minimum battery match')); expect(props.onSeek).toHaveBeenLastCalledWith(14); fireEvent.click(battery.getByText('Next matching sample')); expect(props.onSeek).toHaveBeenLastCalledWith(16); expect(battery.getByText('Next matching sample').disabled).toBe(true); fireEvent.click(battery.getByText('Previous matching sample')); expect(props.onSeek).toHaveBeenLastCalledWith(14);
  });
  it('blocks stale evidence and exports until explicitly recomputed, while retaining notes', () => {
    render(<TrainingEnvelope {...props} />); setup(); set('Envelope review notes', 'Keep notes'); set('Maximum source altitude threshold', '40'); expect(screen.getByText('Download envelope report').disabled).toBe(true); expect(screen.getByText('First maximum source altitude match').disabled).toBe(true); expect(screen.getByRole('alert').textContent).toContain('Criteria changed'); run(); expect(screen.getByText('Download envelope report').disabled).toBe(false); expect(screen.getByLabelText('Maximum source altitude result').textContent).toContain('INCOMPLETE EVIDENCE'); expect(screen.getByLabelText('Envelope review notes').value).toBe('Keep notes');
  });
  it('downloads reusable profile without private source and report with all source-bound sample evidence', async () => {
    render(<TrainingEnvelope {...props} />); setup(); set('Envelope review notes', 'Ask about source datum'); fireEvent.click(screen.getByText('Download review profile')); const data = JSON.parse(await blobText(URL.createObjectURL.mock.calls[0][0])); expect(data.profile.name).toBe('Instructor exercise'); expect(data.profile.maxSpeed).toBe(5); expect(data.source_sha256).toBeUndefined(); expect(data.notes).toBeUndefined(); fireEvent.click(screen.getByText('Download envelope report')); const report = await blobText(URL.createObjectURL.mock.calls[1][0]); expect(report).toContain(log.sha256); expect(report).toContain('Ask about source datum'); expect(report).toContain('Sample 6 at 16s: 90%'); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('previews and confirms imported values without auto-run, preserves notes and supports cancellation', async () => {
    render(<TrainingEnvelope {...props} />); setup(); set('Envelope review notes', 'Keep review notes'); importData(envelopeProfileJSON(imported)); await screen.findByText('Use imported criteria'); expect(screen.getByLabelText('Review profile name').value).toBe('Instructor exercise'); fireEvent.click(screen.getByText('Keep current criteria')); expect(screen.getByText('Download review profile').disabled).toBe(false); importData(envelopeProfileJSON(imported)); await screen.findByText('Use imported criteria'); fireEvent.click(screen.getByText('Use imported criteria')); expect(screen.getByLabelText('Review profile name').value).toBe('Imported criteria'); expect(screen.getByLabelText('Maximum source altitude threshold').value).toBe(''); expect(screen.getByLabelText('Maximum ground speed threshold').value).toBe('0'); expect(screen.getByText('Download review profile').disabled).toBe(true); expect(screen.getByLabelText('Envelope review notes').value).toBe('Keep review notes'); run(); expect(screen.getByLabelText('Maximum source altitude result').textContent).toContain('DISABLED'); expect(screen.getByLabelText('Maximum ground speed result').textContent).toContain('Matches 4');
  });
  it('rejects bad files and overlarge imports without replacing current fields or result', async () => {
    render(<TrainingEnvelope {...props} />); setup(); importData({ ...envelopeProfileJSON(imported), approved: true }); await screen.findByRole('alert'); expect(screen.queryByText('Use imported criteria')).toBeNull(); expect(screen.getByLabelText('Review profile name').value).toBe('Instructor exercise'); expect(screen.getByText('Download review profile').disabled).toBe(false); const arrayBuffer = vi.fn(); fireEvent.change(screen.getByLabelText('Import review profile'), { target: { files: [{ size: 8193, arrayBuffer }] } }); await screen.findByText(/at most 8KiB/); expect(arrayBuffer).not.toHaveBeenCalled();
  });
  it('keeps previous result but prevents export when invalid edits fail review', () => {
    render(<TrainingEnvelope {...props} />); setup(); set('Minimum battery threshold', '101'); run(); expect(screen.getAllByRole('alert').some(item => item.textContent.includes('0 to 100'))).toBe(true); expect(screen.getByText('Download review profile').disabled).toBe(true); expect(screen.getByLabelText('Generated envelope review')).toBeTruthy();
  });
  it('does not lose the result or notes after a download failure', () => {
    render(<TrainingEnvelope {...props} />); setup(); set('Envelope review notes', 'Keep'); URL.createObjectURL.mockImplementationOnce(() => { throw Error('blocked'); }); fireEvent.click(screen.getByText('Download envelope report')); expect(screen.getByRole('alert').textContent).toContain('could not start'); expect(screen.getByLabelText('Envelope review notes').value).toBe('Keep'); expect(screen.getByLabelText('Generated envelope review')).toBeTruthy();
  });
  it('matching groups follow reviewed criteria and block while source busy or profile import pending/loading', async () => {
    const view=render(<TrainingEnvelope {...props} />); setup(); const groups=()=>within(screen.getByLabelText('Maximum source altitude matching row groups')); const button=()=>groups().getByText('Seek group 1 first row 5'); expect(button().disabled).toBe(false); fireEvent.click(button()); expect(props.onSeek).toHaveBeenLastCalledWith(14);
    set('Maximum source altitude threshold','20'); expect(button().disabled).toBe(true); run(); expect(groups().getByLabelText('Maximum source altitude group totals').textContent).toContain('groups');
    view.rerender(<TrainingEnvelope {...props} disabled />); for(const control of groups().getAllByRole('button')) expect(control.disabled).toBe(true); view.rerender(<TrainingEnvelope {...props} />);
    let resolve; fireEvent.change(screen.getByLabelText('Import review profile'),{target:{files:[{size:20,arrayBuffer:()=>new Promise(done=>{resolve=done;})}]}}); for(const control of groups().getAllByRole('button')) expect(control.disabled).toBe(true); resolve(new TextEncoder().encode(JSON.stringify(envelopeProfileJSON(imported))).buffer); await screen.findByText('Use imported criteria'); for(const control of groups().getAllByRole('button')) expect(control.disabled).toBe(true); fireEvent.click(screen.getByText('Keep current criteria')); expect(groups().getAllByRole('button').some(control=>!control.disabled)).toBe(true);
  });

});
