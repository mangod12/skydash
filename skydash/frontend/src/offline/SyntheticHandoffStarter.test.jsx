// @vitest-environment jsdom
import {afterEach,expect,it,vi}from'vitest';
import{cleanup,render,screen,fireEvent,waitFor}from'@testing-library/react';
import SyntheticHandoffStarter from './SyntheticHandoffStarter';
import{browserSyntheticTrainingStarter}from'../utils/browserSyntheticTrainingStarter';
vi.mock('../utils/browserSyntheticTrainingStarter',()=>({browserSyntheticTrainingStarter:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();vi.restoreAllMocks();vi.unstubAllGlobals();});
const prepare=()=>screen.getByRole('button',{name:'Prepare fixed synthetic handoff starter'}),download=()=>screen.getByRole('button',{name:'Download synthetic starter ZIP'}),result={bytes:new Uint8Array([80,75]),html:'PRIVATE',archiveDigest:'a'.repeat(64),fileCount:7,bundleCount:3};
it('takes no input files and prepares only fixed examples without opening, rendering generated HTML or downloading automatically',async()=>{
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{}),create=vi.fn(()=>'blob:local');vi.stubGlobal('URL',Object.assign(class extends URL{},{createObjectURL:create,revokeObjectURL:vi.fn()}));browserSyntheticTrainingStarter.mockResolvedValue(result);const {container}=render(<SyntheticHandoffStarter/>);expect(container.querySelectorAll('input')).toHaveLength(0);expect(download().disabled).toBe(true);fireEvent.click(prepare());await waitFor(()=>expect(download().disabled).toBe(false));expect(browserSyntheticTrainingStarter).toHaveBeenCalledWith();expect(click).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();expect(screen.queryByText('PRIVATE')).toBeNull();fireEvent.click(download());expect(click.mock.instances[0].download).toBe('skydash-synthetic-training-starter.zip');expect(create.mock.calls[0][0].type).toBe('application/zip');
});
it('locks local controls during prepare and refuses failed generations with no partial ZIP/private diagnostics',async()=>{
  let reject;browserSyntheticTrainingStarter.mockImplementation(()=>new Promise((_yes,no)=>{reject=no}));render(<SyntheticHandoffStarter/>);fireEvent.click(prepare());expect(prepare().disabled).toBe(true);expect(download().disabled).toBe(true);expect(screen.getByRole('button',{name:'Clear synthetic starter'}).disabled).toBe(true);reject(Error('PRIVATE path'));await waitFor(()=>expect(prepare().disabled).toBe(false));expect(download().disabled).toBe(true);expect(screen.getByRole('status').textContent).toContain('failed');expect(screen.queryByText('PRIVATE path')).toBeNull();
});
it('clear drops only synthetic result and a fresh preparation invalidates the old download',async()=>{
  browserSyntheticTrainingStarter.mockResolvedValue(result);render(<SyntheticHandoffStarter/>);fireEvent.click(prepare());await waitFor(()=>expect(download().disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'Clear synthetic starter'}));expect(download().disabled).toBe(true);expect(screen.getByRole('status').textContent).toContain('replay workspace unchanged');fireEvent.click(prepare());await waitFor(()=>expect(download().disabled).toBe(false));let resolve;browserSyntheticTrainingStarter.mockImplementation(()=>new Promise(yes=>{resolve=yes}));fireEvent.click(prepare());expect(download().disabled).toBe(true);resolve(result);await waitFor(()=>expect(download().disabled).toBe(false));
});
