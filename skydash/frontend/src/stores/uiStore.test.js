import { afterEach, describe, expect, it } from 'vitest';
import { useUIStore } from './uiStore';
const initial = useUIStore.getState();
afterEach(() => useUIStore.setState(initial, true));
describe('recorded review scope is transient navigation state', () => {
  it('starts off and resets on a view change or workspace change', () => {
    expect(useUIStore.getState().recordedReviewOpen).toBe(false); useUIStore.getState().setRecordedReviewOpen(true); expect(useUIStore.getState().recordedReviewOpen).toBe(true);
    useUIStore.getState().setActiveView('map'); expect(useUIStore.getState().recordedReviewOpen).toBe(false);
    useUIStore.getState().setRecordedReviewOpen(true); useUIStore.getState().setWorkspace('analyst'); expect(useUIStore.getState().recordedReviewOpen).toBe(false);
  });
});

describe('source-open recorded exit requests', () => {
  const open = () => useUIStore.setState({ activeView: 'scenario', workspace: 'operator', recordedReviewOpen: true, recordedSourceOpen: true });
  it('queues view/workspace navigation without changing the current scope and cancels safely', () => {
    open(); useUIStore.getState().setActiveView('map'); expect(useUIStore.getState().pendingRecordedExit).toEqual({ kind: 'view', value: 'map' }); expect(useUIStore.getState().activeView).toBe('scenario'); expect(useUIStore.getState().recordedReviewOpen).toBe(true);
    useUIStore.getState().cancelRecordedExit(); expect(useUIStore.getState().pendingRecordedExit).toBeNull(); expect(useUIStore.getState().recordedSourceOpen).toBe(true);
    useUIStore.getState().setWorkspace('analyst'); expect(useUIStore.getState().workspace).toBe('operator'); expect(useUIStore.getState().pendingRecordedExit).toEqual({ kind: 'workspace', value: 'analyst' });
  });
  it('ignores same-view/workspace selections and commits only the latest requested destination', () => {
    open(); useUIStore.getState().setActiveView('scenario'); useUIStore.getState().setWorkspace('operator'); expect(useUIStore.getState().pendingRecordedExit).toBeNull(); expect(useUIStore.getState().recordedReviewOpen).toBe(true);
    useUIStore.getState().setActiveView('map'); useUIStore.getState().setActiveView('telemetry'); expect(useUIStore.getState().confirmRecordedExit()).toBe('view'); expect(useUIStore.getState().activeView).toBe('telemetry'); expect(useUIStore.getState().recordedReviewOpen).toBe(false); expect(useUIStore.getState().recordedSourceOpen).toBe(false); expect(useUIStore.getState().confirmRecordedExit()).toBeNull();
  });
  it('confirms the existing workspace defaults without deferring sign-out or changing authentication', () => {
    open(); useUIStore.getState().setWorkspace('commander'); expect(useUIStore.getState().confirmRecordedExit()).toBe('workspace'); expect(useUIStore.getState()).toMatchObject({ workspace: 'commander', activeView: 'dashboard', notificationOpen: true, sidebarOpen: true, recordedSourceOpen: false, pendingRecordedExit: null });
  });
  it('returns back intent only once and drops a pending request when the source guard is removed', () => {
    open(); useUIStore.getState().requestRecordedBack(); expect(useUIStore.getState().confirmRecordedExit()).toBe('back'); expect(useUIStore.getState().activeView).toBe('scenario'); expect(useUIStore.getState().confirmRecordedExit()).toBeNull();
    open(); useUIStore.getState().setActiveView('map'); useUIStore.getState().setRecordedSourceOpen(false); expect(useUIStore.getState().pendingRecordedExit).toBeNull(); useUIStore.getState().setActiveView('map'); expect(useUIStore.getState().activeView).toBe('map');
  });
});

it('keeps existing unguarded same-workspace reset behavior outside a loaded recorded session', () => {
  useUIStore.setState({ workspace: 'operator', activeView: 'map', recordedSourceOpen: false }); useUIStore.getState().setWorkspace('operator'); expect(useUIStore.getState().activeView).toBe('dashboard');
});
