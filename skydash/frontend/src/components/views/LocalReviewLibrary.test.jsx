// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocalReviewLibrary from './LocalReviewLibrary';
import { listLocalCases, saveLocalCase, readLocalCase, deleteLocalCase } from '../../utils/localReviewLibrary';
vi.mock('../../utils/localReviewLibrary', async original => ({ ...await original(), listLocalCases: vi.fn(), saveLocalCase: vi.fn(), readLocalCase: vi.fn(), deleteLocalCase: vi.fn() }));
const meta = { id: 'case-one', title: 'Synthetic review', filename: 'source.csv', sha256: 'a'.repeat(64), saved_at: '2026-11-18T20:00:00.000Z', bytes: 500 };
const opened = { log: { title: meta.title, samples: [{ time_s: 0 }, { time_s: 2 }] }, data: { debrief: { markers: [] }, envelope: null } };
const snapshot = { log: {}, review: {}, debrief: {}, envelope: null };
const props = { getSnapshot: vi.fn(() => snapshot), onOpen: vi.fn(), onPause: vi.fn(), hasSource: true };
const refresh = async () => { fireEvent.click(screen.getByText('Refresh local library')); await screen.findByText('Synthetic review'); };
beforeEach(() => { vi.clearAllMocks(); listLocalCases.mockResolvedValue([meta]); saveLocalCase.mockResolvedValue({ id: meta.id, title: meta.title }); readLocalCase.mockResolvedValue({ record: { ...meta, contents: '{"case":"data"}' }, opened }); deleteLocalCase.mockResolvedValue(meta.id); URL.createObjectURL = vi.fn(() => 'blob:local'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('explicit device-local case shelf', () => {
  it('never reads or saves automatically, and requires coordinate/notes acknowledgement per save', async () => {
    render(<LocalReviewLibrary {...props} />); expect(listLocalCases).not.toHaveBeenCalled(); expect(saveLocalCase).not.toHaveBeenCalled(); expect(screen.getByText('Save local review snapshot').disabled).toBe(true); fireEvent.click(screen.getByLabelText('Allow this snapshot to store coordinates and notes locally')); fireEvent.click(screen.getByText('Save local review snapshot')); await screen.findByText(/Snapshot saved locally/); expect(saveLocalCase).toHaveBeenCalledWith(snapshot); expect(props.onPause).toHaveBeenCalled(); expect(screen.getByLabelText('Allow this snapshot to store coordinates and notes locally').checked).toBe(false); expect(screen.getByText('Save local review snapshot').disabled).toBe(true);
  });
  it('refreshes metadata and previews a validated case before replacement', async () => {
    render(<LocalReviewLibrary {...props} />); await refresh(); fireEvent.click(screen.getByText('Review snapshot Synthetic review')); await screen.findByText('Replace workspace with local snapshot'); expect(props.onOpen).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Keep workspace')); expect(props.onOpen).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Review snapshot Synthetic review')); await screen.findByText('Replace workspace with local snapshot'); fireEvent.click(screen.getByText('Replace workspace with local snapshot')); expect(props.onOpen).toHaveBeenCalledWith(opened); expect(screen.getByRole('status').textContent).toContain('recomputed');
  });
  it('downloads exact stored snapshot without altering the current workspace', async () => {
    render(<LocalReviewLibrary {...props} />); await refresh(); fireEvent.click(screen.getByText('Download snapshot Synthetic review')); await screen.findByText(/Snapshot JSON download requested/); expect(URL.createObjectURL).toHaveBeenCalledOnce(); expect(props.onOpen).not.toHaveBeenCalled(); expect(deleteLocalCase).not.toHaveBeenCalled();
  });
  it('requires explicit delete confirmation and can cancel without changing storage', async () => {
    render(<LocalReviewLibrary {...props} />); await refresh(); fireEvent.click(screen.getByText('Delete snapshot Synthetic review')); expect(deleteLocalCase).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Keep snapshot')); expect(deleteLocalCase).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Delete snapshot Synthetic review')); fireEvent.click(screen.getByText('Confirm delete local snapshot')); await screen.findByText(/Selected local snapshot deleted/); expect(deleteLocalCase).toHaveBeenCalledWith(meta.id); expect(props.onOpen).not.toHaveBeenCalled(); expect(screen.queryByText('Synthetic review')).toBeNull();
  });
  it('reports a committed save despite a failed subsequent list refresh to prevent blind duplicates', async () => {
    listLocalCases.mockRejectedValueOnce(Error('read failed')); render(<LocalReviewLibrary {...props} />); fireEvent.click(screen.getByLabelText('Allow this snapshot to store coordinates and notes locally')); fireEvent.click(screen.getByText('Save local review snapshot')); await screen.findByText(/Do not retry saving blindly/); expect(saveLocalCase).toHaveBeenCalledOnce(); expect(screen.queryByRole('alert')).toBeNull();
  });
  it('does not pretend quota/storage/snapshot failures were saved', async () => {
    saveLocalCase.mockRejectedValueOnce(Error('Browser storage is full. No case was saved.')); render(<LocalReviewLibrary {...props} />); fireEvent.click(screen.getByLabelText('Allow this snapshot to store coordinates and notes locally')); fireEvent.click(screen.getByText('Save local review snapshot')); await screen.findByRole('alert'); expect(screen.getByRole('alert').textContent).toContain('No case was saved'); expect(screen.getByLabelText('Allow this snapshot to store coordinates and notes locally').checked).toBe(true); expect(listLocalCases).not.toHaveBeenCalled();
  });
  it('blocks corrupt/missing snapshots without offering replacement', async () => {
    readLocalCase.mockRejectedValueOnce(Error('Source fingerprint mismatch')); render(<LocalReviewLibrary {...props} />); await refresh(); fireEvent.click(screen.getByText('Review snapshot Synthetic review')); await screen.findByRole('alert'); expect(screen.queryByText('Replace workspace with local snapshot')).toBeNull(); expect(props.onOpen).not.toHaveBeenCalled();
  });
  it('does not need a loaded source to reopen or back up local cases', async () => {
    render(<LocalReviewLibrary {...props} hasSource={false} />); fireEvent.click(screen.getByLabelText('Allow this snapshot to store coordinates and notes locally')); expect(screen.getByText('Save local review snapshot').disabled).toBe(true); await refresh(); expect(screen.getByText('Review snapshot Synthetic review').disabled).toBe(false);
  });
  it('preserves list and current workspace if confirmed deletion fails', async () => {
    deleteLocalCase.mockRejectedValueOnce(Error('Transaction aborted')); render(<LocalReviewLibrary {...props} />); await refresh(); fireEvent.click(screen.getByText('Delete snapshot Synthetic review')); fireEvent.click(screen.getByText('Confirm delete local snapshot')); await screen.findByRole('alert'); expect(screen.getByText('Synthetic review')).toBeTruthy(); expect(props.onOpen).not.toHaveBeenCalled();
  });
});
