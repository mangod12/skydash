// @vitest-environment jsdom
import { TextEncoder, TextDecoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FlightLogReplay from './FlightLogReplay';
import { SAMPLE_LOG, LOG_VERSION, flightCSVHash } from '../../utils/flightLog';
import { useAuthStore } from '../../stores/authStore';
vi.mock('react-leaflet', () => ({ MapContainer: ({ children }) => <div>{children}</div>, TileLayer: () => null, Polyline: () => null, CircleMarker: ({ children }) => <div>{children}</div>, Tooltip: ({ children }) => <span>{children}</span>, useMap: () => ({ fitBounds: vi.fn() }) }));
vi.mock('../../utils/api', () => ({ apiFetch: (...args) => globalThis.fetch(...args) }));
const response = (data, ok = true) => ({ ok, json: async () => ok ? { success: true, data } : { detail: data } });
let saved;
beforeEach(async () => {
  vi.stubGlobal('TextEncoder', TextEncoder); vi.stubGlobal('TextDecoder', TextDecoder); vi.stubGlobal('crypto', webcrypto);
  URL.createObjectURL = vi.fn(() => 'blob:flight'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  useAuthStore.setState({ authEnabled: false, user: null });
  saved = { id: 'saved-1', title: 'Saved training', filename: 'source.csv', notes: 'Fixed notes', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, sample_count: 6, duration_s: 16, created_at: '2026-11-18T12:00:00Z' };
  vi.stubGlobal('fetch', vi.fn(async () => response([])));
});
afterEach(() => { vi.useRealTimers(); cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const sample = async () => { fireEvent.click(screen.getByText('Load synthetic sample')); await screen.findByLabelText('Current recorded observation'); };
const refreshAndOpen = async () => {
  globalThis.fetch.mockResolvedValueOnce(response([saved])).mockResolvedValueOnce(response(saved));
  fireEvent.click(screen.getByText('Refresh server archive')); await screen.findByText('Saved training');
  fireEvent.click(screen.getByText('Saved training')); await screen.findByText(/checksum verified/);
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
    await screen.findByText(/Source: different.csv/); expect(screen.queryByLabelText('Comparison time')).toBeNull();
  });
  it('clears source-bound instructor markers when a different primary CSV loads', async () => {
    render(<FlightLogReplay />); await sample(); fireEvent.change(screen.getByLabelText('Instructor marker note'), { target: { value: 'Old source marker' } }); fireEvent.click(screen.getByText('Add marker at cursor')); expect(screen.getByLabelText('Instructor review markers').textContent).toContain('Old source marker');
    const changed = SAMPLE_LOG.replace('28.61390', '28.61391'); fireEvent.change(screen.getByLabelText('Choose flight CSV'), { target: { files: [{ name: 'different.csv', size: changed.length, arrayBuffer: async () => new TextEncoder().encode(changed).buffer }] } });
    await screen.findByText(/Source: different.csv/); expect(screen.queryByText('Old source marker')).toBeNull();
  });
  it('reports download errors and returns to the lab', async () => {
    const onBack = vi.fn(); render(<FlightLogReplay onBack={onBack} />); await sample();
    URL.createObjectURL.mockImplementationOnce(() => { throw Error('blocked'); }); fireEvent.click(screen.getByText('Download source CSV'));
    expect(screen.getByRole('alert').textContent).toContain('Download could not start'); fireEvent.click(screen.getByText('Back to Scenario Lab')); expect(onBack).toHaveBeenCalledOnce();
  });
});

it('keeps primary and comparison background permission separate, resets primary on source load', async () => {
  render(<FlightLogReplay />); await sample(); const primary = screen.getByLabelText('Allow external basemap for primary replay'); expect(primary.checked).toBe(false);
  fireEvent.click(primary); expect(primary.checked).toBe(true); fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByLabelText('Comparison time');
  const comparison = screen.getByLabelText('Allow external basemap for two-flight comparison'); expect(comparison.checked).toBe(false); fireEvent.click(comparison); expect(comparison.checked).toBe(true); expect(primary.checked).toBe(true);
  await sample(); expect(screen.getByLabelText('Allow external basemap for primary replay').checked).toBe(false); expect(globalThis.fetch).not.toHaveBeenCalled();
});
