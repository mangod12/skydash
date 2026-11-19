// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecordedBlocks from './RecordedBlocks';
import { LOG_VERSION } from '../../utils/flightLog';
const source = times => ({ model_version: LOG_VERSION, sha256: 'a'.repeat(64), samples: times.map((time_s, i) => ({ time_s, altitude_m: i === 1 ? null : 0, ground_speed_m_s: 0, battery_pct: null })) });
const log = source([0, 2, 4, 12, 14, 30]), pause = vi.fn(), seek = vi.fn(), setup = props => render(<RecordedBlocks log={log} onPause={pause} onSeek={seek} {...props} />);
const blobText = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
beforeEach(() => { vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => 'blob:blocks'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('recorded row block ledger workflow', () => {
  it('shows every original row block/boundaries/channel counts, exact endpoint seeks pause replay', () => {
    setup(); expect(screen.getByLabelText('Recorded block totals').textContent).toContain('3 blocks across 6 original rows, 2 separating'); const entries = within(screen.getByLabelText('Recorded row blocks')).getAllByRole('listitem'); expect(entries).toHaveLength(3); expect(entries[0].textContent).toContain('Source altitude: 2/3 known, 1 missing'); expect(entries[1].textContent).toContain('before: 8s / gap over 5s; after: 16s / gap over 5s'); fireEvent.click(screen.getByText('Seek block 2 last row 5')); expect(seek).toHaveBeenCalledWith(14); expect(pause).toHaveBeenCalled(); fireEvent.click(screen.getByText('Seek block 3 first row 6')); expect(seek).toHaveBeenLastCalledWith(30); expect(screen.queryByText('Seek block 3 last row 6')).toBeNull();
  });
  it('filters keep original numbering and empty filter is honest, filter/page never seeks', () => {
    setup(); fireEvent.change(screen.getByLabelText('Recorded block filter'), { target: { value: 'singleton' } }); expect(screen.getByLabelText('Matching block count').textContent).toContain('1/3'); expect(screen.getByText('Block 3: original rows 6 through 6')).toBeTruthy(); expect(seek).not.toHaveBeenCalled(); cleanup(); setup({ log: source([0, 2, 4]) }); fireEvent.change(screen.getByLabelText('Recorded block filter'), { target: { value: 'singleton' } }); expect(screen.getByText('No matching blocks. Not a completeness or fault-free-flight claim.')).toBeTruthy();
  });
  it('pages12, filter resets page and report includes allmatching blockseven beyond display', async () => {
    setup({ log: source(Array.from({ length: 40 }, (_, i) => i * 6)) }); expect(within(screen.getByLabelText('Recorded row blocks')).getAllByRole('listitem')).toHaveLength(12); fireEvent.click(screen.getByText('Next row block page')); expect(screen.getByLabelText('Recorded block page').textContent).toBe('Page 2/4'); expect(screen.getByText('Block 13: original rows 13 through 13')).toBeTruthy(); fireEvent.click(screen.getByText('Download matching row block report')); const text = await blobText(URL.createObjectURL.mock.calls[0][0]); expect(text).toContain('Block 40: original rows 40 through 40'); expect(text).toContain('Block 1: original rows 1 through 1'); fireEvent.change(screen.getByLabelText('Recorded block filter'), { target: { value: 'missing' } }); expect(screen.getByLabelText('Recorded block page').textContent).toBe('Page 1/4'); expect(seek).not.toHaveBeenCalled();
  });
  it('filtered report excludes other blocks but keeps source numbering and all global totals', async () => {
    setup(); fireEvent.change(screen.getByLabelText('Recorded block filter'), { target: { value: 'singleton' } }); fireEvent.click(screen.getByText('Download matching row block report')); const text = await blobText(URL.createObjectURL.mock.calls[0][0]); expect(text).toContain('3 original row blocks; 2 separating'); expect(text).toContain('Block 3: original rows 6'); expect(text).not.toContain('Block 1:');
  });
  it('disabled locks every derived action without clearing current filter/page', () => {
    const view = setup(); fireEvent.change(screen.getByLabelText('Recorded block filter'), { target: { value: 'singleton' } }); view.rerender(<RecordedBlocks log={log} onPause={pause} onSeek={seek} disabled />); expect(screen.getByLabelText('Recorded block filter').value).toBe('singleton'); expect(screen.getByLabelText('Recorded block filter').disabled).toBe(true); for (const btn of screen.getAllByRole('button')) expect(btn.disabled).toBe(true);
  });
  it('download failure preserves ledger/filter', () => { setup(); URL.createObjectURL.mockImplementationOnce(() => { throw Error('blocked'); }); fireEvent.click(screen.getByText('Download matching row block report')); expect(screen.getByRole('alert').textContent).toContain('could not start'); expect(screen.getByLabelText('Matching block count').textContent).toContain('3/3'); });
});
