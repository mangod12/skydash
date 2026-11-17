// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTelemetry } from './useTelemetry';
import { telemetrySocketUrl } from '../utils/telemetrySocketUrl';
import { apiFetch } from '../utils/api';
import { useTelemetryStore } from '../stores/telemetryStore';

vi.mock('../utils/runtimeConfig', () => ({ API_BASE: 'https://test', API_CONFIGURED: true, WS_BASE: 'wss://test', WS_CONFIGURED: true }));
vi.mock('../utils/telemetrySocketUrl', () => ({ telemetrySocketUrl: vi.fn() }));
vi.mock('../utils/api', () => ({ apiFetch: vi.fn() }));

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances = [];
  readyState = 0;
  constructor(url) { this.url = url; FakeSocket.instances.push(this); }
  close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  telemetrySocketUrl.mockResolvedValue('wss://test/ws/telemetry?ticket=one');
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const settle = async () => { await act(async () => { await Promise.resolve(); }); };

describe('telemetry connection lifecycle', () => {
  it('does not open a socket when a ticket resolves after unmount', async () => {
    let resolve;
    telemetrySocketUrl.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { unmount } = renderHook(() => useTelemetry());
    unmount();
    await act(async () => { resolve('wss://test?ticket=late'); });
    expect(FakeSocket.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels reconnect and HTTP polling on unmount', async () => {
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    const socket = FakeSocket.instances[0];
    act(() => socket.onclose());
    expect(vi.getTimerCount()).toBe(2);
    unmount();
    expect(socket.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(telemetrySocketUrl).toHaveBeenCalledOnce();
  });

  it('ignores ticket rejection after unmount without starting fallback', async () => {
    let reject;
    telemetrySocketUrl.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    const { unmount } = renderHook(() => useTelemetry());
    unmount();
    await act(async () => { reject(new Error('late network failure')); });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not overlap slow HTTP fallback requests', async () => {
    let resolvePoll;
    apiFetch.mockReturnValue(new Promise((resolve) => { resolvePoll = resolve; }));
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    act(() => FakeSocket.instances[0].close());
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(apiFetch).toHaveBeenCalledOnce();
    await act(async () => { resolvePoll({ ok: true, json: async () => ({ data: [] }) }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(apiFetch).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('ignores an HTTP response after the WebSocket has recovered', async () => {
    let resolvePoll;
    apiFetch.mockReturnValue(new Promise((resolve) => { resolvePoll = resolve; }));
    const update = vi.spyOn(useTelemetryStore.getState(), 'updateTelemetry');
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    act(() => FakeSocket.instances[0].close());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    act(() => FakeSocket.instances[1].onopen());
    await act(async () => {
      resolvePoll({ ok: true, json: async () => ({ data: { drone_id: 'stale-http', altitude: 123 } }) });
    });
    expect(update).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });

  it('still retries an active connection and stops polling on open', async () => {
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    act(() => FakeSocket.instances[0].close());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(telemetrySocketUrl).toHaveBeenCalledTimes(2);
    expect(FakeSocket.instances).toHaveLength(2);
    act(() => FakeSocket.instances[1].onopen());
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });
});
