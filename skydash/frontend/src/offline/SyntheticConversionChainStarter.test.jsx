// @vitest-environment jsdom
import {TextEncoder,TextDecoder} from 'node:util';
import {webcrypto} from 'node:crypto';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import SyntheticConversionChainStarter from './SyntheticConversionChainStarter';
import * as generator from './syntheticConversionChainStarter';
let downloads,blobs;
beforeEach(()=>{
 vi.stubGlobal('TextEncoder',TextEncoder);vi.stubGlobal('TextDecoder',TextDecoder);vi.stubGlobal('Uint8Array',new TextEncoder().encode('').constructor);vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('fetch',vi.fn());downloads=[];blobs=[];
 URL.createObjectURL=vi.fn(blob=>{blobs.push(blob);return 'blob:fixed-practice';});URL.revokeObjectURL=vi.fn();
 vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(){downloads.push(this.download);});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const prepare=()=>screen.getByText('Prepare fabricated chain practice');
const ready=async()=>{fireEvent.click(prepare());return screen.findByLabelText('Prepared fabricated chain exercises');};
it('waits for deliberate preparation, shows all expected outcomes and never downloads or fetches automatically',async()=>{
 const spy=vi.spyOn(generator,'syntheticConversionChainStarter');render(<SyntheticConversionChainStarter/>);expect(spy).not.toHaveBeenCalled();
 expect(screen.getByText('Download fabricated chain match-a ZIP').disabled).toBe(true);
 const result=await ready();expect(spy).toHaveBeenCalledExactlyOnceWith();expect(result.textContent).toContain('MATCH-A');expect(result.textContent).toContain('MATCH-B');expect(result.textContent).toContain('BAD-FINAL');expect(result.textContent).toContain('expected fresh-check outcome refuse');expect(downloads).toEqual([]);expect(fetch).not.toHaveBeenCalled();expect(document.querySelector('input')).toBeNull();
});
it('downloads only the deliberately chosen fixed example or guide and removes temporary links',async()=>{
 render(<SyntheticConversionChainStarter/>);await ready();
 fireEvent.click(screen.getByText('Download fabricated chain bad-final ZIP'));fireEvent.click(screen.getByText('Download fabricated chain practice guide'));
 expect(downloads).toEqual(['skydash-fabricated-chain-bad-final.zip','SKYDASH-FABRICATED-CONVERSION-CHAIN-GUIDE.txt']);expect(blobs[0].type).toBe('application/zip');expect(blobs[1].type).toBe('text/plain;charset=utf-8');expect(document.querySelectorAll('a')).toHaveLength(0);expect(fetch).not.toHaveBeenCalled();
});
it('blocked downloads retain prepared outputs, use generic diagnostics and remove any temporary link',async()=>{
 render(<SyntheticConversionChainStarter/>);await ready();vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(()=>{throw Error('PRIVATE browser detail');});
 fireEvent.click(screen.getByText('Download fabricated chain match-b ZIP'));expect(screen.getByLabelText('Fabricated chain practice status').textContent).toContain('could not start');expect(screen.getByLabelText('Fabricated chain practice status').textContent).not.toContain('PRIVATE');expect(screen.getByLabelText('Prepared fabricated chain exercises')).toBeTruthy();expect(document.querySelectorAll('a')).toHaveLength(0);
});
it('clears only its own prepared practice and disabled mode blocks prepare, clear and downloads',async()=>{
 const spy=vi.spyOn(generator,'syntheticConversionChainStarter'),view=render(<div><input aria-label="Unrelated receiver selection" defaultValue="retained"/><SyntheticConversionChainStarter/></div>);await ready();
 view.rerender(<div><input aria-label="Unrelated receiver selection" defaultValue="retained"/><SyntheticConversionChainStarter disabled/></div>);
 for(const button of screen.getAllByRole('button'))expect(button.disabled).toBe(true);fireEvent.click(prepare());expect(spy).toHaveBeenCalledTimes(1);
 view.rerender(<div><input aria-label="Unrelated receiver selection" defaultValue="retained"/><SyntheticConversionChainStarter/></div>);fireEvent.click(screen.getByText('Clear fabricated chain practice'));expect(screen.queryByLabelText('Prepared fabricated chain exercises')).toBeNull();expect(screen.getByLabelText('Unrelated receiver selection').value).toBe('retained');expect(downloads).toEqual([]);
});
it('a preparation error exposes no partial examples or private exception text',async()=>{
 vi.spyOn(generator,'syntheticConversionChainStarter').mockRejectedValueOnce(Error('PRIVATE paths'));
 render(<SyntheticConversionChainStarter/>);fireEvent.click(prepare());await screen.findByText(/preparation refused/);expect(screen.queryByLabelText('Prepared fabricated chain exercises')).toBeNull();expect(screen.getByLabelText('Fabricated chain practice status').textContent).not.toContain('PRIVATE');expect(downloads).toEqual([]);
});
it('prevents duplicate preparation and late unmounted completion cannot download',async()=>{
 let resolve;const spy=vi.spyOn(generator,'syntheticConversionChainStarter').mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 const view=render(<SyntheticConversionChainStarter/>);fireEvent.click(prepare());fireEvent.click(prepare());expect(spy).toHaveBeenCalledTimes(1);expect(screen.getByText('Clear fabricated chain practice').disabled).toBe(true);view.unmount();await act(async()=>{resolve({archives:[],guide:''});});expect(downloads).toEqual([]);expect(document.querySelector('section')).toBeNull();
});
