// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLinkAlerts, LINK_LOSS_DELAY_MS } from './useLinkAlerts';
import { useTelemetryStore } from '../stores/telemetryStore';
import { notify } from '../stores/notificationStore';

vi.mock('../stores/notificationStore', () => ({ notify: vi.fn() }));
vi.mock('../utils/runtimeConfig', () => ({ BACKEND_CONFIGURED: true }));

const set = (patch) => act(() => { useTelemetryStore.setState(patch); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(notify).mockReset();
  useTelemetryStore.setState({ isConnected: true, hasEverConnected: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useLinkAlerts', () => {
  it('raises a critical alert after the debounce and a restore notice with downtime', () => {
    renderHook(() => useLinkAlerts());
    set({ isConnected: false });
    act(() => { vi.advanceTimersByTime(LINK_LOSS_DELAY_MS - 1); });
    expect(notify).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({ type: 'alert', severity: 'critical', title: 'Telemetry link lost' });
    act(() => { vi.advanceTimersByTime(65000); });
    set({ isConnected: true });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls[1][0]).toMatchObject({ type: 'system', severity: 'info', title: 'Telemetry link restored' });
    expect(notify.mock.calls[1][0].message).toContain('1m 05s');
  });

  it('stays silent when the link recovers inside the debounce', () => {
    renderHook(() => useLinkAlerts());
    set({ isConnected: false });
    act(() => { vi.advanceTimersByTime(2000); });
    set({ isConnected: true });
    act(() => { vi.advanceTimersByTime(10000); });
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays silent if the link never connected', () => {
    useTelemetryStore.setState({ isConnected: true, hasEverConnected: false });
    renderHook(() => useLinkAlerts());
    set({ isConnected: false });
    act(() => { vi.advanceTimersByTime(20000); });
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not raise a second alert for repeated disconnect events and cleans up on unmount', () => {
    const { unmount } = renderHook(() => useLinkAlerts());
    set({ isConnected: false });
    act(() => { vi.advanceTimersByTime(6000); });
    set({ isConnected: false });
    act(() => { vi.advanceTimersByTime(20000); });
    expect(notify).toHaveBeenCalledTimes(1);
    unmount();
    set({ isConnected: true });
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
