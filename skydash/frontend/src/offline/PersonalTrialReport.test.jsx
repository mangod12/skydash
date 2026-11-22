// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import Guide from './GuidedDiscussionTrial';
let blobs,downloads;
beforeEach(()=>{blobs=[];downloads=[];const Base=URL;vi.stubGlobal('URL',class extends Base{static createObjectURL=vi.fn(blob=>{blobs.push(blob);return 'blob:personal-sheet';});static revokeObjectURL=vi.fn();});vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(){downloads.push(this.download);});});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const area=()=>within(screen.getByLabelText('Readable personal trial follow-up'));
const prepare=()=>fireEvent.click(area().getByRole('button',{name:'Prepare readable personal follow-up',exact:true}));
const ack=()=>area().getByLabelText('Acknowledge complete private personal follow-up HTML');
const download=()=>area().getByRole('button',{name:'Download readable personal follow-up HTML',exact:true});
const note=()=>screen.getByLabelText('Personal trial step 1 note');
function setup(){const choose=vi.fn();render(<div><input aria-label="Unrelated private source" defaultValue="OUTSIDE source content"/><input type="checkbox" aria-label="Unrelated consent" defaultChecked/><input type="range" aria-label="Unrelated replay" defaultValue="4"/><Guide onChoose={choose}/></div>);fireEvent.click(screen.getByText('Guided fabricated discussion trial (start here)'));fireEvent.click(screen.getByText('Save or resume personal trial follow-up'));return choose;}
const read=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsText(blob);});
it('requires prepare, full escaped preview and independent one-use HTML consent without using the JSON consent',async()=>{
 const choose=setup();expect(area().queryByLabelText('Readable personal follow-up preview')).toBeNull();expect(downloads).toEqual([]);fireEvent.change(note(),{target:{value:'PRIVATE <b>literal</b>\nsecond line'}});fireEvent.click(screen.getByLabelText('Flag trial step 3 for follow-up'));fireEvent.click(screen.getByLabelText('Acknowledge private personal follow-up download'));prepare();expect(download().disabled).toBe(true);expect(area().getByLabelText('Readable personal follow-up preview').textContent).toContain('PRIVATE <b>literal</b>');expect(document.querySelector('b,script,img')).toBeNull();expect(area().getAllByText(/Neither means complete/)).toHaveLength(5);expect(blobs).toEqual([]);
 fireEvent.click(ack());fireEvent.click(download());expect(download().disabled).toBe(true);expect(ack().checked).toBe(false);expect(downloads).toEqual(['skydash-personal-trial-followup.html']);const html=await read(blobs[0]);expect(html).toContain('PRIVATE &lt;b&gt;literal&lt;/b&gt;');expect(html).not.toContain('OUTSIDE source content');expect(html).not.toContain('<script');expect(choose).not.toHaveBeenCalled();expect(screen.getByLabelText('Unrelated consent').checked).toBe(true);expect(screen.getByLabelText('Unrelated replay').value).toBe('4');
});
it.each(['note','flag','clear flags','clear notes','prepare again'])('a %s change clears old HTML authority even after returning to the old personal value',mode=>{
 setup();prepare();fireEvent.click(ack());if(mode==='note'){fireEvent.change(note(),{target:{value:'temporary'}});fireEvent.change(note(),{target:{value:''}});}else if(mode==='flag'){const f=screen.getByLabelText('Flag trial step 2 for follow-up');fireEvent.click(f);fireEvent.click(f);}else if(mode==='prepare again'){prepare();expect(download().disabled).toBe(true);expect(ack().checked).toBe(false);return;}else fireEvent.click(screen.getByRole('button',{name:mode==='clear flags'?'Clear only personal trial flags':'Clear only personal trial notes'}));expect(area().queryByLabelText('Readable personal follow-up preview')).toBeNull();expect(downloads).toEqual([]);
});
it('selecting any saved JSON clears the prepared sheet immediately and disables preparation during its pending read',()=>{
 setup();prepare();fireEvent.click(ack());const f=new File(['pending'],'pending.json');Object.defineProperty(f,'arrayBuffer',{value:()=>new Promise(()=>{})});fireEvent.change(screen.getByLabelText('Import personal trial follow-up JSON'),{target:{files:[f]}});expect(area().queryByLabelText('Readable personal follow-up preview')).toBeNull();expect(area().getByRole('button',{name:'Prepare readable personal follow-up',exact:true}).disabled).toBe(true);expect(downloads).toEqual([]);
});
