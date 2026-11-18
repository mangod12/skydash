// @vitest-environment jsdom
import { TextEncoder, TextDecoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FlightComparison from './FlightComparison';
import { SAMPLE_LOG, LOG_VERSION, parseFlightCSV, flightCSVHash } from '../../utils/flightLog';
vi.mock('react-leaflet', () => ({ MapContainer: ({ children }) => <div>{children}</div>, TileLayer: () => null, Polyline: () => null, CircleMarker: ({ children }) => <div>{children}</div>, Tooltip: ({ children }) => <span>{children}</span>, useMap: () => ({ fitBounds: vi.fn() }) }));
let primary;
beforeEach(async () => {
  vi.stubGlobal('TextEncoder', TextEncoder); vi.stubGlobal('TextDecoder', TextDecoder); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('fetch', vi.fn());
  URL.createObjectURL = vi.fn(() => 'blob:comparison'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  primary = { title: 'Primary test', filename: 'primary.csv', sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, csv_text: SAMPLE_LOG, samples: parseFlightCSV(SAMPLE_LOG) };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const load = async () => { fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByLabelText('Comparison time'); };
const file = text => ({ name: 'second.csv', size: text.length, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
describe('two-flight local comparison workflow', () => {
  it('requires a baseline, stays local, compares gaps and shorter-source boundaries explicitly', async () => {
    render(<FlightComparison primary={primary} />); expect(screen.queryByLabelText('Comparison time')).toBeNull(); await load();
    expect(screen.getByLabelText('Paired recorded observations').textContent).toContain('PRIMARY A'); expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Instantaneous observation deltas').textContent).toContain('+2.0m');
    fireEvent.change(screen.getByLabelText('Comparison time'), { target: { value: '8' } });
    expect(screen.getByText(/DATA GAP/)).toBeTruthy(); expect(screen.getByLabelText('Instantaneous observation deltas').textContent).toContain('altitude unknown');
    expect(screen.getByText('A 4s')).toBeTruthy(); expect(screen.getByText('B 8s')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Comparison time'), { target: { value: '12' } });
    expect(screen.getByText(/OUTSIDE SOURCE/)).toBeTruthy(); expect(screen.queryByText('B 10s')).toBeNull(); expect(screen.getByText('A 12s')).toBeTruthy();
    fireEvent.click(screen.getByText('Reset comparison')); expect(screen.getByLabelText('Comparison time').value).toBe('0');
  });
  it('imports an actual second file and warns if the source is identical', async () => {
    render(<FlightComparison primary={primary} />);
    fireEvent.change(screen.getByLabelText('Choose baseline CSV'), { target: { files: [file(SAMPLE_LOG)] } }); await screen.findByLabelText('Comparison time');
    expect(screen.getByRole('alert').textContent).toContain('IDENTICAL SOURCE CHECKSUMS'); expect(screen.getByText(/B \/ second.csv/)).toBeTruthy(); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('keeps the last good comparison and notes if the next baseline fails validation', async () => {
    render(<FlightComparison primary={primary} />); await load(); fireEvent.change(screen.getByLabelText('Comparison notes'), { target: { value: 'Keep draft' } });
    fireEvent.change(screen.getByLabelText('Choose baseline CSV'), { target: { files: [file('bad CSV')] } }); await screen.findByRole('alert');
    expect(screen.getByLabelText('Comparison notes').value).toBe('Keep draft'); expect(screen.getByText(/B \/ synthetic-baseline.csv/)).toBeTruthy();
  });
  it('rejects oversized files without reading or replacing a baseline', async () => {
    render(<FlightComparison primary={primary} />); await load(); const arrayBuffer = vi.fn();
    fireEvent.change(screen.getByLabelText('Choose baseline CSV'), { target: { files: [{ name: 'large.csv', size: 1048577, arrayBuffer }] } }); await screen.findByRole('alert');
    expect(arrayBuffer).not.toHaveBeenCalled(); expect(screen.getByLabelText('Comparison time')).toBeTruthy();
  });
  it('resets comparison notes and cursor when a valid new baseline is chosen', async () => {
    render(<FlightComparison primary={primary} />); await load(); fireEvent.change(screen.getByLabelText('Comparison notes'), { target: { value: 'Old notes' } });
    fireEvent.change(screen.getByLabelText('Comparison time'), { target: { value: '8' } }); await load();
    expect(screen.getByLabelText('Comparison notes').value).toBe(''); expect(screen.getByLabelText('Comparison time').value).toBe('0');
  });
  it('exports the comparison with both fingerprints and analyst notes, plus exact baseline bytes', async () => {
    render(<FlightComparison primary={primary} />); await load(); fireEvent.change(screen.getByLabelText('Comparison notes'), { target: { value: 'Compare only compatible exercises.' } });
    fireEvent.click(screen.getByText('Download comparison report')); expect(URL.createObjectURL).toHaveBeenCalledOnce();
    const blob = URL.createObjectURL.mock.calls[0][0]; const text = await new Promise(resolve => { const reader = new globalThis.FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
    expect(text).toContain(primary.sha256); expect(text).toContain('synthetic-baseline.csv'); expect(text).toContain('Compare only compatible exercises.'); expect(text).toContain('not UTC');
    fireEvent.click(screen.getByText('Download baseline CSV')); expect(URL.createObjectURL).toHaveBeenCalledTimes(2); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('shows a numeric whole-log A-B table without rating either flight', async () => {
    render(<FlightComparison primary={primary} />); await load(); const table = within(screen.getByRole('table', { name: 'Whole-log metric comparison' }));
    expect(table.getByText('+6.0s')).toBeTruthy(); expect(table.getByText('16.0s')).toBeTruthy(); expect(table.getByText('10.0s')).toBeTruthy(); expect(table.getByText(/not better\/worse/)).toBeTruthy();
  });
  it('plays a shared cursor, pauses on manual seek and stops at the final source', async () => {
    render(<FlightComparison primary={primary} />); await load(); vi.useFakeTimers();
    fireEvent.click(screen.getByText('Play comparison')); await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(Number(screen.getByLabelText('Comparison time').value)).toBeGreaterThan(0); fireEvent.click(screen.getByText('Pause comparison'));
    fireEvent.change(screen.getByLabelText('Comparison time'), { target: { value: '16' } }); expect(screen.getByText('Play comparison').disabled).toBe(true);
    fireEvent.click(screen.getByText('Reset comparison')); expect(screen.getByLabelText('Comparison time').value).toBe('0');
  });
  it('clears only the comparison and reports download errors without losing sources', async () => {
    render(<FlightComparison primary={primary} />); await load(); URL.createObjectURL.mockImplementationOnce(() => { throw Error('blocked'); }); fireEvent.click(screen.getByText('Download comparison report'));
    expect(screen.getByRole('alert').textContent).toContain('could not start'); expect(screen.getByLabelText('Comparison time')).toBeTruthy();
    fireEvent.click(screen.getByText('Clear comparison')); expect(screen.queryByLabelText('Comparison time')).toBeNull(); expect(screen.getByText(/Primary A is unchanged/)).toBeTruthy();
  });
});
