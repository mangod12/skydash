import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePlaybackStore } from './playbackStore';

const snaps = [0, 1000, 2000, 3000, 4000].map((timestamp) => ({ timestamp, positions: [] }));

describe('playbackStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePlaybackStore.getState().stop();
    usePlaybackStore.setState({ history: [], active: false, speed: 1, currentTime: 0, startTime: 0, endTime: 0 });
  });

  afterEach(() => {
    usePlaybackStore.getState().pause();
    vi.useRealTimers();
  });

  it('loads history and sets the range', () => {
    usePlaybackStore.getState().loadHistory(snaps);
    const s = usePlaybackStore.getState();
    expect([s.startTime, s.endTime, s.currentTime, s.active]).toEqual([0, 4000, 0, true]);
  });

  it('ignores empty history', () => {
    usePlaybackStore.getState().loadHistory([]);
    expect(usePlaybackStore.getState().active).toBe(false);
  });

  it.each([[], null, undefined, {}])('preserves a running replay when history is invalid: %j', (data) => {
    const store = usePlaybackStore.getState();
    store.loadHistory(snaps);
    store.play();
    const timer = usePlaybackStore.getState().intervalId;
    vi.advanceTimersByTime(1000);
    store.loadHistory(data);
    const state = usePlaybackStore.getState();
    expect(state.history).toBe(snaps);
    expect(state.isPlaying).toBe(true);
    expect(state.intervalId).toBe(timer);
    expect(state.currentTime).toBe(1000);
    vi.advanceTimersByTime(1000);
    expect(usePlaybackStore.getState().currentTime).toBe(2000);
  });

  it('replaces a running replay and cancels its old timer', () => {
    const store = usePlaybackStore.getState();
    store.loadHistory(snaps);
    store.play();
    const replacement = [{ timestamp: 5000, positions: [] }, { timestamp: 6000, positions: [] }];
    store.loadHistory(replacement);
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
    expect(usePlaybackStore.getState().intervalId).toBeNull();
    vi.advanceTimersByTime(2000);
    expect(usePlaybackStore.getState().currentTime).toBe(5000);
    expect(usePlaybackStore.getState().history).toBe(replacement);
  });

  it('builds a 5 minute demo history', () => {
    usePlaybackStore.getState().loadDemo();
    const s = usePlaybackStore.getState();
    expect(s.history).toHaveLength(301);
    expect(s.history[0].positions).toHaveLength(3);
    expect(s.endTime - s.startTime).toBe(300000);
  });

  it('advances while playing, honours speed, and stops at the end', () => {
    const store = usePlaybackStore.getState();
    store.loadHistory(snaps);
    store.setSpeed(2);
    store.play();
    expect(usePlaybackStore.getState().isPlaying).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(usePlaybackStore.getState().currentTime).toBe(2000);
    vi.advanceTimersByTime(5000);
    const s = usePlaybackStore.getState();
    expect(s.currentTime).toBe(4000);
    expect(s.isPlaying).toBe(false);
    expect(s.intervalId).toBeNull();
  });

  it('does not play without history, and pause keeps the position', () => {
    usePlaybackStore.getState().play();
    expect(usePlaybackStore.getState().isPlaying).toBe(false);
    usePlaybackStore.getState().loadHistory(snaps);
    usePlaybackStore.getState().play();
    vi.advanceTimersByTime(2000);
    usePlaybackStore.getState().pause();
    expect(usePlaybackStore.getState().currentTime).toBe(2000);
    vi.advanceTimersByTime(3000);
    expect(usePlaybackStore.getState().currentTime).toBe(2000);
  });

  it('restarts from the beginning when played at the end', () => {
    const store = usePlaybackStore.getState();
    store.loadHistory(snaps);
    store.seek(4000);
    store.play();
    expect(usePlaybackStore.getState().currentTime).toBe(0);
  });

  it('clamps seek and returns the closest earlier snapshot', () => {
    const store = usePlaybackStore.getState();
    store.loadHistory(snaps);
    store.seek(99999);
    expect(usePlaybackStore.getState().currentTime).toBe(4000);
    store.seek(-5);
    expect(usePlaybackStore.getState().currentTime).toBe(0);
    store.seek(2500);
    expect(usePlaybackStore.getState().getCurrentSnapshot().timestamp).toBe(2000);
  });

  it('returns null snapshot with no history and stop resets', () => {
    expect(usePlaybackStore.getState().getCurrentSnapshot()).toBeNull();
    const store = usePlaybackStore.getState();
    store.loadHistory(snaps);
    store.seek(3000);
    store.stop();
    const s = usePlaybackStore.getState();
    expect([s.currentTime, s.active, s.isPlaying]).toEqual([0, false, false]);
  });
});
