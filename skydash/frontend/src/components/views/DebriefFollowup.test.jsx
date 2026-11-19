// @vitest-environment jsdom
import { TextEncoder, TextDecoder } from 'node:util';
import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DebriefFollowup from './DebriefFollowup';
import DebriefActions from './DebriefActions';
import DebriefChecklist from './DebriefChecklist';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from '../../utils/flightLog';
import { actionRegister } from '../../utils/debriefActions';
import { checklistReview } from '../../utils/debriefChecklist';
import { followupPacket } from '../../utils/debriefFollowup';
const log = { model_version: LOG_VERSION, sha256: 'a'.repeat(64), filename: 'source.csv', samples: parseFlightCSV(SAMPLE_LOG) };
const action = { id: 'a1', row: 4, text: 'Private follow-up', owner: 'Owner label', target: 'Not scheduled', status: 'Closed', closure: 'Reviewer assertion' };
const prompt = { id: 'p1', prompt: 'Private discussion', status: 'Not applicable', note: 'Unverified reason', row: 4 };
const snapshot = { actions: actionRegister(log, [action]), checklist: checklistReview(log, 'Private title', [prompt]) };
const getSnapshot = vi.fn(() => snapshot), apply = vi.fn(), pause = vi.fn();
const setup = (props = {}) => render(<DebriefFollowup log={log} getSnapshot={getSnapshot} onApply={apply} onPause={pause} {...props} />);
const load = text => fireEvent.change(screen.getByLabelText('Import follow-up packet JSON'), { target: { files: [{ size: new TextEncoder().encode(text).length, arrayBuffer: async () => new TextEncoder().encode(text).buffer }] } });
const json = () => JSON.stringify(followupPacket(log, snapshot.actions, snapshot.checklist));
const blobText = blob => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
beforeEach(() => { vi.clearAllMocks(); getSnapshot.mockImplementation(() => snapshot); vi.stubGlobal('TextDecoder', TextDecoder); URL.createObjectURL = vi.fn(() => 'blob:packet'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('follow-up packet workflow', () => {
  it('exports both entire saved snapshots and recomputed report independent of child filters/pages', async () => {
    setup(); fireEvent.click(screen.getByText('Download follow-up packet JSON')); const data = JSON.parse(await blobText(URL.createObjectURL.mock.calls[0][0])); expect(data.actions.items[0]).toEqual(action); expect(data.checklist.items[0]).toEqual(prompt); fireEvent.click(screen.getByText('Download combined follow-up report')); const text = await blobText(URL.createObjectURL.mock.calls[1][0]); expect(text).toContain('Private follow-up'); expect(text).toContain('Private discussion'); expect(text).toContain('8s / gap over 5s'); expect(text).not.toContain('28.614'); expect(apply).not.toHaveBeenCalled(); expect(pause).toHaveBeenCalled();
  });
  it('previews all unverified text from both sections, cancel keeps current, confirm applies both atomically', async () => {
    setup(); load(json()); await screen.findByLabelText('Follow-up packet import preview'); expect(screen.getByLabelText('Packet action preview').textContent).toContain('Owner label'); expect(screen.getByLabelText('Packet action preview').textContent).toContain('Reviewer assertion'); expect(screen.getByLabelText('Packet checklist preview').textContent).toContain('Unverified reason'); expect(screen.getByText('Download follow-up packet JSON').disabled).toBe(true); expect(apply).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Keep current follow-up sections')); expect(apply).not.toHaveBeenCalled(); load(json()); await screen.findByLabelText('Follow-up packet import preview'); fireEvent.click(screen.getByText('Replace both follow-up sections')); expect(apply).toHaveBeenCalledTimes(1); expect(apply).toHaveBeenCalledWith(JSON.parse(json())); expect(screen.queryByLabelText('Follow-up packet import preview')).toBeNull();
  });
  it('blocks export and import when either child snapshot has unfinished work, then rechecks new edits on apply', async () => {
    setup(); getSnapshot.mockImplementation(() => { throw Error('Finish child draft'); }); fireEvent.click(screen.getByText('Download follow-up packet JSON')); expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(screen.getByRole('alert').textContent).toContain('Finish child draft'); load(json()); expect(screen.queryByLabelText('Follow-up packet import preview')).toBeNull(); getSnapshot.mockReturnValue(snapshot); load(json()); await screen.findByLabelText('Follow-up packet import preview'); getSnapshot.mockImplementation(() => { throw Error('New child draft during preview'); }); fireEvent.click(screen.getByText('Replace both follow-up sections')); expect(apply).not.toHaveBeenCalled(); expect(screen.getByRole('alert').textContent).toContain('New child draft'); expect(screen.getByLabelText('Follow-up packet import preview')).toBeTruthy(); fireEvent.click(screen.getByText('Keep current follow-up sections')); expect(apply).not.toHaveBeenCalled();
  });
  it('rejects invalid second section/wrong source/UTF8/oversize without any partial apply, empty packet explicitly clears', async () => {
    setup(); const invalid = JSON.parse(json()); invalid.checklist.items[0].note = ''; load(JSON.stringify(invalid)); await screen.findByRole('alert'); expect(apply).not.toHaveBeenCalled(); expect(screen.queryByLabelText('Follow-up packet import preview')).toBeNull(); const wrong = JSON.parse(json()); wrong.source_sha256 = 'b'.repeat(64); load(JSON.stringify(wrong)); await screen.findByText(/fingerprint mismatch/);
    const arrayBuffer = vi.fn(); fireEvent.change(screen.getByLabelText('Import follow-up packet JSON'), { target: { files: [{ size: 524289, arrayBuffer }] } }); await screen.findByText(/at most 512KiB/); expect(arrayBuffer).not.toHaveBeenCalled(); fireEvent.change(screen.getByLabelText('Import follow-up packet JSON'), { target: { files: [{ size: 1, arrayBuffer: async () => new Uint8Array([255]).buffer }] } }); await screen.findByRole('alert');
    load(JSON.stringify(followupPacket(log, actionRegister(log, []), checklistReview(log, 'Empty', [])))); await screen.findByLabelText('Follow-up packet import preview'); expect(screen.getByText(/No imported actions/)).toBeTruthy(); expect(screen.getByText(/No imported prompts/)).toBeTruthy(); fireEvent.click(screen.getByText('Replace both follow-up sections')); expect(apply.mock.calls[0][0].actions.items).toEqual([]); expect(apply.mock.calls[0][0].checklist.items).toEqual([]);
  });
  it('parent loading locks operations and download failure preserves both sections', () => {
    const view = setup(); URL.createObjectURL.mockImplementationOnce(() => { throw Error('blocked'); }); fireEvent.click(screen.getByText('Download combined follow-up report')); expect(screen.getByRole('alert').textContent).toContain('blocked'); expect(apply).not.toHaveBeenCalled(); view.rerender(<DebriefFollowup log={log} workspaceBusy getSnapshot={getSnapshot} onApply={apply} onPause={pause} />); expect(screen.getByText('Download follow-up packet JSON').disabled).toBe(true); expect(screen.getByLabelText('Import follow-up packet JSON').disabled).toBe(true);
  });
  it('real child snapshots initialize validated saved data and guard editor/import/removal state without mutations', async () => {
    const actions = createRef(), checklist = createRef(); render(<><DebriefActions ref={actions} initialReview={snapshot.actions} log={log} time={8} onPause={pause} onSeek={vi.fn()} /><DebriefChecklist ref={checklist} initialReview={snapshot.checklist} log={log} time={8} onPause={pause} onSeek={vi.fn()} /></>); expect(actions.current.snapshot()).toEqual(snapshot.actions); expect(checklist.current.snapshot()).toEqual(snapshot.checklist);
    fireEvent.click(screen.getByText('Edit reviewer action')); expect(() => actions.current.snapshot()).toThrow('Finish'); fireEvent.click(screen.getByText('Cancel action edits')); fireEvent.click(screen.getByText('Remove saved action')); expect(() => actions.current.snapshot()).toThrow('Finish'); fireEvent.click(screen.getByText('Keep saved action')); expect(actions.current.snapshot()).toEqual(snapshot.actions);
    fireEvent.click(screen.getByText('Edit prompt')); expect(() => checklist.current.snapshot()).toThrow('Finish'); fireEvent.click(screen.getByText('Cancel prompt edits')); fireEvent.click(screen.getByText('Remove prompt')); expect(() => checklist.current.snapshot()).toThrow('Finish'); fireEvent.click(screen.getByText('Keep prompt')); expect(checklist.current.snapshot()).toEqual(snapshot.checklist);
  });
});
