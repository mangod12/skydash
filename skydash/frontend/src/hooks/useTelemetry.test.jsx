// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTelemetry } from './useTelemetry';
import { telemetrySocketUrl } from '../utils/telemetrySocketUrl';
import { apiFetch } from '../utils/api';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useMapStore } from '../stores/mapStore';

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
  useTelemetryStore.setState({ data: null, fleet: [], history: [], isConnected: false, lastUpdate: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const settle = async () => { await act(async () => { await Promise.resolve(); }); };

describe('telemetry connection lifecycle', () => {
  it('replaces fleet membership when snapshots shrink to one or zero drones', async () => {
    useTelemetryStore.setState({ fleet: [], activeDroneId: null });
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    const socket = FakeSocket.instances[0];
    const drone = (id) => ({ drone_id: id, altitude: 50, battery_voltage: 16 });
    const send = (data) => act(() => socket.onmessage({ data: JSON.stringify({ type: 'telemetry', data }) }));
    send([drone('one'), drone('two')]);
    expect(useTelemetryStore.getState().fleet.map((d) => d.drone_id)).toEqual(['one', 'two']);
    send([drone('two')]);
    expect(useTelemetryStore.getState().fleet.map((d) => d.drone_id)).toEqual(['two']);
    expect(useTelemetryStore.getState().activeDroneId).toBe('two');
    send([]);
    expect(useTelemetryStore.getState().fleet).toEqual([]);
    unmount();
  });

  it('keeps map trails separate and clears them on an authoritative empty snapshot', async () => {
    useTelemetryStore.setState({ fleet: [], activeDroneId: null, data: null, history: [] });
    useMapStore.getState().clearDronePosition();
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    const send = (data) => act(() => FakeSocket.instances[0].onmessage({ data: JSON.stringify({ type: 'telemetry', data }) }));
    const frame = (id, lat) => ({ drone_id: id, altitude: 50, gps: { latitude: lat, longitude: 30 } });
    send([frame('one', 20)]);
    send([frame('one', 21)]);
    expect(useMapStore.getState().flightPath).toHaveLength(2);
    expect(useMapStore.getState().dronePosition.heading).toBeUndefined();
    send([frame('two', 40)]);
    expect(useMapStore.getState().flightPath).toHaveLength(1);
    expect(useMapStore.getState().dronePosition.droneId).toBe('two');
    send([]);
    expect(useMapStore.getState().dronePosition).toBeNull();
    expect(useMapStore.getState().flightPath).toEqual([]);
    unmount();
  });

  it('updates single-drone fleet membership through HTTP fallback too', async () => {
    useTelemetryStore.setState({ fleet: [{ drone_id: 'removed' }], activeDroneId: 'removed' });
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [{ drone_id: 'remaining', altitude: 50 }] }) });
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    act(() => FakeSocket.instances[0].close());
    await settle();
    expect(useTelemetryStore.getState().fleet.map((d) => d.drone_id)).toEqual(['remaining']);
    expect(useTelemetryStore.getState().activeDroneId).toBe('remaining');
    unmount();
  });

  it('isolates malformed socket records without clearing or replacing valid telemetry', async () => {
    useTelemetryStore.setState({ fleet: [], activeDroneId: null, data: null, history: [] });
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    const send = (data) => act(() => FakeSocket.instances[0].onmessage({
      data: JSON.stringify({ type: 'telemetry', data }),
    }));
    send([null, { drone_id: 'valid', altitude: 25 }, false, {}, []]);
    expect(useTelemetryStore.getState().fleet.map((d) => d.drone_id)).toEqual(['valid']);
    expect(useTelemetryStore.getState().data.altitude).toBe(25);
    for (const malformed of [null, false, 'bad', {}, [null, {}, false]]) send(malformed);
    expect(useTelemetryStore.getState().fleet.map((d) => d.drone_id)).toEqual(['valid']);
    expect(useTelemetryStore.getState().data.altitude).toBe(25);
    expect(useTelemetryStore.getState().history).toHaveLength(1);
    send([]);
    expect(useTelemetryStore.getState().data).toBeNull();
    unmount();
  });

  it('applies the same record validation to HTTP fallback', async () => {
    useTelemetryStore.setState({ fleet: [], activeDroneId: null, data: null, history: [] });
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({
      data: [null, { drone_id: 'http-valid', altitude: 30 }, {}],
    }) });
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    act(() => FakeSocket.instances[0].close());
    await settle();
    expect(useTelemetryStore.getState().activeDroneId).toBe('http-valid');
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ success: false, error: 'unavailable' }) });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(useTelemetryStore.getState().data.drone_id).toBe('http-valid');
    expect(useTelemetryStore.getState().history).toHaveLength(1);
    unmount();
  });

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
    expect(vi.getTimerCount()).toBe(3);
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
    act(() => {
      FakeSocket.instances[1].onopen();
      FakeSocket.instances[1].onmessage({ data: JSON.stringify({ type: 'telemetry', data: [] }) });
    });
    await act(async () => {
      resolvePoll({ ok: true, json: async () => ({ data: { drone_id: 'stale-http', altitude: 123 } }) });
    });
    expect(update).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    unmount();
  });

  it('retries but keeps HTTP polling until the socket sends a valid frame', async () => {
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    act(() => FakeSocket.instances[0].close());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(telemetrySocketUrl).toHaveBeenCalledTimes(2);
    expect(FakeSocket.instances).toHaveLength(2);
    act(() => FakeSocket.instances[1].onopen());
    expect(vi.getTimerCount()).toBe(2);
    act(() => FakeSocket.instances[1].onmessage({ data: JSON.stringify({ type: 'telemetry', data: [] }) }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
  });

  it('expires a silent live socket, marks data offline and retries without losing the last reading', async () => {
    apiFetch.mockRejectedValue(new Error('offline'));
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    const socket = FakeSocket.instances[0];
    act(() => socket.onmessage({ data: JSON.stringify({ type: 'telemetry', data: { drone_id: 'last-known', altitude: 55 } }) }));
    expect(useTelemetryStore.getState().isConnected).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(useTelemetryStore.getState().isConnected).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(socket.close).toHaveBeenCalledOnce();
    expect(useTelemetryStore.getState().isConnected).toBe(false);
    expect(useTelemetryStore.getState().data.altitude).toBe(55);
    expect(apiFetch).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(FakeSocket.instances).toHaveLength(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('valid frames renew the watchdog but malformed frames and unrelated messages do not', async () => {
    apiFetch.mockRejectedValue(new Error('offline'));
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    const socket = FakeSocket.instances[0];
    const send = (payload) => act(() => socket.onmessage({ data: JSON.stringify(payload) }));
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    send({ type: 'telemetry', data: [] });
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(socket.close).not.toHaveBeenCalled();
    send({ type: 'telemetry', data: [null, {}] });
    send({ type: 'heartbeat' });
    act(() => socket.onmessage({ data: 'not-json' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(socket.close).toHaveBeenCalledOnce();
    unmount();
  });

  it('bounds a stalled socket connection even if onopen never fires', async () => {
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(FakeSocket.instances[0].close).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledOnce();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a ticket response that arrives after its connection attempt timed out', async () => {
    let resolveTicket;
    telemetrySocketUrl.mockReturnValueOnce(new Promise((resolve) => { resolveTicket = resolve; }));
    const { unmount } = renderHook(() => useTelemetry());
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(telemetrySocketUrl).toHaveBeenCalledTimes(2);
    expect(FakeSocket.instances).toHaveLength(1);
    await act(async () => { resolveTicket('wss://test?ticket=too-late'); });
    expect(FakeSocket.instances).toHaveLength(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let callbacks saved from a retired socket change a recovered stream', async () => {
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    const socket = FakeSocket.instances[0];
    const oldMessage = socket.onmessage;
    const oldClose = socket.onclose;
    act(() => socket.close());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    act(() => FakeSocket.instances[1].onmessage({ data: JSON.stringify({ type: 'telemetry', data: { drone_id: 'recovered' } }) }));
    act(() => {
      oldMessage({ data: JSON.stringify({ type: 'telemetry', data: { drone_id: 'retired' } }) });
      oldClose();
    });
    expect(useTelemetryStore.getState().data.drone_id).toBe('recovered');
    expect(useTelemetryStore.getState().isConnected).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
  });

  it('marks malformed HTTP snapshots offline instead of keeping a stale live indicator', async () => {
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    act(() => FakeSocket.instances[0].close());
    await settle();
    expect(useTelemetryStore.getState().isConnected).toBe(true);
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ success: false }) });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(useTelemetryStore.getState().isConnected).toBe(false);
    unmount();
  });


  it('aborts a timed-out HTTP read, marks data offline and ignores its late response', async () => {
    apiFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { drone_id: 'last-http', altitude: 33 } }) });
    let resolveLate;
    apiFetch.mockReturnValue(new Promise((resolve) => { resolveLate = resolve; }));
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    act(() => FakeSocket.instances[0].close());
    await settle();
    expect(useTelemetryStore.getState().isConnected).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    const requestSignal = apiFetch.mock.calls[1][1].signal;
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(requestSignal.aborted).toBe(true);
    expect(useTelemetryStore.getState().isConnected).toBe(false);
    await act(async () => { resolveLate({ ok: true, json: async () => ({ data: { drone_id: 'late-http' } }) }); });
    expect(useTelemetryStore.getState().data.drone_id).toBe('last-http');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts an outstanding HTTP request on unmount and discards its response', async () => {
    let resolvePoll;
    apiFetch.mockReturnValue(new Promise((resolve) => { resolvePoll = resolve; }));
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    act(() => FakeSocket.instances[0].close());
    const signal = apiFetch.mock.calls[0][1].signal;
    unmount();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { resolvePoll({ ok: true, json: async () => ({ data: { drone_id: 'unmounted' } }) }); });
    expect(useTelemetryStore.getState().data).toBeNull();
  });


  it('does not retain a previous drone map position when the new drone has unknown GPS', async () => {
    useMapStore.getState().clearDronePosition();
    const { unmount } = renderHook(() => useTelemetry());
    await settle();
    const send = data => act(() => FakeSocket.instances[0].onmessage({ data: JSON.stringify({ type: 'telemetry', data }) }));
    send([{ drone_id: 'one', gps: { latitude: 20, longitude: 30 }, altitude: 50 }]);
    expect(useMapStore.getState().dronePosition.droneId).toBe('one');
    send([{ drone_id: 'two', gps: { latitude: null, longitude: 40 } }]);
    expect(useTelemetryStore.getState().data.drone_id).toBe('two');
    expect(useMapStore.getState().dronePosition).toBeNull();
    expect(useMapStore.getState().flightPath).toEqual([]);
    send([{ drone_id: 'two', gps: { latitude: 0, longitude: 0 }, altitude: 'unknown', attitude: { yaw: 'north' } }]);
    expect(useMapStore.getState().dronePosition).toMatchObject({ lat: 0, lng: 0, alt: null, droneId: 'two' });
    expect(useMapStore.getState().dronePosition.heading).toBeUndefined();
    unmount();
  });

});
