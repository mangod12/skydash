import { expect,it,afterEach,vi } from 'vitest';
import { useActivityStore,logActivity } from './activityStore';
afterEach(()=>{useActivityStore.setState({activities:[],filter:'all'});vi.useRealTimers();});
it('starts without fabricated incidents, login history, timestamps or mission activity',()=>{expect(useActivityStore.getState().activities).toEqual([]);});
it('keeps explicitly added session records with category, details, filters and clear without inventing events',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-20T17:15:00Z'));logActivity('system','Explicit test action','Explicit local detail',{severity:'info'});const s=useActivityStore.getState(),a=s.activities[0];expect(s.activities).toHaveLength(1);expect(a.timestamp).toBe(Date.now());expect(a.category).toBe('system');expect(a.action).toBe('Explicit test action');expect(a.detail).toBe('Explicit local detail');expect(a.icon).toBe('Settings');s.setFilter('alert');expect(s.getFiltered()).toEqual([]);s.setFilter('all');expect(s.getFiltered()).toEqual([a]);vi.advanceTimersByTime(120000);expect(s.getFiltered()).toEqual([a]);s.clear();expect(s.getFiltered()).toEqual([]);
});
it('bounds only explicit session additions to the newest500records',()=>{for(let i=0;i<501;i++)logActivity('telemetry','Explicit '+i,'');const a=useActivityStore.getState().activities;expect(a).toHaveLength(500);expect(a[0].action).toBe('Explicit 500');expect(a.at(-1).action).toBe('Explicit 1');});
