// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TwoSourceRanks from './TwoSourceRanks';
import { LOG_VERSION } from '../../utils/flightLog';
const make = (values, hash, times) => ({ model_version: LOG_VERSION, sha256: hash.repeat(64), samples: values.map((value, i) => ({ time_s: times?.[i] ?? i, altitude_m: value, ground_speed_m_s: 0, battery_pct: null })) });
const a = make([40, 10, null, 30, 20], 'a', [0, 2, 4, 12, 14]), b = make([100, 0, 90, 10], 'b'), pause = vi.fn(), seek = vi.fn();
const setup = props => render(<TwoSourceRanks primary={a} baseline={b} onPause={pause} onSeek={seek} {...props} />), review = () => fireEvent.click(screen.getByText('Review two independent rank sets'));
const blobText = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
beforeEach(() => { vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:two-ranks'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('two-source rank review workflow', () => {
  it('requires explicit review and shows separate exact ranks with original spacing', () => {
    setup(); expect(screen.queryByLabelText('Reviewed two-source rank sets')).toBeNull(); expect(screen.getByText('Download two-source rank report').disabled).toBe(true); review(); expect(screen.getByLabelText('Two-source rank counts').textContent).toContain('A 4/5 known, 1 missing; B 4/4 known, 0 missing'); expect(screen.getByLabelText('A Nearest-rank P50 rank cell').textContent).toContain('20 m, rank 2/4. Original row 5 at 14s'); expect(screen.getByLabelText('B Nearest-rank P50 rank cell').textContent).toContain('10 m, rank 2/4. Original row 4 at 3s'); expect(screen.getByLabelText('A Nearest-rank P75 rank cell').textContent).toContain('8s / gap over 5s');
  });
  it('seeks comparison only using applied source anchor, including negative review clock', () => {
    setup({ alignment: { primaryIndex: 3, baselineIndex: 2, label: 'private' } }); review(); fireEvent.click(screen.getByText('Seek comparison A Minimum row 2')); expect(seek).toHaveBeenLastCalledWith(-10); fireEvent.click(screen.getByText('Seek comparison B Nearest-rank P50 row 4')); expect(seek).toHaveBeenLastCalledWith(1); expect(pause).toHaveBeenCalled(); expect(screen.getByRole('status').textContent).toContain('Primary replay unchanged');
  });
  it('channel edits block every old seek/download until discard or fresh review', () => {
    setup(); review(); fireEvent.change(screen.getByLabelText('Two-source rank channel'), { target: { value: 'battery_pct' } }); for (const btn of within(screen.getByLabelText('Reviewed two-source rank sets')).getAllByRole('button')) expect(btn.disabled).toBe(true); expect(screen.getByText('Download two-source rank report').disabled).toBe(true); fireEvent.click(screen.getByText('Discard two-source channel edits')); expect(screen.getByLabelText('Two-source rank channel').value).toBe('altitude_m'); expect(screen.getByText('Download two-source rank report').disabled).toBe(false); fireEvent.change(screen.getByLabelText('Two-source rank channel'), { target: { value: 'battery_pct' } }); review(); expect(screen.getAllByText('Unavailable, no known cells. Not zero.')).toHaveLength(10);
  });
  it('disabled blocks review/edit/download/all seeks without dropping last reviewed snapshot', () => {
    const view = setup(); review(); view.rerender(<TwoSourceRanks primary={a} baseline={b} onPause={pause} onSeek={seek} disabled />); expect(screen.getByLabelText('Two-source rank channel').disabled).toBe(true); expect(screen.getByText('Review two independent rank sets').disabled).toBe(true); expect(screen.getByText('Download two-source rank report').disabled).toBe(true); for (const btn of within(screen.getByLabelText('Reviewed two-source rank sets')).getAllByRole('button')) expect(btn.disabled).toBe(true); expect(screen.getByLabelText('Two-source rank counts')).toBeTruthy();
  });
  it('identical source warning and knownzero do not create grades or zero-fill missing channels', () => {
    setup({ baseline: a }); review(); expect(screen.getByRole('alert').textContent).toContain('IDENTICAL SOURCE CHECKSUMS'); fireEvent.change(screen.getByLabelText('Two-source rank channel'), { target: { value: 'ground_speed_m_s' } }); review(); expect(screen.getByLabelText('Two-source rank counts').textContent).toContain('A 5/5 known, 0 missing; B 5/5 known, 0 missing'); expect(screen.getByLabelText('A Maximum rank cell').textContent).toContain('0 m/s, rank 5/5. Original row 5');
  });
  it('downloads both full ledgers and mapping without anchor labels and keeps reviewed ranks on download failure', async () => {
    setup({ alignment: { primaryIndex: 3, baselineIndex: 2, label: 'PRIVATE_ANCHOR' } }); review(); fireEvent.click(screen.getByText('Download two-source rank report')); const text = await blobText(URL.createObjectURL.mock.calls[0][0]); for (const expected of ['PRIMARY A FULL INDEPENDENT LEDGERS', 'BASELINE B FULL INDEPENDENT LEDGERS', 'Rank 4/4: 40 m', 'Rank 4/4: 100 m', 'Original row 3 at 4s: unknown', 'comparison review clock -10s']) expect(text).toContain(expected); expect(text).not.toContain('PRIVATE_ANCHOR'); URL.createObjectURL.mockImplementationOnce(() => { throw Error('blocked'); }); fireEvent.click(screen.getByText('Download two-source rank report')); expect(screen.getByRole('alert').textContent).toContain('could not start'); expect(screen.getByLabelText('Two-source rank counts')).toBeTruthy();
  });
});
