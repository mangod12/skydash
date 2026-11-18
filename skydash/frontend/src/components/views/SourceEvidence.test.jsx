// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SourceEvidence from './SourceEvidence';
import { LOG_VERSION, LOG_HEADER, SAMPLE_LOG, parseFlightCSV } from '../../utils/flightLog';
const log = { filename: 'source.csv', model_version: LOG_VERSION, sha256: 'a'.repeat(64), samples: parseFlightCSV(SAMPLE_LOG) };
const onSeek = vi.fn();
const blobText = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn()); URL.createObjectURL = vi.fn(() => 'blob:evidence'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('source evidence browser-local review', () => {
  it('shows observed interval summaries, unknown evidence and exact gap-endpoint seeks', () => {
    render(<SourceEvidence log={log} onSeek={onSeek} />); expect(screen.getByText('Max interval').parentElement.textContent).toContain('8s'); expect(screen.getByLabelText('Source channel evidence').textContent).toContain('Source altitude: known 5/6, missing 1'); expect(screen.getByLabelText('Source evidence groups').textContent).toContain('Rows 3 to 4: 4s to 12s'); fireEvent.click(screen.getByText('Jump to row 3 at 4s')); expect(onSeek).toHaveBeenLastCalledWith(4); fireEvent.click(screen.getByText('Jump to row 4 at 12s')); expect(onSeek).toHaveBeenLastCalledWith(12); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('switches to missing-row groups without treating zero as missing or creating outage durations', () => {
    render(<SourceEvidence log={log} onSeek={onSeek} />); fireEvent.change(screen.getByLabelText('Evidence group'), { target: { value: 'battery_pct' } }); expect(screen.getByLabelText('Source evidence groups').textContent).toContain('Rows 4 to 4: 12s to 12s'); expect(screen.getByText('1 consecutive missing cells. Timestamp span is not outage duration.')).toBeTruthy(); fireEvent.click(screen.getByText('Jump to row 4 at 12s')); expect(onSeek).toHaveBeenCalledWith(12); fireEvent.change(screen.getByLabelText('Evidence group'), { target: { value: 'ground_speed_m_s' } }); expect(screen.getByText(/No groups in this category/)).toBeTruthy();
  });
  it('paginates bounded evidence groups, resets on category change and exports every group', async () => {
    const many = { ...log, samples: parseFlightCSV(`${LOG_HEADER}\n${Array.from({ length: 30 }, (_, index) => `${index * 6},0,0,,,`).join('\n')}\n`) };
    render(<SourceEvidence log={many} onSeek={onSeek} />); const list = within(screen.getByLabelText('Source evidence groups')); expect(list.getAllByRole('listitem')).toHaveLength(12); expect(screen.getByText('Previous evidence page').disabled).toBe(true); fireEvent.click(screen.getByText('Next evidence page')); expect(screen.getByText(/Page 2\/3/)).toBeTruthy(); fireEvent.click(screen.getByText('Next evidence page')); expect(list.getAllByRole('listitem')).toHaveLength(5); expect(screen.getByText('Next evidence page').disabled).toBe(true); fireEvent.click(screen.getByText('Download source evidence report')); const report = await blobText(URL.createObjectURL.mock.calls[0][0]); expect(report).toContain('Rows 1 to 2: 0s to 6s'); expect(report).toContain('Rows 29 to 30: 168s to 174s'); fireEvent.change(screen.getByLabelText('Evidence group'), { target: { value: 'repeated' } }); expect(screen.getByText(/Page 1\/1/)).toBeTruthy(); expect(list.getAllByRole('listitem')).toHaveLength(1); expect(list.getByText('30 consecutive identical coordinate rows. No motion or fault conclusion.')).toBeTruthy();
  });
  it('downloads a full source-bound report without network calls or coordinate disclosure', async () => {
    render(<SourceEvidence log={log} onSeek={onSeek} />); fireEvent.click(screen.getByText('Download source evidence report')); const report = await blobText(URL.createObjectURL.mock.calls[0][0]); expect(report).toContain(log.sha256); expect(report).toContain('Source altitude: 5/6 known'); expect(report).not.toContain('28.6139'); expect(globalThis.fetch).not.toHaveBeenCalled(); expect(screen.getByRole('status').textContent).toContain('not only this page');
  });
  it('reports download failure without changing source or losing navigation', () => {
    render(<SourceEvidence log={log} onSeek={onSeek} />); URL.createObjectURL.mockImplementationOnce(() => { throw Error('blocked'); }); fireEvent.click(screen.getByText('Download source evidence report')); expect(screen.getByRole('alert').textContent).toContain('could not start'); fireEvent.click(screen.getByText('Jump to row 3 at 4s')); expect(onSeek).toHaveBeenCalledWith(4);
  });
});
