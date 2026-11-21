// @vitest-environment jsdom
import { TextEncoder, TextDecoder } from 'node:util';
import { webcrypto } from 'node:crypto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstructorDebrief from './InstructorDebrief';
import { LOG_VERSION, SAMPLE_LOG, parseFlightCSV } from '../../utils/flightLog';
import { debriefSidecar } from '../../utils/instructorDebrief';
const log = { filename: 'training.csv', model_version: LOG_VERSION, sha256: 'a'.repeat(64), samples: parseFlightCSV(SAMPLE_LOG) };
const initial = { log, time: 8, onSeek: vi.fn(), onPause: vi.fn() };
const marker = { id: 'imported', time_s: 12, kind: 'Question', text: 'Imported discussion point', discussed: true };
const file = text => ({ name: 'review.json', size: text.length, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('TextEncoder', TextEncoder); vi.stubGlobal('TextDecoder', TextDecoder); vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('fetch', vi.fn()); URL.createObjectURL = vi.fn(() => 'blob:debrief'); URL.revokeObjectURL = vi.fn(); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const add = text => { fireEvent.change(screen.getByLabelText('Instructor marker note'), { target: { value: text } }); fireEvent.click(screen.getByText('Add marker at cursor')); };
const importFile = text => fireEvent.change(screen.getByLabelText('Import debrief JSON'), { target: { files: [file(text)] } });
const blobText = blob => new Promise(resolve => { const reader = new globalThis.FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
describe('instructor review timeline', () => {
  it('captures a paused cursor, labels held evidence and jumps back to the exact review time', () => {
    render(<InstructorDebrief {...initial} />); expect(screen.getByText('Add marker at cursor').disabled).toBe(true); add('Discuss this missing interval.');
    expect(initial.onPause).toHaveBeenCalled(); const list = within(screen.getByLabelText('Instructor review markers'));
    expect(list.getByText('Discuss this missing interval.')).toBeTruthy(); expect(list.getByText(/DATA GAP/)).toBeTruthy();
    fireEvent.click(list.getByText('Jump to 8.0s')); expect(initial.onSeek).toHaveBeenCalledWith(8); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('keeps markers chronologically sorted and toggles discussion state without grading', () => {
    const view = render(<InstructorDebrief {...initial} />); add('Later point'); view.rerender(<InstructorDebrief {...initial} time={0} />); add('Earlier point');
    const rows = within(screen.getByLabelText('Instructor review markers')).getAllByRole('listitem'); expect(rows[0].textContent).toContain('Earlier point'); expect(rows[1].textContent).toContain('Later point');
    fireEvent.click(screen.getByLabelText('Discussed at 0.0s')); expect(screen.getByLabelText('Discussed at 0.0s').checked).toBe(true);
    fireEvent.click(screen.getByText('Remove marker at 8.0s'));expect(within(screen.getByLabelText('Instructor review markers')).getByText('Later point')).toBeTruthy();fireEvent.click(screen.getByText('Confirm remove instructor marker')); expect(screen.queryByText('Later point')).toBeNull(); expect(screen.getByText('Earlier point')).toBeTruthy();
  });
  it('downloads a source-bound sidecar and a report with instructor notes and recomputed context', async () => {
    render(<InstructorDebrief {...initial} />); add('Review gap'); fireEvent.change(screen.getByLabelText('Discussion summary'), { target: { value: 'Follow up with the data owner.' } });
    fireEvent.click(screen.getByText('Download debrief JSON')); const json = JSON.parse(await blobText(URL.createObjectURL.mock.calls[0][0]));
    expect(json.source_sha256).toBe(log.sha256); expect(json.markers[0].time_s).toBe(8); expect(json.notes).toBe('Follow up with the data owner.'); expect(json.csv_text).toBeUndefined();
    fireEvent.click(screen.getByText('Download instructor report')); const report = await blobText(URL.createObjectURL.mock.calls[1][0]); expect(report).toContain('sample 3 at 4s'); expect(report).toContain('DATA GAP'); expect(report).toContain('Review gap'); expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('imports only after explicit replacement confirmation and can cancel without losing the current review', async () => {
    render(<InstructorDebrief {...initial} />); add('Current marker'); const json = JSON.stringify(debriefSidecar(log, [marker], 'Imported summary'));
    importFile(json); await screen.findByText('Replace with imported review'); expect(within(screen.getByLabelText('Instructor review markers')).getByText('Current marker')).toBeTruthy(); expect(within(screen.getByLabelText('Instructor review markers')).queryByText('Imported discussion point')).toBeNull(); expect(within(screen.getByLabelText('Instructor sidecar replacement differences')).getByText('Imported discussion point')).toBeTruthy();
    fireEvent.click(screen.getByText('Keep current review')); expect(screen.getByText('Current marker')).toBeTruthy();
    importFile(json); await screen.findByText('Replace with imported review'); fireEvent.click(screen.getByText('Replace with imported review'));
    expect(screen.queryByText('Current marker')).toBeNull(); expect(screen.getByText('Imported discussion point')).toBeTruthy(); expect(screen.getByLabelText('Discussion summary').value).toBe('Imported summary'); expect(screen.getByLabelText('Discussed at 12.0s').checked).toBe(true);
  });
  it('rejects a mismatched source without replacing any current notes or markers', async () => {
    render(<InstructorDebrief {...initial} />); add('Preserve this'); fireEvent.change(screen.getByLabelText('Discussion summary'), { target: { value: 'Preserve summary' } });
    importFile(JSON.stringify({ ...debriefSidecar(log, [marker]), source_sha256: 'b'.repeat(64) })); await screen.findByRole('alert'); expect(screen.getByRole('alert').textContent).toContain('fingerprint mismatch');
    expect(screen.getByText('Preserve this')).toBeTruthy(); expect(screen.getByLabelText('Discussion summary').value).toBe('Preserve summary'); expect(screen.queryByText('Replace with imported review')).toBeNull();
  });
  it('rejects oversized files before reading and malformed markers before confirmation', async () => {
    render(<InstructorDebrief {...initial} />); const arrayBuffer = vi.fn(); fireEvent.change(screen.getByLabelText('Import debrief JSON'), { target: { files: [{ name: 'big.json', size: 262145, arrayBuffer }] } }); await screen.findByRole('alert'); expect(arrayBuffer).not.toHaveBeenCalled();
    importFile(JSON.stringify({ ...debriefSidecar(log, [marker]), markers: [{ ...marker, time_s: 99 }] })); await screen.findByText(/outside this recorded source/); expect(screen.queryByText('Replace with imported review')).toBeNull();
  });
  it('requires clear confirmation, preserves source, and reports export failure honestly', () => {
    render(<InstructorDebrief {...initial} />); add('Keep until confirmed'); fireEvent.click(screen.getByText('Clear instructor review')); fireEvent.click(screen.getByText('Keep review')); expect(screen.getByText('Keep until confirmed')).toBeTruthy();
    URL.createObjectURL.mockImplementationOnce(() => { throw Error('blocked'); }); fireEvent.click(screen.getByText('Download debrief JSON')); expect(screen.getByRole('alert').textContent).toContain('could not start'); expect(screen.getByText('Keep until confirmed')).toBeTruthy();
    fireEvent.click(screen.getByText('Clear instructor review')); fireEvent.click(screen.getByText('Confirm clear review')); expect(screen.queryByText('Keep until confirmed')).toBeNull(); expect(screen.getByText(/Source CSV and saved records are unchanged/)).toBeTruthy();
  });
  it('renders imported annotation text as plain text rather than HTML', async () => {
    render(<InstructorDebrief {...initial} />); importFile(JSON.stringify(debriefSidecar(log, [{ ...marker, text: '<img src=x onerror=alert(1)>' }]))); await screen.findByText('Replace with imported review'); fireEvent.click(screen.getByText('Replace with imported review'));
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy(); expect(document.querySelector('img')).toBeNull();
  });
  it('focuses undiscussed kinds without seeking or editing, exports every marker and summary from a filtered page', async () => {
    const markers=Array.from({length:24},(_,i)=>({id:'marker-'+String(i).padStart(2,'0'),time_s:i/2,kind:i===0?'Observation':i===1?'Follow-up':'Question',text:'Discussion '+i,discussed:i===2}));
    const ref={current:null};render(<InstructorDebrief {...initial} ref={ref} initialReview={{markers,notes:'Keep full summary'}} />);
    const before=ref.current.snapshot();expect(screen.getByText(/Showing 1 to 10 of 24/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Instructor timeline view'),{target:{value:'open'}});
    expect(initial.onPause).toHaveBeenCalledTimes(1);expect(initial.onSeek).not.toHaveBeenCalled();expect(ref.current.snapshot()).toEqual(before);
    expect(screen.queryByText('Discussion 0')).toBeNull();expect(screen.queryByText('Discussion 2')).toBeNull();expect(screen.getByText('Discussion 1')).toBeTruthy();
    fireEvent.click(screen.getByText('Next marker page'));expect(screen.getByText(/Showing 11 to 20 of 22/)).toBeTruthy();
    fireEvent.click(screen.getByText('Next marker page'));expect(screen.getByText(/Showing 21 to 22 of 22/)).toBeTruthy();expect(screen.getByText('Next marker page').disabled).toBe(true);
    fireEvent.click(screen.getByText('Jump to 11.0s'));expect(initial.onSeek).toHaveBeenLastCalledWith(11);
    fireEvent.click(screen.getByText('Download debrief JSON'));expect(JSON.parse(await blobText(URL.createObjectURL.mock.calls[0][0]))).toEqual(before);
    fireEvent.click(screen.getByLabelText('Discussed at 11.0s'));expect(screen.queryByText('Discussion 22')).toBeNull();expect(screen.getByText(/Showing 21 to 21 of 21/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Discussed at 11.5s'));expect(screen.getByText(/Showing 11 to 20 of 20/)).toBeTruthy();
    expect(initial.onSeek).toHaveBeenCalledTimes(1);expect(ref.current.snapshot().markers.filter(m=>m.discussed).map(m=>m.id)).toEqual(['marker-02','marker-22','marker-23']);
    fireEvent.change(screen.getByLabelText('Instructor timeline view'),{target:{value:'all'}});expect(screen.getByText('Discussion 0')).toBeTruthy();expect(screen.getByText('Discussion 2')).toBeTruthy();
    expect(ref.current.snapshot().markers.length).toBe(24);expect(ref.current.snapshot().notes).toBe('Keep full summary');expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('shows zero matches without hiding retained annotations permanently and restores discussed markers through All',()=>{
    render(<InstructorDebrief {...initial} initialReview={{markers:[{...marker,discussed:false,text:'<b>Plain question</b>'}],notes:''}} />);
    fireEvent.change(screen.getByLabelText('Instructor timeline view'),{target:{value:'questions'}});
    expect(screen.getByText('<b>Plain question</b>')).toBeTruthy();expect(document.querySelector('b')).toBeNull();
    fireEvent.click(screen.getByLabelText('Discussed at 12.0s'));expect(screen.getByText(/No markers match this view/)).toBeTruthy();expect(screen.getByText(/Showing 0 to 0 of 0/)).toBeTruthy();
    expect(screen.getByText('Previous marker page').disabled).toBe(true);expect(screen.getByText('Next marker page').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Instructor timeline view'),{target:{value:'all'}});expect(screen.getByLabelText('Discussed at 12.0s').checked).toBe(true);
    fireEvent.click(screen.getByLabelText('Discussed at 12.0s'));fireEvent.change(screen.getByLabelText('Instructor timeline view'),{target:{value:'followups'}});expect(screen.getByText(/No markers match this view/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Instructor timeline view'),{target:{value:'open'}});expect(screen.getByText('<b>Plain question</b>')).toBeTruthy();expect(initial.onSeek).not.toHaveBeenCalled();
  });
  it('holds queue navigation and marker changes while a checked sidecar awaits replacement, then keeps filter on cancel',async()=>{
    render(<InstructorDebrief {...initial} initialReview={{markers:[{...marker,discussed:false}],notes:''}} />);
    fireEvent.change(screen.getByLabelText('Instructor timeline view'),{target:{value:'open'}});
    importFile(JSON.stringify(debriefSidecar(log,[marker],'incoming')));await screen.findByText('Replace with imported review');
    expect(screen.getByLabelText('Instructor timeline view').disabled).toBe(true);expect(screen.getByLabelText('Discussed at 12.0s').disabled).toBe(true);expect(screen.getByText('Jump to 12.0s').disabled).toBe(true);expect(screen.getByText('Remove marker at 12.0s').disabled).toBe(true);
    fireEvent.click(screen.getByText('Keep current review'));expect(screen.getByLabelText('Instructor timeline view').value).toBe('open');expect(screen.getByLabelText('Discussed at 12.0s').disabled).toBe(false);
    importFile(JSON.stringify(debriefSidecar(log,[marker],'incoming')));await screen.findByText('Replace with imported review');fireEvent.click(screen.getByText('Replace with imported review'));
    expect(screen.getByText(/No markers match this view/)).toBeTruthy();fireEvent.change(screen.getByLabelText('Instructor timeline view'),{target:{value:'all'}});expect(screen.getByLabelText('Discussion summary').value).toBe('incoming');expect(screen.getByLabelText('Discussed at 12.0s').checked).toBe(true);
  });

  it('previews every exact-ID change and summary, warns about draft loss, updates saved-summary comparison and exports without applying',async()=>{
    const current=[{...marker,discussed:false,text:'Old note'}, {id:'removed',time_s:0,kind:'Observation',text:'Removed note',discussed:false}];
    const incoming=debriefSidecar(log,[{...marker,time_s:10,kind:'Follow-up',text:'<img onerror=literal>',discussed:true},{id:'added',time_s:2,kind:'Question',text:'Added note',discussed:false}],'Incoming summary');
    render(<InstructorDebrief {...initial} initialReview={{markers:current,notes:'Current summary'}} />);
    fireEvent.change(screen.getByLabelText('Instructor marker note'),{target:{value:'Keep draft until explicit Replace'}});
    importFile(JSON.stringify(incoming));await screen.findByText('Replace with imported review');
    const preview=within(screen.getByLabelText('Instructor sidecar replacement differences'));
    expect(preview.getByLabelText('Instructor replacement counts').textContent).toContain('Added 1; removed 1; changed 1; unchanged 0');expect(preview.getByText(/unadded marker draft is present/)).toBeTruthy();
    expect(preview.getByText('<img onerror=literal>')).toBeTruthy();expect(document.querySelector('img')).toBeNull();expect(preview.getByText('Before summary: Current summary')).toBeTruthy();expect(preview.getByText('After summary: Incoming summary')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Discussion summary'),{target:{value:'Edited current summary'}});expect(preview.getByText('Before summary: Edited current summary')).toBeTruthy();
    fireEvent.click(screen.getByText('Download instructor replacement comparison'));const output=await blobText(URL.createObjectURL.mock.calls[0][0]);expect(output).toContain('BEFORE summary: Edited current summary');expect(output).toContain('AFTER summary: Incoming summary');expect(output).not.toContain('Keep draft until explicit Replace');expect(output).toContain('Removed note');expect(output).toContain('Added note');
    expect(screen.getByLabelText('Instructor marker note').value).toBe('Keep draft until explicit Replace');expect(screen.getByLabelText('Discussion summary').value).toBe('Edited current summary');expect(initial.onSeek).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Keep current review'));expect(screen.queryByLabelText('Instructor sidecar replacement differences')).toBeNull();expect(screen.getByLabelText('Instructor marker note').value).toBe('Keep draft until explicit Replace');expect(screen.getByText('Old note')).toBeTruthy();expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('keeps checked import and current review on comparison download failure',async()=>{
    render(<InstructorDebrief {...initial} initialReview={{markers:[{...marker,discussed:false}],notes:''}} />);
    importFile(JSON.stringify(debriefSidecar(log,[],'')));await screen.findByText('Replace with imported review');
    URL.createObjectURL.mockImplementationOnce(()=>{throw Error('blocked')});fireEvent.click(screen.getByText('Download instructor replacement comparison'));
    expect(screen.getByRole('alert').textContent).toContain('comparison download could not start');expect(screen.getByText('Replace with imported review')).toBeTruthy();expect(screen.getByLabelText('Discussed at 12.0s').checked).toBe(false);
    fireEvent.click(screen.getByText('Replace with imported review'));expect(screen.queryByLabelText('Discussed at 12.0s')).toBeNull();
  });

  it('does not crash or offer blind replacement when current saved multibyte annotations exceed sidecar byte bounds',async()=>{
    const markers=Array.from({length:100},(_,i)=>({id:String(i),time_s:i/10,kind:'Question',text:'界'.repeat(1000),discussed:false}));
    render(<InstructorDebrief {...initial} initialReview={{markers,notes:''}} />);
    importFile(JSON.stringify(debriefSidecar(log,[],'')));await screen.findByText('Replace with imported review');
    expect(screen.getByRole('alert').textContent).toContain('cannot be compared within sidecar bounds');expect(screen.getByText('Replace with imported review').disabled).toBe(true);expect(screen.getByText('Download instructor replacement comparison').disabled).toBe(true);
    fireEvent.click(screen.getByText('Keep current review'));expect(screen.getByText(/Review timeline \(100\/100\)/)).toBeTruthy();
  });

  it('edits only the selected saved kind/text after explicit Save, retaining source time ID discussed and summary',()=>{
    const first={...marker,discussed:true,text:'Original saved note'},second={...marker,id:'second',time_s:8,text:'Separate note',discussed:false};const ref={current:null};
    render(<InstructorDebrief {...initial} ref={ref} initialReview={{markers:[second,first],notes:'Kept summary'}} />);
    fireEvent.click(screen.getByText('Edit marker at 12.0s'));expect(screen.getByLabelText('Edited marker note').value).toBe('Original saved note');expect(document.activeElement).toBe(screen.getByLabelText('Edited marker note'));
    expect(initial.onPause).toHaveBeenCalledTimes(1);expect(initial.onSeek).not.toHaveBeenCalled();expect(()=>ref.current.snapshot()).toThrow(/Save or cancel/);
    expect(screen.getByLabelText('Instructor timeline view').disabled).toBe(true);expect(screen.getByLabelText('Import debrief JSON').disabled).toBe(true);expect(screen.getByText('Download debrief JSON').disabled).toBe(true);expect(screen.getByLabelText('Discussed at 8.0s').disabled).toBe(true);expect(screen.getByText('Remove marker at 8.0s').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Edited marker kind'),{target:{value:'Follow-up'}});fireEvent.change(screen.getByLabelText('Edited marker note'),{target:{value:'  <b>Corrected saved note</b>  '}});
    expect(screen.getByText('Original saved note')).toBeTruthy();fireEvent.click(screen.getByText('Save marker edit'));
    expect(ref.current.snapshot().markers).toEqual([second,{...first,kind:'Follow-up',text:'<b>Corrected saved note</b>'}]);expect(ref.current.snapshot().notes).toBe('Kept summary');expect(document.querySelector('b')).toBeNull();expect(initial.onSeek).not.toHaveBeenCalled();expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('cancel keeps original marker and unadded draft; blank edits cannot save and the empty queue remains reversible',()=>{
    const saved={...marker,discussed:false,text:'Keep original'};const ref={current:null};render(<InstructorDebrief {...initial} ref={ref} initialReview={{markers:[saved],notes:''}} />);
    fireEvent.change(screen.getByLabelText('Instructor marker note'),{target:{value:'Unadded draft retained'}});fireEvent.change(screen.getByLabelText('Instructor timeline view'),{target:{value:'questions'}});
    fireEvent.click(screen.getByText('Edit marker at 12.0s'));fireEvent.change(screen.getByLabelText('Edited marker note'),{target:{value:'   '}});expect(screen.getByText('Save marker edit').disabled).toBe(true);fireEvent.click(screen.getByText('Cancel marker edit'));
    expect(screen.getByLabelText('Instructor marker note').value).toBe('Unadded draft retained');expect(screen.getByText('Keep original')).toBeTruthy();expect(screen.getByLabelText('Instructor timeline view').value).toBe('questions');
    fireEvent.change(screen.getByLabelText('Instructor marker note'),{target:{value:''}});expect(ref.current.snapshot().markers).toEqual([saved]);
    fireEvent.click(screen.getByText('Edit marker at 12.0s'));fireEvent.change(screen.getByLabelText('Edited marker kind'),{target:{value:'Observation'}});fireEvent.click(screen.getByText('Save marker edit'));expect(screen.getByText(/No markers match this view/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Instructor timeline view'),{target:{value:'all'}});expect(screen.getByText('Keep original')).toBeTruthy();expect(screen.getByLabelText('Discussed at 12.0s').checked).toBe(false);expect(ref.current.snapshot().markers[0]).toEqual({...saved,kind:'Observation'});
  });

  it('previews exact-ID removal without deleting another equal-time marker, pauses without seeking, and guards export until confirmed/canceled',()=>{
    const a={...marker,id:'first',discussed:false,text:'<b>First private note</b>'},b={...marker,id:'second',discussed:true,text:'Separate equal-time note'},ref={current:null};render(<InstructorDebrief {...initial} ref={ref} initialReview={{markers:[a,b],notes:'Retained summary'}} />);
    const list=within(screen.getByLabelText('Instructor review markers'));fireEvent.click(list.getAllByText('Remove marker at 12.0s')[0]);
    const preview=within(screen.getByLabelText('Remove saved instructor marker preview'));expect(preview.getByText('<b>First private note</b>')).toBeTruthy();expect(document.querySelector('b')).toBeNull();expect(document.activeElement).toBe(preview.getByText('Remove this one saved instructor marker?'));expect(initial.onSeek).not.toHaveBeenCalled();expect(initial.onPause).toHaveBeenCalled();expect(()=>ref.current.snapshot()).toThrow(/Confirm or cancel/);expect(screen.getByLabelText('Instructor timeline view').disabled).toBe(true);expect(screen.getByLabelText('Import debrief JSON').disabled).toBe(true);
    fireEvent.click(preview.getByText('Keep instructor marker'));expect(ref.current.snapshot().markers).toEqual([a,b]);
    fireEvent.click(list.getAllByText('Remove marker at 12.0s')[0]);fireEvent.click(screen.getByText('Confirm remove instructor marker'));expect(ref.current.snapshot().markers).toEqual([b]);expect(ref.current.snapshot().notes).toBe('Retained summary');expect(initial.onSeek).not.toHaveBeenCalled();expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('inspects saved marker source context without changing saved review or unadded drafts and guards jumps during edit/removal',()=>{
    const ref={current:null};render(<InstructorDebrief {...initial} ref={ref} initialReview={{markers:[{...marker,time_s:8}],notes:'Retain summary'}} />);const before=ref.current.snapshot();fireEvent.change(screen.getByLabelText('Instructor marker note'),{target:{value:'Unadded draft'}});
    fireEvent.click(screen.getByText('Inspect source at marker 8.0s'));expect(initial.onPause).toHaveBeenCalled();expect(initial.onSeek).not.toHaveBeenCalled();expect(screen.getByLabelText('Instructor marker note').value).toBe('Unadded draft');fireEvent.change(screen.getByLabelText('Instructor marker note'),{target:{value:''}});expect(ref.current.snapshot()).toEqual(before);
    fireEvent.click(screen.getByText('Edit marker at 8.0s'));expect(screen.getByText('Jump to context row 4 at 12s').disabled).toBe(true);fireEvent.click(screen.getByText('Cancel marker edit'));fireEvent.click(screen.getByText('Remove marker at 8.0s'));expect(screen.getByText('Jump to context row 4 at 12s').disabled).toBe(true);fireEvent.click(screen.getByText('Keep instructor marker'));fireEvent.click(screen.getByText('Close marker source context'));expect(screen.queryByLabelText('Instructor marker source context')).toBeNull();expect(ref.current.snapshot()).toEqual(before);expect(globalThis.fetch).not.toHaveBeenCalled();
  });

});
