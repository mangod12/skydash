// @vitest-environment jsdom
import {TextEncoder,TextDecoder} from 'node:util';
import {webcrypto} from 'node:crypto';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {LOG_HEADER} from '../utils/flightLog';
import RecordedCSVQueue from './RecordedCSVQueue';
import * as api from './recordedCSVQueue';
const raw=LOG_HEADER+'\n0,28,77,10,,95\n4,28.1,77.1,,,94\n12,28.2,77.2,12,4,\n';
const file=(text=raw,name='unverified.csv')=>{const bytes=new TextEncoder().encode(text);return{name,size:bytes.byteLength,arrayBuffer:vi.fn(async()=>bytes.slice().buffer)};};
beforeEach(()=>{vi.stubGlobal('TextEncoder',TextEncoder);vi.stubGlobal('TextDecoder',TextDecoder);vi.stubGlobal('Uint8Array',new TextEncoder().encode('').constructor);vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('fetch',vi.fn());});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const choose=files=>fireEvent.change(screen.getByLabelText('Choose recorded CSV queue files'),{target:{files}}),check=()=>screen.getByText('Check selected CSV batch locally'),clear=()=>screen.getByText('Clear CSV review queue');
const ready=async(files=[file()])=>{choose(files);fireEvent.click(check());return screen.findByLabelText('Checked recorded CSV queue');};
it('selection reads nothing, explicit checking shows bounded metadata and no source automatically opens or pauses',async()=>{
 const open=vi.fn();render(<RecordedCSVQueue onPreview={open}/>);const files=[file(),file('not supported','bad.csv')];choose(files);for(const value of files)expect(value.arrayBuffer).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled();fireEvent.click(check());const result=await screen.findByLabelText('Checked recorded CSV queue');expect(result.textContent).toContain('1 ready entries of 2');expect(result.textContent).toContain('3 original samples');expect(result.textContent).toContain('largest source interval 8s');expect(result.textContent).not.toContain('28.1');expect(result.textContent).toContain('Not prepared');expect(open).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();expect(screen.getAllByText(/Request opening review for CSV slot/)).toHaveLength(1);
});
it('requests only the chosen ready captured source and does not mark it opened, reviewed or completed',async()=>{
 const open=vi.fn();render(<RecordedCSVQueue onPreview={open}/>);await ready([file(raw,'one.csv'),file(raw.replace(',95',',96'),'two.csv')]);fireEvent.click(screen.getByText('Request opening review for CSV slot 2'));await screen.findByText(/Request for queue slot 2 returned/);expect(open).toHaveBeenCalledExactlyOnceWith(raw.replace(',95',',96'),'two.csv');expect(screen.getByLabelText('Checked recorded CSV queue')).toBeTruthy();expect(screen.getByLabelText('Recorded CSV queue status').textContent).toContain('not an opened, reviewed or completed flag');
});
it('shows equal-byte slots without treating duplicate filenames as identities and renders hostile names as text',async()=>{
 render(<RecordedCSVQueue/>);const result=await ready([file(raw,'<img src=x onerror=alert(1)>'),file(raw,'same.csv')]);expect(result.textContent).toContain('same bytes as queue slot(s) 2');expect(result.textContent).toContain('same bytes as queue slot(s) 1');expect(result.querySelectorAll('img,script')).toHaveLength(0);expect(screen.getByText('Request opening review for CSV slot 1').disabled).toBe(true);
});
it('new selections discard old private queue output without opening, while canceled selection retains it',async()=>{
 const open=vi.fn();render(<RecordedCSVQueue onPreview={open}/>);const result=await ready();choose([]);expect(screen.getByLabelText('Checked recorded CSV queue')).toBe(result);const later=file(raw,'later.csv');choose([later]);expect(screen.queryByLabelText('Checked recorded CSV queue')).toBeNull();expect(later.arrayBuffer).not.toHaveBeenCalled();expect(open).not.toHaveBeenCalled();
});
it('oversized replacement refuses before reading, drops the old queue and displays no private diagnostics',async()=>{
 render(<RecordedCSVQueue/>);await ready();const bad={...file(),size:1048577};choose([bad]);expect(screen.queryByLabelText('Checked recorded CSV queue')).toBeNull();expect(bad.arrayBuffer).not.toHaveBeenCalled();expect(screen.getByLabelText('Recorded CSV queue status').textContent).toContain('refused before reading');expect(check().disabled).toBe(true);
});
it('disabled workspace blocks all reads, requests and queue clearing; clearing only releases its own session state',async()=>{
 const open=vi.fn(),view=render(<div><input aria-label="Other notes" defaultValue="retained"/><RecordedCSVQueue onPreview={open}/></div>);await ready();view.rerender(<div><input aria-label="Other notes" defaultValue="retained"/><RecordedCSVQueue workspaceBusy onPreview={open}/></div>);expect(screen.getByLabelText('Choose recorded CSV queue files').disabled).toBe(true);for(const button of screen.getAllByRole('button'))expect(button.disabled).toBe(true);fireEvent.click(clear());expect(screen.getByLabelText('Checked recorded CSV queue')).toBeTruthy();view.rerender(<div><input aria-label="Other notes" defaultValue="retained"/><RecordedCSVQueue onPreview={open}/></div>);fireEvent.click(clear());expect(screen.queryByLabelText('Checked recorded CSV queue')).toBeNull();expect(check().disabled).toBe(true);expect(screen.getByLabelText('Other notes').value).toBe('retained');expect(open).not.toHaveBeenCalled();
});
it('hiding the drawer keeps checked entries and preparation failure gives no private exception text or partial result',async()=>{
 const view=render(<RecordedCSVQueue/>);await ready();const drawer=view.container.querySelector('details');drawer.open=true;fireEvent.click(screen.getByText('Queue several recorded CSVs for separate manual reviews'));expect(screen.getByLabelText('Checked recorded CSV queue')).toBeTruthy();vi.spyOn(api,'checkRecordedCSVQueue').mockRejectedValueOnce(Error('SECRET selected path'));fireEvent.click(check());await screen.findByText(/Batch could not be checked/);expect(screen.queryByLabelText('Checked recorded CSV queue')).toBeNull();expect(screen.getByLabelText('Recorded CSV queue status').textContent).not.toContain('SECRET');
});
it('one request at a time retains the queue on callback failure without claiming nothing applied',async()=>{
 let reject;const open=vi.fn(()=>new Promise((_,fail)=>{reject=fail;}));render(<RecordedCSVQueue onPreview={open}/>);await ready();const button=screen.getByText('Request opening review for CSV slot 1');fireEvent.click(button);fireEvent.click(button);expect(open).toHaveBeenCalledTimes(1);expect(clear().disabled).toBe(true);await act(async()=>{reject(Error('SECRET callback detail'));});expect(screen.getByLabelText('Recorded CSV queue status').textContent).toContain('Inspect the main workspace');expect(screen.getByLabelText('Recorded CSV queue status').textContent).not.toContain('SECRET');expect(screen.getByLabelText('Checked recorded CSV queue')).toBeTruthy();
});
it('busy checks cannot duplicate and unmount prevents late result restoration or source requests',async()=>{
 let resolve;const spy=vi.spyOn(api,'checkRecordedCSVQueue').mockImplementationOnce(()=>new Promise(done=>{resolve=done;})),open=vi.fn(),view=render(<RecordedCSVQueue onPreview={open}/>);choose([file()]);fireEvent.click(check());fireEvent.click(check());expect(spy).toHaveBeenCalledTimes(1);view.unmount();await act(async()=>{resolve({entries:[],ready_files:0,selected_files:1});});expect(open).not.toHaveBeenCalled();expect(view.container.textContent).toBe('');
});
