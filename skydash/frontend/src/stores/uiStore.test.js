import { afterEach, describe, expect, it } from 'vitest';
import { useUIStore } from './uiStore';
const initial = useUIStore.getState();
afterEach(() => useUIStore.setState(initial, true));
describe('recorded review scope is transient navigation state', () => {
  it('starts off and resets on a view change or workspace change', () => {
    expect(useUIStore.getState().recordedReviewOpen).toBe(false); useUIStore.getState().setRecordedReviewOpen(true); expect(useUIStore.getState().recordedReviewOpen).toBe(true);
    useUIStore.getState().setActiveView('dashboard'); expect(useUIStore.getState().recordedReviewOpen).toBe(false);
    useUIStore.getState().setRecordedReviewOpen(true); useUIStore.getState().setWorkspace('analyst'); expect(useUIStore.getState().recordedReviewOpen).toBe(false);
  });
});
