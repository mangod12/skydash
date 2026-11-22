// @vitest-environment jsdom
import { createRef } from 'react';
import { TextEncoder, TextDecoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const load = async () => { fireEvent.click(screen.getByText('Load synthetic baseline')); await waitFor(() => expect(screen.getByText('Load synthetic baseline').disabled).toBe(false)); if (screen.queryByText('Replace baseline with checked source')) fireEvent.click(screen.getByText('Replace baseline with checked source')); await screen.findByText(/Baseline B loaded locally/); await screen.findByLabelText('Comparison time'); };
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
    expect(within(screen.getByLabelText('Paired recorded observations')).getByText(/OUTSIDE SOURCE/)).toBeTruthy(); expect(screen.queryByText('B 10s')).toBeNull(); expect(screen.getByText('A 12s')).toBeTruthy();
    fireEvent.click(screen.getByText('Reset comparison')); expect(screen.getByLabelText('Comparison time').value).toBe('0');
  });
  it('imports an actual second file and warns if the source is identical', async () => {
    render(<FlightComparison primary={primary} />);
    fireEvent.change(screen.getByLabelText('Choose baseline CSV'), { target: { files: [file(SAMPLE_LOG)] } }); if (screen.queryByLabelText('Comparison time')) fireEvent.click(await screen.findByText('Replace baseline with checked source')); await screen.findByLabelText('Comparison time');
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

describe('manual comparison anchor controls', () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText('A anchor data row'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('B anchor data row'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Review anchor label'), { target: { value: 'Selected discussion samples' } });
  };
  it('requires explicit apply, shows source-time anchors and preserves comparison notes', async () => {
    render(<FlightComparison primary={primary} />); await load(); fireEvent.change(screen.getByLabelText('Comparison notes'), { target: { value: 'Keep context' } }); fill();
    expect(screen.getByLabelText('Applied comparison alignment').textContent).toContain('CSV starts');
    expect(screen.getByText('Download comparison report').disabled).toBe(true); expect(screen.getByText('Play comparison').disabled).toBe(true);
    fireEvent.click(screen.getByText('Apply manual sample anchors'));
    expect(screen.getByLabelText('Applied comparison alignment').textContent).toContain('A row 4 at 12s; B row 3 at 4s');
    expect(screen.getByText('A 12s')).toBeTruthy(); expect(screen.getByText('B 4s')).toBeTruthy(); expect(screen.getByLabelText('Comparison time').min).toBe('-12'); expect(screen.getByLabelText('Comparison time').max).toBe('6');
    expect(screen.getByLabelText('Comparison notes').value).toBe('Keep context'); expect(screen.getByText('Download comparison report').disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Comparison time'), { target: { value: '-6' } }); expect(within(screen.getByLabelText('Paired recorded observations')).getByText(/OUTSIDE SOURCE/)).toBeTruthy(); expect(screen.getByText(/DATA GAP/)).toBeTruthy();
    fireEvent.click(screen.getByText('Reset comparison')); expect(screen.getByLabelText('Comparison time').value).toBe('0'); expect(screen.getByText('A 12s')).toBeTruthy(); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('keeps the applied alignment on invalid row/label and discards uncommitted edits', async () => {
    render(<FlightComparison primary={primary} />); await load(); fill(); fireEvent.click(screen.getByText('Apply manual sample anchors'));
    fireEvent.change(screen.getByLabelText('A anchor data row'), { target: { value: '999' } }); fireEvent.click(screen.getByText('Apply manual sample anchors'));
    expect(screen.getByRole('alert').textContent).toContain('existing sample row'); expect(screen.getByLabelText('Applied comparison alignment').textContent).toContain('A row 4'); expect(screen.getByText('Download comparison report').disabled).toBe(true);
    fireEvent.click(screen.getByText('Discard anchor edits')); expect(screen.getByLabelText('A anchor data row').value).toBe('4'); expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByText('Download comparison report').disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Review anchor label'), { target: { value: '' } }); fireEvent.click(screen.getByText('Apply manual sample anchors')); expect(screen.getByRole('alert').textContent).toContain('review anchor label');
  });
  it('exports applied anchors and resets them when CSV starts or a new baseline is selected', async () => {
    render(<FlightComparison primary={primary} />); await load(); fill(); fireEvent.click(screen.getByText('Apply manual sample anchors')); fireEvent.click(screen.getByText('Download comparison report'));
    const blob = URL.createObjectURL.mock.calls[0][0]; const text = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); }); expect(text).toContain('A CSV data row 4 at 12s; B CSV data row 3 at 4s'); expect(text).toContain('Selected discussion samples');
    fireEvent.click(screen.getByText('Use CSV starts')); expect(screen.getByLabelText('Comparison time').min).toBe('0'); expect(screen.getByLabelText('Comparison time').max).toBe('16'); expect(screen.getByLabelText('Review anchor label').value).toBe('');
    fill(); fireEvent.click(screen.getByText('Apply manual sample anchors')); await load(); expect(screen.getByLabelText('Applied comparison alignment').textContent).toContain('CSV starts'); expect(screen.getByLabelText('A anchor data row').value).toBe('1');
  });
});

describe('portable comparison review controls', () => {
  const reviewFile = text => ({ name: 'comparison.json', size: text.length, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
  const contents = async () => {
    const { createComparisonReview } = await import('../../utils/comparisonReview');
    const baseline = { ...primary, title: 'Restored baseline', filename: 'restored.csv' };
    return createComparisonReview(primary, baseline, 'Preserved review notes', { primaryIndex: 3, baselineIndex: 1, label: 'Manual discussion association' });
  };
  it('can import before a baseline exists, previews only and cancels without changing comparison', async () => {
    render(<FlightComparison primary={primary} />); expect(screen.getByText('Download comparison review JSON').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Import comparison review JSON'), { target: { files: [reviewFile(await contents())] } }); await screen.findByText('Preview comparison review: Restored baseline');
    expect(screen.queryByLabelText('Comparison time')).toBeNull(); fireEvent.click(screen.getByText('Keep current comparison')); expect(screen.queryByLabelText('Comparison time')).toBeNull(); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('confirms a validated source-bound baseline, notes and anchors while leaving primary intact', async () => {
    render(<FlightComparison primary={primary} />); await load(); fireEvent.change(screen.getByLabelText('Comparison notes'), { target: { value: 'Old notes' } });
    fireEvent.change(screen.getByLabelText('Import comparison review JSON'), { target: { files: [reviewFile(await contents())] } }); await screen.findByText('Preview comparison review: Restored baseline');
    expect(screen.getByLabelText('Comparison notes').value).toBe('Old notes'); expect(screen.getByText('Download comparison report').disabled).toBe(true);
    fireEvent.click(screen.getByText('Replace comparison with imported review')); expect(screen.getByLabelText('Comparison notes').value).toBe('Preserved review notes'); expect(screen.getByText(/B \/ restored.csv/)).toBeTruthy(); expect(screen.getByLabelText('Applied comparison alignment').textContent).toContain('A row 4 at 12s; B row 2 at 2s'); expect(screen.getByLabelText('Comparison time').value).toBe('0'); expect(primary.filename).toBe('primary.csv'); expect(primary.samples[3].time_s).toBe(12);
  });
  it('rejects mismatched/oversize imports and preserves last good pair and notes', async () => {
    render(<FlightComparison primary={primary} />); await load(); fireEvent.change(screen.getByLabelText('Comparison notes'), { target: { value: 'Keep notes' } }); const data = JSON.parse(await contents()); data.primary_sha256 = 'a'.repeat(64);
    fireEvent.change(screen.getByLabelText('Import comparison review JSON'), { target: { files: [reviewFile(JSON.stringify(data))] } }); await screen.findByRole('alert'); expect(screen.getByRole('alert').textContent).toContain('Primary fingerprint mismatch'); expect(screen.getByLabelText('Comparison notes').value).toBe('Keep notes'); expect(screen.getByText(/B \/ synthetic-baseline.csv/)).toBeTruthy();
    const arrayBuffer = vi.fn(); fireEvent.change(screen.getByLabelText('Import comparison review JSON'), { target: { files: [{ size: 2097153, arrayBuffer }] } }); await screen.findByText(/at most 2MiB/); expect(arrayBuffer).not.toHaveBeenCalled();
  });
  it('exports validated comparison state and blocks a dirty-anchor export', async () => {
    render(<FlightComparison primary={primary} />); await load(); fireEvent.change(screen.getByLabelText('Comparison notes'), { target: { value: 'Export notes' } }); fireEvent.click(screen.getByText('Download comparison review JSON')); await screen.findByText(/Comparison JSON download requested/);
    const blob = URL.createObjectURL.mock.calls[0][0]; const text = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); }); const data = JSON.parse(text); expect(data.primary_sha256).toBe(primary.sha256); expect(data.notes).toBe('Export notes'); expect(data.alignment).toBeNull(); expect(data.baseline.csv_text).toContain('time_s,latitude'); expect(data).not.toHaveProperty('primary_csv');
    fireEvent.change(screen.getByLabelText('Review anchor label'), { target: { value: 'Pending' } }); expect(screen.getByText('Download comparison review JSON').disabled).toBe(true); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

it('starts basemap off and resets permission on new baseline, imported review or clearing', async () => {
  render(<FlightComparison primary={primary} />); await load(); const label = 'Allow external basemap for two-flight comparison'; expect(screen.getByLabelText(label).checked).toBe(false);
  fireEvent.click(screen.getByLabelText(label)); expect(screen.getByLabelText(label).checked).toBe(true); await load(); expect(screen.getByLabelText(label).checked).toBe(false);
  fireEvent.click(screen.getByLabelText(label)); const { createComparisonReview } = await import('../../utils/comparisonReview'); const contents = await createComparisonReview(primary, primary);
  fireEvent.change(screen.getByLabelText('Import comparison review JSON'), { target: { files: [{ name:'review.json', size:contents.length, arrayBuffer:async()=>new TextEncoder().encode(contents).buffer }] } }); await screen.findByText('Preview comparison review: Primary test'); expect(screen.getByLabelText(label).checked).toBe(true); fireEvent.click(screen.getByText('Replace comparison with imported review')); expect(screen.getByLabelText(label).checked).toBe(false);
  fireEvent.click(screen.getByLabelText(label)); fireEvent.click(screen.getByText('Clear comparison')); await load(); expect(screen.getByLabelText(label).checked).toBe(false);
});

describe('checked baseline replacement', () => {
  it('keeps notes, applied alignment, unfinished anchor edits, cursor and basemap on cancel even for identical source', async () => {
    render(<FlightComparison primary={primary} />); await load();
    fireEvent.change(screen.getByLabelText('Comparison notes'), { target: { value: 'PRIVATE current notes' } });
    fireEvent.change(screen.getByLabelText('A anchor data row'), { target: { value: '4' } }); fireEvent.change(screen.getByLabelText('B anchor data row'), { target: { value: '3' } }); fireEvent.change(screen.getByLabelText('Review anchor label'), { target: { value: 'Current applied anchors' } }); fireEvent.click(screen.getByText('Apply manual sample anchors'));
    fireEvent.change(screen.getByLabelText('Comparison time'), { target: { value: '2' } }); fireEvent.click(screen.getByLabelText('Allow external basemap for two-flight comparison'));
    fireEvent.change(screen.getByLabelText('Review anchor label'), { target: { value: 'PRIVATE unfinished anchors' } });
    fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByText(/fingerprint is identical/);
    expect(screen.getByRole('heading', { name: 'Baseline checked locally. Current comparison not replaced.' })).toBe(document.activeElement);
    fireEvent.click(screen.getByText('Keep current baseline and comparison'));
    expect(screen.getByLabelText('Comparison notes').value).toBe('PRIVATE current notes'); expect(screen.getByLabelText('Comparison time').value).toBe('2'); expect(screen.getByLabelText('Review anchor label').value).toBe('PRIVATE unfinished anchors'); expect(screen.getByLabelText('Applied comparison alignment').textContent).toContain('Current applied anchors'); expect(screen.getByLabelText('Allow external basemap for two-flight comparison').checked).toBe(true); expect(screen.getByText('Download comparison review JSON').disabled).toBe(true); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('confirms checked bytes only and clears comparison notes/anchors/permission even with identical source', async () => {
    render(<FlightComparison primary={primary} />); await load(); fireEvent.change(screen.getByLabelText('Comparison notes'), { target: { value: 'discarded notes' } }); fireEvent.change(screen.getByLabelText('Review anchor label'), { target: { value: 'unfinished anchors' } }); fireEvent.click(screen.getByLabelText('Allow external basemap for two-flight comparison'));
    fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByText(/fingerprint is identical/); fireEvent.click(screen.getByText('Replace baseline with checked source'));
    expect(screen.getByLabelText('Comparison notes').value).toBe(''); expect(screen.getByLabelText('Comparison time').value).toBe('0'); expect(screen.getByLabelText('Review anchor label').value).toBe(''); expect(screen.getByLabelText('Allow external basemap for two-flight comparison').checked).toBe(false); expect(screen.getByLabelText('Applied comparison alignment').textContent).toContain('CSV starts'); expect(screen.queryByLabelText('Recorded baseline replacement preview')).toBeNull(); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('invalid second check drops only its old proposal, while clear and imported review discard proposals', async () => {
    render(<FlightComparison primary={primary} />); await load(); fireEvent.change(screen.getByLabelText('Comparison notes'), { target: { value: 'Kept' } }); fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByLabelText('Recorded baseline replacement preview');
    fireEvent.change(screen.getByLabelText('Choose baseline CSV'), { target: { files: [file('bad')] } }); await screen.findByRole('alert'); expect(screen.queryByLabelText('Recorded baseline replacement preview')).toBeNull(); expect(screen.getByLabelText('Comparison notes').value).toBe('Kept');
    fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByLabelText('Recorded baseline replacement preview');
    const { createComparisonReview } = await import('../../utils/comparisonReview'); const contents = await createComparisonReview(primary, primary, 'Imported comparison');
    fireEvent.change(screen.getByLabelText('Import comparison review JSON'), { target: { files: [{ name: 'review.json', size: contents.length, arrayBuffer: async () => new TextEncoder().encode(contents).buffer }] } }); await screen.findByText('Preview comparison review: Primary test'); expect(screen.queryByLabelText('Recorded baseline replacement preview')).toBeNull(); expect(screen.getByLabelText('Comparison notes').value).toBe('Kept');
    fireEvent.click(screen.getByText('Keep current comparison')); fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByLabelText('Recorded baseline replacement preview'); fireEvent.click(screen.getByText('Clear comparison')); expect(screen.queryByLabelText('Recorded baseline replacement preview')).toBeNull(); expect(screen.queryByLabelText('Comparison time')).toBeNull();
  });
  it('checks a different baseline once and opens the in-memory candidate only after confirmation', async () => {
    render(<FlightComparison primary={primary} />); await load(); const arrayBuffer = vi.fn(async () => new TextEncoder().encode(SAMPLE_LOG).buffer);
    fireEvent.change(screen.getByLabelText('Choose baseline CSV'), { target: { files: [{ name: 'different.csv', size: SAMPLE_LOG.length, arrayBuffer }] } }); await screen.findByText(/fingerprint differs/); expect(screen.getByText(/B \/ synthetic-baseline.csv/)).toBeTruthy(); expect(arrayBuffer).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Replace baseline with checked source')); expect(screen.getByText(/B \/ different.csv/)).toBeTruthy(); expect(arrayBuffer).toHaveBeenCalledOnce(); expect(primary.csv_text).toBe(SAMPLE_LOG);
  });
});

it('initializes a checked paired comparison at zero and exposes only applied state through a guarded snapshot', async () => {
  const ref = createRef(); const seed = { baseline: primary, notes: 'Imported paired comparison', alignment: { primaryIndex: 3, baselineIndex: 2, label: 'Applied pair' } }; render(<FlightComparison ref={ref} primary={primary} openedReview={seed} />);
  expect(screen.getByLabelText('Comparison notes').value).toBe('Imported paired comparison'); expect(screen.getByLabelText('Comparison time').value).toBe('0'); expect(screen.getByLabelText('Applied comparison alignment').textContent).toContain('Applied pair'); expect(ref.current.snapshot()).toEqual(seed);
  fireEvent.change(screen.getByLabelText('Review anchor label'), { target: { value: 'unfinished' } }); expect(() => ref.current.snapshot()).toThrow(/anchor edits/); fireEvent.click(screen.getByText('Discard anchor edits')); fireEvent.click(screen.getByText('Load synthetic baseline')); await screen.findByLabelText('Recorded baseline replacement preview'); expect(() => ref.current.snapshot()).toThrow(/replacement/);
});

it('a custom B mapper slot preserves the checked baseline replacement boundary and comparison notes until its separate confirmation',async()=>{const seen=[];function Mapper(props){seen.push(props);return <button onClick={()=>props.onOpen({filename:'slot-mapped.csv',csv_text:SAMPLE_LOG})}>Submit checked numeric B fixture</button>;}render(<FlightComparison primary={primary} ColumnMapper={Mapper}/>);expect(Object.keys(seen.at(-1)).sort()).toEqual(['destination','onOpen','onPause','workspaceBusy']);expect(seen.at(-1).destination).toBe('baseline');expect(screen.queryByLabelText('Comparison time')).toBeNull();await load();fireEvent.change(screen.getByLabelText('Comparison notes'),{target:{value:'Keep until checked replacement'}});fireEvent.change(screen.getByLabelText('Comparison time'),{target:{value:'6'}});fireEvent.click(screen.getByText('Submit checked numeric B fixture'));await screen.findByText('Replace baseline with checked source');expect(screen.getByLabelText('Comparison notes').value).toBe('Keep until checked replacement');expect(screen.getByLabelText('Comparison time').value).toBe('6');fireEvent.click(screen.getByText('Replace baseline with checked source'));expect(screen.getByLabelText('Comparison notes').value).toBe('');expect(screen.getByLabelText('Comparison time').value).toBe('0');expect(globalThis.fetch).not.toHaveBeenCalled();});
