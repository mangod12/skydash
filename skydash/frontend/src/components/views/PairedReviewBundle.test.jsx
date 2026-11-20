// @vitest-environment jsdom
import { TextDecoder, TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PairedReviewBundle from './PairedReviewBundle';
import { SAMPLE_LOG, LOG_VERSION, parseFlightCSV, flightCSVHash } from '../../utils/flightLog';
import { createPairedReviewBundle } from '../../utils/pairedReviewBundle';
let primary, comparison, onOpen, onPause, getSnapshot;
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('TextEncoder', TextEncoder); vi.stubGlobal('TextDecoder', TextDecoder);
  const log = { title: 'Primary', filename: 'primary.csv', csv_text: SAMPLE_LOG, sha256: await flightCSVHash(SAMPLE_LOG), model_version: LOG_VERSION, samples: parseFlightCSV(SAMPLE_LOG) };
  primary = { log, review: { title: 'Primary', notes: 'Private analyst' }, debrief: { markers: [], notes: '' }, envelope: null }; comparison = { baseline: { ...log, title: 'Baseline', filename: 'baseline.csv' }, notes: 'Private comparison', alignment: null };
  onOpen = vi.fn(); onPause = vi.fn(); getSnapshot = vi.fn(() => ({ primary, comparison })); URL.createObjectURL = vi.fn(() => 'blob:paired'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const view = props => render(<PairedReviewBundle hasSource getSnapshot={getSnapshot} onOpen={onOpen} onPause={onPause} {...props} />);
const choose = async () => { const text = await createPairedReviewBundle(primary, comparison); fireEvent.change(screen.getByLabelText('Open paired review bundle JSON'), { target: { files: [{ name: 'paired.json', size: text.length, arrayBuffer: async () => new TextEncoder().encode(text).buffer }] } }); return screen.findByLabelText('Paired review bundle preview'); };
it('previews both checked sources even before a current source exists and never opens on read or cancel', async () => {
  view({ hasSource: false }); expect(screen.getByText('Download paired review bundle JSON').disabled).toBe(true); await choose(); expect(screen.getByRole('heading', { name: 'Checked two-source bundle. Current workspace kept.' })).toBe(document.activeElement); expect(onOpen).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Keep current workspace and sources')); expect(onOpen).not.toHaveBeenCalled(); expect(screen.queryByLabelText('Paired review bundle preview')).toBeNull();
});
it('opens only the checked in-memory payload after explicit replacement and does not fetch or save', async () => {
  view(); await choose(); fireEvent.click(screen.getByText('Replace workspace with checked paired review')); expect(onOpen).toHaveBeenCalledOnce(); expect(onOpen.mock.calls[0][0].primary.log.csv_text).toBe(SAMPLE_LOG); expect(onOpen.mock.calls[0][0].comparison.notes).toBe('Private comparison');
});
it('exports only on a click, pauses the primary and reports a snapshot guard failure without requesting a download', async () => {
  view(); expect(getSnapshot).not.toHaveBeenCalled(); getSnapshot.mockImplementationOnce(() => { throw Error('Finish comparison anchors'); }); fireEvent.click(screen.getByText('Download paired review bundle JSON')); await screen.findByRole('alert'); expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(onPause).toHaveBeenCalledOnce(); fireEvent.click(screen.getByText('Download paired review bundle JSON')); await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce());
});
it('rejects invalid or oversized data and blocks actions while source work is busy', async () => {
  const { rerender } = view({ workspaceBusy: true }); expect(screen.getByLabelText('Open paired review bundle JSON').disabled).toBe(true); rerender(<PairedReviewBundle hasSource getSnapshot={getSnapshot} onOpen={onOpen} onPause={onPause} />);
  const arrayBuffer = vi.fn(); fireEvent.change(screen.getByLabelText('Open paired review bundle JSON'), { target: { files: [{ size: 4 * 1024 * 1024 + 1, arrayBuffer }] } }); await screen.findByRole('alert'); expect(arrayBuffer).not.toHaveBeenCalled(); expect(onOpen).not.toHaveBeenCalled();
});

it('downloads a readable snapshot only on explicit request with the same source guards as JSON', async () => {
  view(); fireEvent.click(screen.getByText('Download paired review handoff report')); await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce()); expect(getSnapshot).toHaveBeenCalledOnce(); const blob = URL.createObjectURL.mock.calls[0][0]; expect(blob.type).toBe('text/plain;charset=utf-8'); expect(onPause).toHaveBeenCalledOnce();
  getSnapshot.mockImplementationOnce(() => { throw Error('Finish comparison anchors'); }); fireEvent.click(screen.getByText('Download paired review handoff report')); await screen.findByRole('alert'); expect(URL.createObjectURL).toHaveBeenCalledOnce();
});
