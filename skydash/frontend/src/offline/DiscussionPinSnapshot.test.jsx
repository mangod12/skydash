// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
const {deferred}=vi.hoisted(()=>({deferred:{current:null}}));
// Model React restoring the controlled DOM value before a queued functional
// update runs. Reading a live event target from that updater loses the edit.
vi.mock('react',async original=>{const actual=await original();return {...actual,useState(initial){const[state,setState]=actual.useState(initial);return[state,update=>setState(old=>{if(typeof update==='function'){deferred.current?.();return update(old);}return update;})];}};});
vi.mock('../utils/checkDiscussionOriginalsArchive',()=>({checkDiscussionOriginalsArchive:vi.fn(),selectedDiscussionArchiveOriginal:vi.fn(),privateDiscussionArchivePacket:vi.fn(),prepareReceivedChecklistCombination:vi.fn()}));
vi.mock('../utils/discussionIntake',()=>({checkDiscussionIntake:vi.fn()}));
import Receiver from './ReceivedDiscussionOriginals';
import Intake from './DiscussionIntake';
afterEach(()=>{deferred.current=null;cleanup();vi.resetAllMocks();});
it.each(['archive','source','checklist','instructor'])('receiver %s keeps the user edit even when live DOM is restored before the functional updater executes',name=>{render(<Receiver/>);const field=screen.getByLabelText('Received discussion '+name+' expected SHA-256'),next='F'.repeat(64);deferred.current=()=>{field.value='a'.repeat(64);};fireEvent.change(field,{target:{value:next}});expect(field.value).toBe(next);});
it.each(['archive','source','checklist','instructor'])('intake %s keeps the user edit even when live DOM is restored before the functional updater executes',name=>{render(<Intake/>);fireEvent.change(screen.getByLabelText('Discussion intake ZIP files'),{target:{files:[new File(['synthetic'],'fixture.zip')]}});const field=screen.getByLabelText('Intake input 1 '+name+' expected SHA-256'),next='E'.repeat(64);deferred.current=()=>{field.value='b'.repeat(64);};fireEvent.change(field,{target:{value:next}});expect(field.value).toBe(next);});

import Combination from './ChecklistCombination';
it.each(['source','left','right'])('whole checklist combination original %s expectation survives deferred DOM restoration',role=>{render(<Combination/>);const field=screen.getByLabelText('Checklist combination '+role+' expected SHA-256'),next='D'.repeat(64);deferred.current=()=>{field.value='c'.repeat(64);};fireEvent.change(field,{target:{value:next}});expect(field.value).toBe(next);});
it.each(['left','right'].flatMap(side=>['archive','source','checklist','instructor'].map(role=>[side,role])))('whole checklist combination %s ZIP %s expectation survives deferred DOM restoration', (side,role)=>{render(<Combination/>);fireEvent.change(screen.getByLabelText('Checklist combination input route'),{target:{value:'discussion'}});const field=screen.getByLabelText('Checklist combination '+side+' discussion '+role+' expected SHA-256'),next='C'.repeat(64);deferred.current=()=>{field.value='d'.repeat(64);};fireEvent.change(field,{target:{value:next}});expect(field.value).toBe(next);});
