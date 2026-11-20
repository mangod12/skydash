// @vitest-environment jsdom
import { TextEncoder, TextDecoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FlightLogReplay from './FlightLogReplay';
import { createPairedReviewBundle } from '../../utils/pairedReviewBundle';
import { SAMPLE_LOG, LOG_VERSION, parseFlightCSV, flightCSVHash } from '../../utils/flightLog';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
vi.mock('react-leaflet', () => ({ MapContainer: ({ children }) => <div>{children}</div>, TileLayer: () => null, Polyline: () => null, CircleMarker: ({ children }) => <div>{children}</div>, Tooltip: ({ children }) => <span>{children}</span>, useMap: () => ({ fitBounds: vi.fn() }) }));
vi.mock('../../utils/api', () => ({ apiFetch: (...args) => globalThis.fetch(...args) }));
const response = (data, ok = true) => ({ ok, json: async () => ok ? { success: true, data } : { detail: data } });
let saved;
beforeEach(async () => {
  vi.stubGlobal('TextEncoder', TextEncoder); vi.stubGlobal('TextDecoder', TextDecoder); vi.stubGlobal('crypto', webcrypto);
  URL.createObjectURL = vi.fn(() => 'blob:flight'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  useUIStore.setState({ activeView: 'scenario', workspace: 'operator', recordedSourceOpen: false, pendingRecordedExit: null });
  useAuthStore.setState({ authEnabled: false, user: null });
  saved = { id: 'saved-1', title: 'Saved training', filename: 'source.csv', notes: 'Fixed notes', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, sample_count: 6, duration_s: 16, created_at: '2026-11-18T12:00:00Z' };
  vi.stubGlobal('fetch', vi.fn(async () => response([])));
});
afterEach(() => { vi.useRealTimers(); cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const sample = async () => { const button = screen.getByText('Load synthetic sample'); await waitFor(() => expect(button.disabled).toBe(false)); fireEvent.click(button); await waitFor(() => expect(button.disabled).toBe(false)); if (screen.queryByText('Replace recorded workspace with checked source')) fireEvent.click(screen.getByText('Replace recorded workspace with checked source')); await screen.findByLabelText('Current recorded observation'); };
const refreshAndOpen = async () => {
  globalThis.fetch.mockResolvedValueOnce(response([saved])).mockResolvedValueOnce(response(saved));
  fireEvent.click(screen.getByText('Refresh server archive')); await screen.findByText('Saved training');
  const replacing = Boolean(screen.queryByLabelText('Current recorded observation')); fireEvent.click(screen.getByText('Saved training')); if (replacing) fireEvent.click(await screen.findByText('Replace recorded workspace with checked source')); else await screen.findByText(/checksum verified/); await screen.findByLabelText('Current recorded observation');
};
const selectPlaybackWindow=(first,last)=>{fireEvent.change(screen.getByLabelText('Window start data row'),{target:{value:String(first)}});fireEvent.change(screen.getByLabelText('Window end data row'),{target:{value:String(last)}});fireEvent.change(screen.getByLabelText('Window label'),{target:{value:'Instructor playback'}});fireEvent.click(screen.getByText('Review selected samples'));};
describe('bounded primary replay integration',()=>{
 it('runs once to exact end through original gap, then global play resumes full source with a single click',async()=>{render(<FlightLogReplay/>);await sample();selectPlaybackWindow(3,4);vi.useFakeTimers({toFake:['setInterval','clearInterval','performance']});fireEvent.click(screen.getByText('Play reviewed window once'));expect(screen.getByLabelText('Replay position').value).toBe('4');act(()=>vi.advanceTimersByTime(4000));expect(Number(screen.getByLabelText('Replay position').value)).toBeCloseTo(8,8);expect(screen.getByLabelText('Current recorded observation').textContent).toContain('at 4s');expect(screen.getByText(/DATA GAP. Holding/)).toBeTruthy();act(()=>vi.advanceTimersByTime(5000));expect(screen.getByLabelText('Replay position').value).toBe('12');expect(screen.getByLabelText('Active selected-window playback').textContent).toContain('Stopped at selected final timestamp');act(()=>vi.advanceTimersByTime(5000));expect(screen.getByLabelText('Replay position').value).toBe('12');fireEvent.click(screen.getByText('Play replay'));expect(screen.queryByLabelText('Active selected-window playback')).toBeNull();act(()=>vi.advanceTimersByTime(1000));expect(Number(screen.getByLabelText('Replay position').value)).toBeGreaterThan(12);});
 it('repeats only on explicit action, shows endpoint, supports stop and cancels bound on scrub/edit/source replacement',async()=>{render(<FlightLogReplay/>);await sample();selectPlaybackWindow(2,3);vi.useFakeTimers({toFake:['setInterval','clearInterval','performance']});fireEvent.click(screen.getByText('Repeat reviewed window'));expect(screen.getByLabelText('Active selected-window playback').textContent).toContain('REPEATING');act(()=>vi.advanceTimersByTime(2000));expect(screen.getByLabelText('Replay position').value).toBe('4');act(()=>vi.advanceTimersByTime(100));expect(screen.getByLabelText('Replay position').value).toBe('2');fireEvent.click(screen.getByText('Stop selected-window playback'));act(()=>vi.advanceTimersByTime(1000));expect(screen.getByLabelText('Replay position').value).toBe('2');fireEvent.click(screen.getByText('Repeat reviewed window'));fireEvent.change(screen.getByLabelText('Replay position'),{target:{value:'8'}});expect(screen.queryByLabelText('Active selected-window playback')).toBeNull();fireEvent.click(screen.getByText('Repeat reviewed window'));fireEvent.change(screen.getByLabelText('Window label'),{target:{value:'Unreviewed'}});expect(screen.queryByLabelText('Active selected-window playback')).toBeNull();expect(screen.getByText('Repeat reviewed window').disabled).toBe(true);fireEvent.click(screen.getByText('Discard window edits'));fireEvent.click(screen.getByText('Repeat reviewed window'));vi.useRealTimers();await sample();expect(screen.queryByLabelText('Active selected-window playback')).toBeNull();});
 it('rejects one-row playback and blocks starting stale or busy reviewed selections',async()=>{render(<FlightLogReplay/>);await sample();selectPlaybackWindow(4,4);expect(screen.getByText('Play reviewed window once').disabled).toBe(true);expect(screen.getByText('Repeat reviewed window').disabled).toBe(true);expect(screen.getByText(/Single-row window has no positive/)).toBeTruthy();selectPlaybackWindow(3,4);fireEvent.change(screen.getByLabelText('Window discussion notes'),{target:{value:'Changed'}});expect(screen.getByText('Play reviewed window once').disabled).toBe(true);});
});
describe('flight-log import, replay, debrief and archive workflow', () => {
  it('previews locally, holds through gaps, resets deterministically and exports without uploading', async () => {
    render(<FlightLogReplay />); await sample(); expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current recorded observation').textContent).toContain('Sample 1/6 at 0s');
    fireEvent.change(screen.getByLabelText('Replay position'), { target: { value: '8' } });
    expect(screen.getByLabelText('Current recorded observation').textContent).toContain('at 4s'); expect(screen.getByText(/DATA GAP\. Holding observation/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Replay position'), { target: { value: '12' } });
    expect(screen.getByLabelText('Current recorded observation').textContent).toContain('altitude unknown');
    fireEvent.click(screen.getByText('Reset replay')); expect(screen.getByLabelText('Replay position').value).toBe('0');
    fireEvent.click(screen.getByText('Download after-action report')); expect(URL.createObjectURL).toHaveBeenCalledOnce(); expect(globalThis.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Download source CSV')); expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });
  it('accepts an actual file without uploading and keeps the old preview on a failed new import', async () => {
    render(<FlightLogReplay />);
    const file = { name: 'origin.csv', size: 100, arrayBuffer: async () => new TextEncoder().encode(SAMPLE_LOG).buffer };
    fireEvent.change(screen.getByLabelText('Choose flight CSV'), { target: { files: [file] } });
    await screen.findByText(/Source: origin.csv/); expect(globalThis.fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Choose flight CSV'), { target: { files: [{ ...file, arrayBuffer: async () => new TextEncoder().encode('bad').buffer }] } });
    await screen.findByRole('alert'); expect(screen.getByText(/Source: origin.csv/)).toBeTruthy();
  });
  it('saves only on an explicit click, with the reviewed title, notes and exact CSV', async () => {
    render(<FlightLogReplay />); await sample();
    fireEvent.change(screen.getByLabelText('Review title'), { target: { value: 'Saved training' } });
    fireEvent.change(screen.getByLabelText('Analyst notes'), { target: { value: 'Fixed notes' } });
    fireEvent.click(screen.getByText('Refresh server archive')); await screen.findByText(/Server archive refreshed/);
    globalThis.fetch.mockResolvedValueOnce(response({ ...saved, filename: 'synthetic-training-sample.csv' }));
    fireEvent.click(screen.getByText('Save to server')); await screen.findByText(/Saved to the server SQLite archive/);
    const options = globalThis.fetch.mock.calls[1][1]; expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ title: 'Saved training', notes: 'Fixed notes', filename: 'synthetic-training-sample.csv', csv_text: SAMPLE_LOG });
    expect(screen.getByLabelText('Analyst notes').disabled).toBe(true); expect(screen.getByText('Save to server').disabled).toBe(true);
  });
  it('reopens a saved source after remount, verifies its checksum and confirms deletion', async () => {
    const view = render(<FlightLogReplay />); await refreshAndOpen(); view.unmount(); render(<FlightLogReplay />); await refreshAndOpen();
    expect(screen.getByLabelText('Analyst notes').value).toBe('Fixed notes');
    fireEvent.click(screen.getByText('Delete server record')); expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    fireEvent.click(screen.getByText('Keep record')); expect(screen.queryByText('Confirm delete record')).toBeNull();
    fireEvent.click(screen.getByText('Delete server record')); globalThis.fetch.mockResolvedValueOnce(response({ deleted: saved.id }));
    fireEvent.click(screen.getByText('Confirm delete record')); await screen.findByText(/Server record deleted/);
    expect(globalThis.fetch.mock.calls.at(-1)[1].method).toBe('DELETE'); expect(screen.getByText('Save to server').disabled).toBe(false);
  });
  it('rejects a corrupted saved source and leaves the current preview intact', async () => {
    render(<FlightLogReplay />); await sample();
    globalThis.fetch.mockResolvedValueOnce(response([saved])).mockResolvedValueOnce(response({ ...saved, sha256: 'bad' }));
    fireEvent.click(screen.getByText('Refresh server archive')); await screen.findByText('Saved training'); fireEvent.click(screen.getByText('Saved training'));
    await screen.findByRole('alert'); expect(screen.getByRole('alert').textContent).toContain('checksum mismatch');
    expect(screen.getByLabelText('Review title').value).toBe('synthetic-training-sample');
  });
  it('shows failed saves honestly and never clears the unsaved notes', async () => {
    render(<FlightLogReplay />); await sample(); fireEvent.change(screen.getByLabelText('Analyst notes'), { target: { value: 'Keep this draft' } });
    fireEvent.click(screen.getByText('Refresh server archive')); await screen.findByText(/Server archive refreshed/);
    globalThis.fetch.mockResolvedValueOnce(response('Archive unavailable', false)); fireEvent.click(screen.getByText('Save to server'));
    await screen.findByRole('alert'); expect(screen.getByLabelText('Analyst notes').value).toBe('Keep this draft'); expect(screen.getByText('Save to server').disabled).toBe(false);
  });
  it('does not offer archive mutation to viewers', async () => {
    useAuthStore.setState({ authEnabled: true, user: { role: 'viewer' } }); render(<FlightLogReplay />); await sample();
    expect(screen.getByText('Save to server').disabled).toBe(true); await refreshAndOpen(); expect(screen.queryByText('Delete server record')).toBeNull();
  });
  it('plays time-based samples, pauses and stops at the final frame without wrapping', async () => {
    render(<FlightLogReplay />); await sample(); vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText('Playback speed'), { target: { value: '8' } }); fireEvent.click(screen.getByText('Play replay'));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(Number(screen.getByLabelText('Replay position').value)).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Replay position'), { target: { value: '16' } });
    expect(screen.getByText('Play replay').disabled).toBe(true); expect(screen.getByLabelText('Current recorded observation').textContent).toContain('at 16s');
    fireEvent.click(screen.getByText('Reset replay')); expect(screen.getByLabelText('Replay position').value).toBe('0'); vi.useRealTimers();
  });
  it('keeps save disabled until a compatible backend is checked and explains an old hosted backend', async () => {
    render(<FlightLogReplay />); await sample(); expect(screen.getByText('Save to server').disabled).toBe(true);
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ detail: 'Not Found' }) });
    fireEvent.click(screen.getByText('Refresh server archive')); await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('does not have the flight-log archive API'); expect(screen.getByText('Save to server').disabled).toBe(true);
  });
  it('clears the comparison when a different primary source is imported', async () => {
    render(<FlightLogReplay />); await sample(); fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByLabelText('Comparison time');
    const changed = SAMPLE_LOG.replace('28.61390', '28.61391');
    fireEvent.change(screen.getByLabelText('Choose flight CSV'), { target: { files: [{ name: 'different.csv', size: changed.length, arrayBuffer: async () => new TextEncoder().encode(changed).buffer }] } });
    fireEvent.click(await screen.findByText('Replace recorded workspace with checked source')); await screen.findByText(/Source: different.csv/); expect(screen.queryByLabelText('Comparison time')).toBeNull();
  });
  it('clears source-bound instructor markers when a different primary CSV loads', async () => {
    render(<FlightLogReplay />); await sample(); fireEvent.change(screen.getByLabelText('Instructor marker note'), { target: { value: 'Old source marker' } }); fireEvent.click(screen.getByText('Add marker at cursor')); expect(screen.getByLabelText('Instructor review markers').textContent).toContain('Old source marker');
    const changed = SAMPLE_LOG.replace('28.61390', '28.61391'); fireEvent.change(screen.getByLabelText('Choose flight CSV'), { target: { files: [{ name: 'different.csv', size: changed.length, arrayBuffer: async () => new TextEncoder().encode(changed).buffer }] } });
    fireEvent.click(await screen.findByText('Replace recorded workspace with checked source')); await screen.findByText(/Source: different.csv/); expect(screen.queryByText('Old source marker')).toBeNull();
  });
  it('reports download errors and returns to the lab', async () => {
    const onBack = vi.fn(); render(<FlightLogReplay onBack={onBack} />); await sample();
    URL.createObjectURL.mockImplementationOnce(() => { throw Error('blocked'); }); fireEvent.click(screen.getByText('Download source CSV'));
    expect(screen.getByRole('alert').textContent).toContain('Download could not start'); fireEvent.click(screen.getByText('Back to Scenario Lab')); expect(onBack).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Leave and discard recorded session')); expect(onBack).toHaveBeenCalledOnce();
  });
});

it('keeps primary and comparison background permission separate, resets primary on source load', async () => {
  render(<FlightLogReplay />); await sample(); const primary = screen.getByLabelText('Allow external basemap for primary replay'); expect(primary.checked).toBe(false);
  fireEvent.click(primary); expect(primary.checked).toBe(true); fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByLabelText('Comparison time');
  const comparison = screen.getByLabelText('Allow external basemap for two-flight comparison'); expect(comparison.checked).toBe(false); fireEvent.click(comparison); expect(comparison.checked).toBe(true); expect(primary.checked).toBe(true);
  await sample(); expect(screen.getByLabelText('Allow external basemap for primary replay').checked).toBe(false); expect(globalThis.fetch).not.toHaveBeenCalled();
});

describe('review workspace presentation focus', () => {
  const focus = value => fireEvent.change(screen.getByLabelText('Visible review panel group'), { target: { value } });
  const wrapper = name => document.querySelector(`[data-review-panel="${name}"]`);
  it('defaults to all and hides only wrappers without unmounting panels or refs', async () => {
    render(<FlightLogReplay />); await sample();
    const originals = [...document.querySelectorAll('[data-review-panel]')].map(element => element.firstChild);
    for (const group of ['source', 'interval', 'debrief', 'all']) {
      focus(group);
      expect([...document.querySelectorAll('[data-review-panel]')].map(element => element.firstChild)).toEqual(originals);
      expect(wrapper('SourceEvidence').hidden).toBe(!['all', 'source'].includes(group));
      expect(wrapper('ReviewWindow').hidden).toBe(!['all', 'interval'].includes(group));
      expect(wrapper('DebriefActions').hidden).toBe(!['all', 'debrief'].includes(group));
      expect(screen.getByLabelText('Recorded replay controls')).toBeTruthy();
      expect(screen.getByLabelText('Two-flight comparison')).toBeTruthy();
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('keeps unsaved action text and original export guards through hide/show', async () => {
    render(<FlightLogReplay />); await sample();
    fireEvent.click(screen.getByText('New action from held source row'));
    fireEvent.change(screen.getByLabelText('Reviewer action text'), { target: { value: 'Hidden draft remains private' } });
    focus('source'); expect(wrapper('DebriefActions').hidden).toBe(true);
    focus('debrief'); expect(screen.getByLabelText('Reviewer action text').value).toBe('Hidden draft remains private');
    fireEvent.click(screen.getByText('Download follow-up packet JSON'));
    expect(screen.getByRole('alert').textContent).toContain('Finish or cancel action edits');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('reveals a target group before exact scroll, preserves all when already visible and leaves comparison independent', async () => {
    const scroll = vi.fn(); Element.prototype.scrollIntoView = scroll;
    render(<FlightLogReplay />); await sample();
    focus('debrief'); fireEvent.click(screen.getByText('Source row ledger'));
    expect(screen.getByLabelText('Visible review panel group').value).toBe('source');
    expect(wrapper('SourceRowLedger').hidden).toBe(false); expect(scroll).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Compare two flights')); expect(screen.getByLabelText('Visible review panel group').value).toBe('source');
    focus('all'); fireEvent.click(screen.getByText('Debrief actions')); expect(screen.getByLabelText('Visible review panel group').value).toBe('all');
    delete Element.prototype.scrollIntoView;
  });
  it('pauses primary playback and cancels a bounded repeat without changing cursor or reviews', async () => {
    render(<FlightLogReplay />); await sample(); selectPlaybackWindow(2, 3);
    fireEvent.click(screen.getByText('Repeat reviewed window')); expect(screen.getByLabelText('Active selected-window playback')).toBeTruthy();
    focus('source'); expect(screen.queryByLabelText('Active selected-window playback')).toBeNull();
    expect(screen.getByText('Play replay')).toBeTruthy(); expect(screen.getByLabelText('Replay position').value).toBe('2');
    focus('interval'); expect(screen.getByLabelText('Window label').value).toBe('Instructor playback'); expect(screen.getByText('Repeat reviewed window').disabled).toBe(false);
  });
  it('resets focus on source selection but leaves ordinary follow-up edits and failed imports alone', async () => {
    render(<FlightLogReplay />); await sample(); focus('debrief');
    fireEvent.change(screen.getByLabelText('Choose flight CSV'), { target: { files: [{ name: 'invalid.csv', size: 3, arrayBuffer: async () => new TextEncoder().encode('bad').buffer }] } });
    await screen.findByRole('alert'); expect(screen.getByLabelText('Visible review panel group').value).toBe('debrief');
    const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(SAMPLE_LOG)); let releaseHash;
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementationOnce(() => new Promise(resolve => { releaseHash = () => resolve(digest); }));
    const reloading = sample(); await waitFor(() => expect(releaseHash).toBeTypeOf('function'));
    expect(screen.getByText('Load synthetic sample').disabled).toBe(true); expect(screen.getByLabelText('Visible review panel group').value).toBe('debrief');
    releaseHash(); await reloading; expect(screen.getByLabelText('Visible review panel group').value).toBe('all');
  });
});

describe('checked recorded source replacement', () => {
  const candidate = async (csv = SAMPLE_LOG, filename = 'candidate.csv') => {
    fireEvent.change(screen.getByLabelText('Choose flight CSV'), { target: { files: [{ name: filename, size: csv.length, arrayBuffer: async () => new TextEncoder().encode(csv).buffer }] } });
    await screen.findByLabelText('Recorded source replacement preview');
    await waitFor(() => expect(screen.getByText('Replace recorded workspace with checked source').disabled).toBe(false));
  };
  it('keeps current notes, saved copies, dirty window and independent comparison until cancel or confirmation', async () => {
    render(<FlightLogReplay />); await sample();
    fireEvent.change(screen.getByLabelText('Review title'), { target: { value: 'Keep current title' } });
    fireEvent.change(screen.getByLabelText('Analyst notes'), { target: { value: 'PRIVATE unsaved notes' } });
    selectPlaybackWindow(2, 3); fireEvent.click(screen.getByText('Save reviewed window copy to notebook'));
    fireEvent.change(screen.getByLabelText('Window label'), { target: { value: 'UNSAVED window' } });
    fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByLabelText('Comparison time');
    fireEvent.change(screen.getByLabelText('Comparison time'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Replay position'), { target: { value: '8' } });
    await candidate(SAMPLE_LOG.replace('28.61390', '28.61391'));
    expect(screen.getByLabelText('Review title').value).toBe('Keep current title');
    expect(screen.getByLabelText('Analyst notes').value).toBe('PRIVATE unsaved notes');
    expect(screen.getByLabelText('Window label').value).toBe('UNSAVED window');
    expect(screen.getByLabelText('Replay position').value).toBe('8');
    expect(screen.getByLabelText('Comparison time').value).toBe('6');
    expect(screen.getByText('Load saved selection: Instructor playback')).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Keep current recorded workspace'));
    expect(screen.queryByLabelText('Recorded source replacement preview')).toBeNull();
    expect(screen.getByLabelText('Window label').value).toBe('UNSAVED window');
    expect(screen.getByLabelText('Comparison time').value).toBe('6');
    await candidate(SAMPLE_LOG.replace('28.61390', '28.61391'));
    fireEvent.click(screen.getByText('Replace recorded workspace with checked source'));
    expect(screen.getByLabelText('Review title').value).toBe('candidate');
    expect(screen.getByLabelText('Analyst notes').value).toBe('');
    expect(screen.getByLabelText('Window label').value).toBe('');
    expect(screen.getByLabelText('Replay position').value).toBe('0');
    expect(screen.queryByLabelText('Comparison time')).toBeNull();
    expect(screen.queryByText('Load saved selection: Instructor playback')).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  }, 15000);
  it('warns and clears source-bound work even for an identical source, rather than carrying hidden reviews across a new open', async () => {
    render(<FlightLogReplay />); await sample();
    fireEvent.change(screen.getByLabelText('Instructor marker note'), { target: { value: 'PRIVATE old marker' } });
    fireEvent.click(screen.getByText('Add marker at cursor')); selectPlaybackWindow(2, 3);
    await candidate();
    expect(screen.getByLabelText('Recorded source replacement preview').textContent).toContain('fingerprint is identical');
    expect(screen.getByText('PRIVATE old marker')).toBeTruthy();
    fireEvent.click(screen.getByText('Replace recorded workspace with checked source'));
    expect(screen.queryByText('PRIVATE old marker')).toBeNull();
    expect(screen.getByLabelText('Window label').value).toBe('');
  });
  it('does not offer replacement for malformed input and preserves the current source, notes and cursor', async () => {
    render(<FlightLogReplay />); await sample();
    fireEvent.change(screen.getByLabelText('Analyst notes'), { target: { value: 'Preserved' } });
    fireEvent.change(screen.getByLabelText('Replay position'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Choose flight CSV'), { target: { files: [{ name: 'bad.csv', size: 3, arrayBuffer: async () => new TextEncoder().encode('bad').buffer }] } });
    await screen.findByRole('alert');
    expect(screen.queryByLabelText('Recorded source replacement preview')).toBeNull();
    expect(screen.getByLabelText('Analyst notes').value).toBe('Preserved');
    expect(screen.getByLabelText('Replay position').value).toBe('8');
  });
  it('opens the checked candidate bytes, not a later change to the file object', async () => {
    render(<FlightLogReplay />); await sample(); let text = SAMPLE_LOG.replace('28.61390', '28.61391');
    const file = { name: 'checked.csv', size: text.length, arrayBuffer: async () => new TextEncoder().encode(text).buffer };
    fireEvent.change(screen.getByLabelText('Choose flight CSV'), { target: { files: [file] } });
    await screen.findByLabelText('Recorded source replacement preview');
    text = 'bad'; fireEvent.click(screen.getByText('Replace recorded workspace with checked source'));
    expect(screen.getByLabelText('Current recorded observation').textContent).toContain('28.61391');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

it('checks archive bytes before proposing an open and cancel never changes the current source or writes a record', async () => {
  render(<FlightLogReplay />); await sample();
  fireEvent.change(screen.getByLabelText('Analyst notes'), { target: { value: 'Keep current analyst context' } });
  globalThis.fetch.mockResolvedValueOnce(response([saved])).mockResolvedValueOnce(response(saved));
  fireEvent.click(screen.getByText('Refresh server archive')); await screen.findByText('Saved training');
  fireEvent.click(screen.getByText('Saved training')); await screen.findByLabelText('Recorded source replacement preview');
  expect(screen.getByLabelText('Review title').value).toBe('synthetic-training-sample');
  expect(screen.getByLabelText('Analyst notes').value).toBe('Keep current analyst context');
  fireEvent.click(screen.getByText('Keep current recorded workspace'));
  expect(screen.getByLabelText('Analyst notes').value).toBe('Keep current analyst context');
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  for (const call of globalThis.fetch.mock.calls) expect(call[1]?.method).toBeUndefined();
  globalThis.fetch.mockResolvedValueOnce(response(saved));
  fireEvent.click(screen.getByText('Saved training')); await screen.findByLabelText('Recorded source replacement preview');
  fireEvent.click(screen.getByText('Replace recorded workspace with checked source'));
  expect(screen.getByLabelText('Review title').value).toBe('Saved training');
  expect(screen.getByLabelText('Analyst notes').value).toBe('Fixed notes');
  expect(screen.getByText('Save to server').disabled).toBe(true);
  expect(globalThis.fetch).toHaveBeenCalledTimes(3);
});

describe('source-open exit guard integration', () => {
  it('does not guard an empty workspace and unregisters the loaded-source browser warning on unmount', async () => {
    const onBack = vi.fn(); const view = render(<FlightLogReplay onBack={onBack} />);
    const empty = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(empty); expect(empty.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByText('Back to Scenario Lab')); expect(onBack).toHaveBeenCalledOnce(); await sample();
    const loaded = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(loaded); expect(loaded.defaultPrevented).toBe(true);
    expect(useUIStore.getState().recordedSourceOpen).toBe(true); view.unmount(); expect(useUIStore.getState().recordedSourceOpen).toBe(false);
    const gone = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(gone); expect(gone.defaultPrevented).toBe(false);
  });
  it('keeps analyst/window drafts, comparison and current source after cancelled view/workspace/back requests', async () => {
    const onBack = vi.fn(); render(<FlightLogReplay onBack={onBack} />); await sample();
    fireEvent.change(screen.getByLabelText('Analyst notes'), { target: { value: 'Keep private notes' } });
    fireEvent.change(screen.getByLabelText('Window label'), { target: { value: 'Keep unsaved label' } });
    fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByLabelText('Comparison time');
    fireEvent.change(screen.getByLabelText('Comparison time'), { target: { value: '6' } });
    for (const request of [() => useUIStore.getState().setActiveView('map'), () => useUIStore.getState().setWorkspace('analyst'), () => useUIStore.getState().requestRecordedBack()]) {
      act(request); expect(useUIStore.getState().activeView).toBe('scenario'); expect(useUIStore.getState().workspace).toBe('operator');
      expect(screen.getByRole('heading', { name: 'Keep or leave this recorded workspace?' })).toBe(document.activeElement);
      fireEvent.click(screen.getByText('Keep recorded workspace open'));
      expect(screen.getByLabelText('Analyst notes').value).toBe('Keep private notes'); expect(screen.getByLabelText('Window label').value).toBe('Keep unsaved label'); expect(screen.getByLabelText('Comparison time').value).toBe('6');
      expect(screen.queryByLabelText('Leave recorded workspace preview')).toBeNull(); expect(onBack).not.toHaveBeenCalled();
    }
  });
  it('pauses only primary replay on a pending exit and clears stale exit proposals on source open', async () => {
    render(<FlightLogReplay />); await sample(); fireEvent.click(screen.getByText('Play replay'));
    act(() => useUIStore.getState().setActiveView('telemetry')); expect(screen.getByText('Play replay')).toBeTruthy();
    await sample(); expect(screen.queryByLabelText('Leave recorded workspace preview')).toBeNull(); expect(useUIStore.getState().activeView).toBe('scenario');
  });
});

it('paired open is atomic on cancel and resets stale primary-case preview only after confirmation, including identical sources', async () => {
  render(<FlightLogReplay />); await sample();
  const log = { ...saved, samples: parseFlightCSV(SAMPLE_LOG) }, primary = { log, review: { title: 'Paired checked title', notes: 'Paired checked notes' }, debrief: { markers: [], notes: '' }, envelope: null };
  const text = await createPairedReviewBundle(primary, { baseline: log, notes: 'Paired B notes', alignment: null });
  const upload = (label, contents) => fireEvent.change(screen.getByLabelText(label), { target: { files: [{ size: contents.length, arrayBuffer: async () => new TextEncoder().encode(contents).buffer }] } });
  upload('Open review case JSON', JSON.stringify(JSON.parse(text).primary_case)); await screen.findByText('Replace local workspace with case');
  fireEvent.change(screen.getByLabelText('Analyst notes'), { target: { value: 'Keep latest notes' } });
  upload('Open paired review bundle JSON', text); await screen.findByLabelText('Paired review bundle preview'); fireEvent.click(screen.getByText('Keep current workspace and sources'));
  expect(screen.getByLabelText('Analyst notes').value).toBe('Keep latest notes'); expect(screen.getByText('Replace local workspace with case')).toBeTruthy(); expect(screen.queryByLabelText('Comparison time')).toBeNull();
  upload('Open paired review bundle JSON', text); await screen.findByLabelText('Paired review bundle preview'); fireEvent.click(screen.getByText('Replace workspace with checked paired review'));
  expect(screen.queryByText('Replace local workspace with case')).toBeNull(); expect(screen.getByLabelText('Review title').value).toBe('Paired checked title'); expect(screen.getByLabelText('Analyst notes').value).toBe('Paired checked notes'); expect(screen.getByLabelText('Comparison notes').value).toBe('Paired B notes'); expect(screen.getByLabelText('Comparison time').value).toBe('0'); expect(screen.getByLabelText('Replay position').value).toBe('0'); expect(globalThis.fetch).not.toHaveBeenCalled();
});
