// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReceivedDiscussionAgenda from './ReceivedDiscussionAgenda';
import { agendaBrowserTrainingArchive } from '../utils/checkBrowserTrainingArchive';
vi.mock('../utils/checkBrowserTrainingArchive', () => ({ agendaBrowserTrainingArchive: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const ready = { html: '<!doctype html><p>PRIVATE NOTE</p>', bundleCount: 3, archiveDigest: 'a'.repeat(64), manifestDigest: 'b'.repeat(64) };
const ack = () => screen.getByLabelText('Acknowledge received private agenda'), prepare = () => screen.getByRole('button', { name: 'Prepare received private agenda' }), download = () => screen.getByRole('button', { name: 'Download private agenda HTML' });
it('requires independent consent, consumes it and prepares without rendering private text or automatically downloading', async () => {
  const onBusy = vi.fn(), file = new File(['ZIP'], 'PRIVATE.zip'), create = vi.fn(() => 'blob:local'), click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: vi.fn() })); agendaBrowserTrainingArchive.mockResolvedValue(ready);
  render(<ReceivedDiscussionAgenda file={file} options={{ expectedManifestSha256: 'b'.repeat(64) }} onBusy={onBusy} />);
  expect(prepare().disabled).toBe(true); fireEvent.click(ack()); fireEvent.click(prepare()); await waitFor(() => expect(download().disabled).toBe(false));
  expect(ack().checked).toBe(false); expect(prepare().disabled).toBe(true); expect(agendaBrowserTrainingArchive).toHaveBeenCalledWith(file, { expectedManifestSha256: 'b'.repeat(64), includePrivateReview: true }); expect(onBusy.mock.calls).toEqual([[true], [false]]); expect(screen.queryByText('PRIVATE NOTE')).toBeNull(); expect(create).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled();
  fireEvent.click(download()); expect(click.mock.instances[0].download).toBe('skydash-private-discussion-agenda.html'); expect(create.mock.calls[0][0].type).toBe('text/html;charset=utf-8');
});
it('acknowledgement edit stales output, refusal consumes it and own clear leaves other tools alone', async () => {
  agendaBrowserTrainingArchive.mockResolvedValue(ready); render(<ReceivedDiscussionAgenda file={new File(['ZIP'], 'PRIVATE.zip')} options={{}} />); fireEvent.click(ack()); fireEvent.click(prepare()); await waitFor(() => expect(download().disabled).toBe(false)); fireEvent.click(ack()); expect(download().disabled).toBe(true); agendaBrowserTrainingArchive.mockRejectedValueOnce(Error('PRIVATE DIAGNOSTIC')); fireEvent.click(prepare()); await waitFor(() => expect(screen.getByLabelText('Private agenda status').textContent).toContain('Private agenda refused')); expect(ack().checked).toBe(false); expect(screen.queryByText('PRIVATE DIAGNOSTIC')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Clear private agenda' })); expect(screen.getByLabelText('Private agenda status').textContent).toContain('Other outputs and replay unchanged');
});
it('shared work locks consent and actions; no ZIP means no preparation even acknowledged', async () => {
  let finish; agendaBrowserTrainingArchive.mockImplementation(() => new Promise(resolve => { finish = resolve; })); const props = { file: new File(['ZIP'], 'PRIVATE.zip'), options: {} }, view = render(<ReceivedDiscussionAgenda {...props} />);
  fireEvent.click(ack()); fireEvent.click(prepare()); expect(ack().disabled).toBe(true); expect(screen.getByRole('button', { name: 'Clear private agenda' }).disabled).toBe(true); finish(ready); await waitFor(() => expect(download().disabled).toBe(false)); view.rerender(<ReceivedDiscussionAgenda {...props} workspaceBusy />); expect(download().disabled).toBe(true); view.rerender(<ReceivedDiscussionAgenda options={{}} />); fireEvent.click(ack()); expect(prepare().disabled).toBe(true);
});
