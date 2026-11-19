// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FollowupReferenceIndex from './FollowupReferenceIndex';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from '../../utils/flightLog';
import { actionRegister } from '../../utils/debriefActions';
import { checklistReview } from '../../utils/debriefChecklist';
const log = { model_version: LOG_VERSION, sha256: 'a'.repeat(64), filename: 'source.csv', samples: parseFlightCSV(SAMPLE_LOG) };
const action = { id: 'a1', row: 4, text: 'Private source-linked action', owner: 'Owner label', target: 'No deadline', status: 'Closed', closure: 'Reviewer outcome' };
const prompt = { id: 'p1', prompt: 'Private checklist prompt', status: 'Discussed', note: 'Private reason', row: 4 };
const value = { actions: actionRegister(log, [action]), checklist: checklistReview(log, 'Title', [prompt, { ...prompt, id: 'p2', row: null, prompt: 'Private no-row discussion item' }]) };
const getSnapshot = vi.fn(() => value), pause = vi.fn(), seek = vi.fn();
const setup = props => render(<FollowupReferenceIndex log={log} getSnapshot={getSnapshot} onPause={pause} onSeek={seek} {...props} />);
const build = () => fireEvent.click(screen.getByText('Build follow-up reference index'));
const blobText = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
beforeEach(() => { vi.clearAllMocks(); getSnapshot.mockImplementation(() => value); URL.createObjectURL = vi.fn(() => 'blob:index'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('saved follow-up reference index workflow', () => {
  it('has no background reads and builds only an explicit non-mutating snapshot with exact evidence/annotations', () => {
    setup(); expect(getSnapshot).not.toHaveBeenCalled(); expect(screen.getByText('Download follow-up reference report').disabled).toBe(true); build();
    expect(screen.getByLabelText('Follow-up reference counts').textContent).toContain('1 action references; 1 checklist row references; 1 prompts without a row'); const rows = screen.getByLabelText('Follow-up referenced source rows'); expect(rows.textContent).toContain('Original data row 4 at 12s'); expect(rows.textContent).toContain('8s / gap over 5s'); expect(rows.textContent).toContain('Source altitude unknown'); expect(rows.textContent).toContain('Owner label'); expect(rows.textContent).toContain('Private reason'); expect(seek).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Discussion prompts without source row').textContent).toContain('Private no-row discussion item'); fireEvent.click(screen.getByText('Seek follow-up original row 4')); expect(seek).toHaveBeenCalledWith(12);
  });
  it('unfinished drafts block build and all indexed operations without losing last snapshot', () => {
    setup(); getSnapshot.mockImplementation(() => { throw Error('Finish draft'); }); build(); expect(screen.queryByLabelText('Indexed saved follow-up references')).toBeNull(); expect(screen.getByRole('alert').textContent).toContain('Finish draft'); getSnapshot.mockReturnValue(value); build(); getSnapshot.mockImplementation(() => { throw Error('New unfinished draft'); });
    fireEvent.click(screen.getByText('Seek follow-up original row 4')); expect(seek).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Download follow-up reference report')); expect(URL.createObjectURL).not.toHaveBeenCalled(); fireEvent.change(screen.getByLabelText('Follow-up reference filter'), { target: { value: 'actions' } }); expect(screen.getByLabelText('Follow-up reference filter').value).toBe('all'); expect(screen.getByRole('alert').textContent).toContain('New unfinished draft'); expect(screen.getByLabelText('Indexed saved follow-up references')).toBeTruthy();
  });
  it('saved changes block stale seek/filter/download until explicit refresh, keeping original cursor', () => {
    setup(); build(); getSnapshot.mockReturnValue({ ...value, actions: actionRegister(log, [{ ...action, row: 1, text: 'Changed saved action' }]) });
    fireEvent.click(screen.getByText('Seek follow-up original row 4')); expect(seek).not.toHaveBeenCalled(); expect(screen.getByRole('alert').textContent).toContain('Refresh index'); fireEvent.click(screen.getByText('Download follow-up reference report')); expect(URL.createObjectURL).not.toHaveBeenCalled(); fireEvent.change(screen.getByLabelText('Follow-up reference filter'), { target: { value: 'actions' } }); expect(screen.getByLabelText('Follow-up reference filter').value).toBe('all');
    fireEvent.click(screen.getByText('Refresh follow-up reference index')); fireEvent.click(screen.getByText('Seek follow-up original row 1')); expect(seek).toHaveBeenCalledWith(0); expect(screen.getByLabelText('Follow-up referenced source rows').textContent).toContain('Changed saved action');
  });
  it('filters matching rows but retains both section annotations, excludes unreferenced prompts only for actions', async () => {
    setup(); build(); fireEvent.change(screen.getByLabelText('Follow-up reference filter'), { target: { value: 'actions' } }); expect(screen.getByLabelText('Follow-up referenced source rows').textContent).toContain('Private checklist prompt'); expect(screen.queryByLabelText('Discussion prompts without source row')).toBeNull(); fireEvent.click(screen.getByText('Download follow-up reference report')); const text = await blobText(URL.createObjectURL.mock.calls[0][0]); expect(text).toContain('Private source-linked action'); expect(text).toContain('Private checklist prompt'); expect(text).not.toContain('Private no-row discussion item'); expect(text).not.toContain('28.614');
    fireEvent.change(screen.getByLabelText('Follow-up reference filter'), { target: { value: 'checklist' } }); expect(screen.getByLabelText('Discussion prompts without source row')).toBeTruthy();
  });
  it('pages12 rows, exports all matches, resets page on filter/refresh, and guards page changes', async () => {
    const source = { ...log, samples: Array.from({ length: 30 }, (_, i) => ({ ...log.samples[0], time_s: i })) }, items = Array.from({ length: 30 }, (_, i) => ({ ...action, id: `a${i}`, row: i + 1 }));
    const saved = { actions: actionRegister(source, items), checklist: checklistReview(source, 'Title', []) }; getSnapshot.mockReturnValue(saved); setup({ log: source }); build(); expect(within(screen.getByLabelText('Follow-up referenced source rows')).getAllByRole('listitem')).toHaveLength(12); fireEvent.click(screen.getByText('Next follow-up reference page')); expect(screen.getByLabelText('Follow-up reference page').textContent).toBe('Page 2/3');
    fireEvent.click(screen.getByText('Download follow-up reference report')); const text = await blobText(URL.createObjectURL.mock.calls[0][0]); expect(text).toContain('Original data row 30 at 29s'); expect(text).toContain('All 30/30');
    getSnapshot.mockImplementation(() => { throw Error('Draft now'); }); fireEvent.click(screen.getByText('Next follow-up reference page')); expect(screen.getByLabelText('Follow-up reference page').textContent).toBe('Page 2/3'); getSnapshot.mockReturnValue(saved); fireEvent.change(screen.getByLabelText('Follow-up reference filter'), { target: { value: 'checklist' } }); expect(screen.getByLabelText('Follow-up reference page').textContent).toBe('Page 1/1'); expect(screen.getByText(/No matching referenced rows/)).toBeTruthy();
  });
  it('workspace locks build/seek/export/filter, missing seek handler disables only seek, download failure retains snapshot', () => {
    const view = setup({ onSeek: undefined }); build(); expect(screen.getByText('Seek follow-up original row 4').disabled).toBe(true); URL.createObjectURL.mockImplementationOnce(() => { throw Error('Download blocked'); }); fireEvent.click(screen.getByText('Download follow-up reference report')); expect(screen.getByRole('alert').textContent).toContain('Download blocked'); expect(screen.getByLabelText('Indexed saved follow-up references')).toBeTruthy(); view.rerender(<FollowupReferenceIndex log={log} getSnapshot={getSnapshot} onPause={pause} onSeek={seek} disabled />); for (const text of ['Refresh follow-up reference index', 'Download follow-up reference report', 'Seek follow-up original row 4']) expect(screen.getByText(text).disabled).toBe(true); expect(screen.getByLabelText('Follow-up reference filter').disabled).toBe(true);
  });
});
