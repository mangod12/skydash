// @vitest-environment jsdom
import { TextEncoder, TextDecoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstructorDebrief from './InstructorDebrief';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from '../../utils/flightLog';
import { debriefSidecar } from '../../utils/instructorDebrief';
const log = { filename: 'training.csv', model_version: LOG_VERSION, sha256: 'a'.repeat(64), samples: parseFlightCSV(SAMPLE_LOG) };
const initial = { log, time: 8, onSeek: vi.fn(), onPause: vi.fn() };
const marker = { id: 'imported', time_s: 12, kind: 'Question', text: 'Imported discussion point', discussed: true };
const file = text => ({ name: 'review.json', size: text.length, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('TextEncoder', TextEncoder); vi.stubGlobal('TextDecoder', TextDecoder); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('fetch', vi.fn()); URL.createObjectURL = vi.fn(() => 'blob:debrief'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const add = text => { fireEvent.change(screen.getByLabelText('Instructor marker note'), { target: { value: text } }); fireEvent.click(screen.getByText('Add marker at cursor')); };
const importFile = text => fireEvent.change(screen.getByLabelText('Import debrief JSON'), { target: { files: [file(text)] } });
const blobText = blob => new Promise(resolve => { const reader = new globalThis.FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
describe('instructor review timeline', () => {
  it('captures a paused cursor, labels held evidence and jumps back to the exact review time', () => {
    render(<InstructorDebrief {...initial} />); expect(screen.getByText('Add marker at cursor').disabled).toBe(true); add('Discuss this missing interval.');
    expect(initial.onPause).toHaveBeenCalled(); const list = within(screen.getByLabelText('Instructor review markers'));
    expect(list.getByText('Discuss this missing interval.')).toBeTruthy(); expect(list.getByText(/DATA GAP/)).toBeTruthy();
    fireEvent.click(list.getByText('Jump to 8.0s')); expect(initial.onSeek).toHaveBeenCalledWith(8); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('keeps markers chronologically sorted and toggles discussion state without grading', () => {
    const view = render(<InstructorDebrief {...initial} />); add('Later point'); view.rerender(<InstructorDebrief {...initial} time={0} />); add('Earlier point');
    const rows = within(screen.getByLabelText('Instructor review markers')).getAllByRole('listitem'); expect(rows[0].textContent).toContain('Earlier point'); expect(rows[1].textContent).toContain('Later point');
    fireEvent.click(screen.getByLabelText('Discussed at 0.0s')); expect(screen.getByLabelText('Discussed at 0.0s').checked).toBe(true);
    fireEvent.click(screen.getByText('Remove marker at 8.0s')); expect(screen.queryByText('Later point')).toBeNull(); expect(screen.getByText('Earlier point')).toBeTruthy();
  });
  it('downloads a source-bound sidecar and a report with instructor notes and recomputed context', async () => {
    render(<InstructorDebrief {...initial} />); add('Review gap'); fireEvent.change(screen.getByLabelText('Discussion summary'), { target: { value: 'Follow up with the data owner.' } });
    fireEvent.click(screen.getByText('Download debrief JSON')); const json = JSON.parse(await blobText(URL.createObjectURL.mock.calls[0][0]));
    expect(json.source_sha256).toBe(log.sha256); expect(json.markers[0].time_s).toBe(8); expect(json.notes).toBe('Follow up with the data owner.'); expect(json.csv_text).toBeUndefined();
    fireEvent.click(screen.getByText('Download instructor report')); const report = await blobText(URL.createObjectURL.mock.calls[1][0]); expect(report).toContain('sample 3 at 4s'); expect(report).toContain('DATA GAP'); expect(report).toContain('Review gap'); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('imports only after explicit replacement confirmation and can cancel without losing the current review', async () => {
    render(<InstructorDebrief {...initial} />); add('Current marker'); const json = JSON.stringify(debriefSidecar(log, [marker], 'Imported summary'));
    importFile(json); await screen.findByText('Replace with imported review'); expect(screen.getByText('Current marker')).toBeTruthy(); expect(screen.queryByText('Imported discussion point')).toBeNull();
    fireEvent.click(screen.getByText('Keep current review')); expect(screen.getByText('Current marker')).toBeTruthy();
    importFile(json); await screen.findByText('Replace with imported review'); fireEvent.click(screen.getByText('Replace with imported review'));
    expect(screen.queryByText('Current marker')).toBeNull(); expect(screen.getByText('Imported discussion point')).toBeTruthy(); expect(screen.getByLabelText('Discussion summary').value).toBe('Imported summary'); expect(screen.getByLabelText('Discussed at 12.0s').checked).toBe(true);
  });
  it('rejects a mismatched source without replacing any current notes or markers', async () => {
    render(<InstructorDebrief {...initial} />); add('Preserve this'); fireEvent.change(screen.getByLabelText('Discussion summary'), { target: { value: 'Preserve summary' } });
    importFile(JSON.stringify({ ...debriefSidecar(log, [marker]), source_sha256: 'b'.repeat(64) })); await screen.findByRole('alert'); expect(screen.getByRole('alert').textContent).toContain('fingerprint mismatch');
    expect(screen.getByText('Preserve this')).toBeTruthy(); expect(screen.getByLabelText('Discussion summary').value).toBe('Preserve summary'); expect(screen.queryByText('Replace with imported review')).toBeNull();
  });
  it('rejects oversized files before reading and malformed markers before confirmation', async () => {
    render(<InstructorDebrief {...initial} />); const arrayBuffer = vi.fn(); fireEvent.change(screen.getByLabelText('Import debrief JSON'), { target: { files: [{ name: 'big.json', size: 262145, arrayBuffer }] } }); await screen.findByRole('alert'); expect(arrayBuffer).not.toHaveBeenCalled();
    importFile(JSON.stringify({ ...debriefSidecar(log, [marker]), markers: [{ ...marker, time_s: 99 }] })); await screen.findByText(/outside this recorded source/); expect(screen.queryByText('Replace with imported review')).toBeNull();
  });
  it('requires clear confirmation, preserves source, and reports export failure honestly', () => {
    render(<InstructorDebrief {...initial} />); add('Keep until confirmed'); fireEvent.click(screen.getByText('Clear instructor review')); fireEvent.click(screen.getByText('Keep review')); expect(screen.getByText('Keep until confirmed')).toBeTruthy();
    URL.createObjectURL.mockImplementationOnce(() => { throw Error('blocked'); }); fireEvent.click(screen.getByText('Download debrief JSON')); expect(screen.getByRole('alert').textContent).toContain('could not start'); expect(screen.getByText('Keep until confirmed')).toBeTruthy();
    fireEvent.click(screen.getByText('Clear instructor review')); fireEvent.click(screen.getByText('Confirm clear review')); expect(screen.queryByText('Keep until confirmed')).toBeNull(); expect(screen.getByText(/Source CSV and saved records are unchanged/)).toBeTruthy();
  });
  it('renders imported annotation text as plain text rather than HTML', async () => {
    render(<InstructorDebrief {...initial} />); importFile(JSON.stringify(debriefSidecar(log, [{ ...marker, text: '<img src=x onerror=alert(1)>' }]))); await screen.findByText('Replace with imported review'); fireEvent.click(screen.getByText('Replace with imported review'));
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy(); expect(document.querySelector('img')).toBeNull();
  });
});
