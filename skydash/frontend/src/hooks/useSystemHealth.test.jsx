// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSystemHealth } from './useSystemHealth';
import { useTelemetryStore } from '../stores/telemetryStore';

const config = vi.hoisted(() => ({ API_BASE: 'https://test', API_CONFIGURED: false }));
vi.mock('../utils/runtimeConfig', () => config);
const frame = { drone_id: 'one', timestamp: 123, battery_voltage: 16, altitude: 20 };

beforeEach(() => {
  vi.useFakeTimers();
  config.API_CONFIGURED = false;
  useTelemetryStore.setState({ data: null, history: [], fleet: [], isConnected: false });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const advance = () => act(() => vi.advanceTimersByTime(1000));

describe('system health telemetry rate', () => {
  it('continues counting after telemetry history reaches capacity', () => {
    for (let i = 0; i < 200; i += 1) useTelemetryStore.getState().updateTelemetry(frame, 0);
    const { result } = renderHook(() => useSystemHealth());
    act(() => {
      for (let i = 0; i < 5; i += 1) useTelemetryStore.getState().updateTelemetry(frame, 0);
    });
    advance();
    expect(result.current.rateHistory.at(-1).v).toBe(5);
    expect(result.current.pipeline.dataPoints).toBe(200);
    advance();
    expect(result.current.rateHistory.at(-1).v).toBe(0);
  });

  it('counts a drone switch as a new frame, not negative history growth', () => {
    const { result } = renderHook(() => useSystemHealth());
    act(() => {
      useTelemetryStore.getState().updateTelemetry(frame, 0);
      useTelemetryStore.getState().updateTelemetry(frame, 0);
      useTelemetryStore.getState().updateTelemetry({ ...frame, drone_id: 'two' }, 0);
      useTelemetryStore.getState().setLatency(10);
      useTelemetryStore.getState().setDisconnected();
    });
    advance();
    expect(result.current.rateHistory.at(-1).v).toBe(3);
    expect(result.current.pipeline.dataPoints).toBe(1);
  });
});

describe('backend health uptime freshness', () => {
  it.each(['http', 'network', 'json', 'missing', 'negative', 'string', 'nonfinite'])(
    'clears old backend uptime after %s failure and recovers', async (kind) => {
      config.API_CONFIGURED = true;
      const good = () => Promise.resolve({ ok: true, json: async () => ({ uptime: 123 }) });
      const fetchMock = vi.fn(good);
      vi.stubGlobal('fetch', fetchMock);
      const { result } = renderHook(() => useSystemHealth());
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(result.current.uptime.backend).toBe(123);
      if (kind === 'network') fetchMock.mockRejectedValueOnce(new Error('offline'));
      else if (kind === 'http') fetchMock.mockResolvedValueOnce({ ok: false });
      else if (kind === 'json') fetchMock.mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('bad JSON'); } });
      else {
        const uptime = { negative: -1, string: '123', nonfinite: Infinity }[kind];
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ uptime }) });
      }
      await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
      expect(result.current.uptime.backend).toBeNull();
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ uptime: 0 }) });
      await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
      expect(result.current.uptime.backend).toBe(0);
    },
  );
});

describe('health drone presence counts', () => {
  it('does not invent an active drone from a connected empty fleet', () => {
    const { result } = renderHook(() => useSystemHealth());
    act(() => useTelemetryStore.getState().updateFleet([]));
    expect(result.current.pipeline.activeDrones).toBe(0);
    expect(result.current.pipeline.total).toBe(0);
    expect(result.current.status).toBe('degraded');
  });

  it('counts disarmed fleet members as present but not active', () => {
    const { result } = renderHook(() => useSystemHealth());
    act(() => useTelemetryStore.getState().updateFleet([
      { drone_id: 'one', is_armed: false }, { drone_id: 'two', is_armed: false },
    ]));
    expect(result.current.pipeline.activeDrones).toBe(0);
    expect(result.current.pipeline.total).toBe(2);
    expect(result.current.status).toBe('degraded');
    act(() => useTelemetryStore.getState().updateFleet([
      { drone_id: 'one', is_armed: true }, { drone_id: 'two', is_armed: false },
    ]));
    expect(result.current.pipeline.activeDrones).toBe(1);
    expect(result.current.pipeline.total).toBe(2);
    expect(result.current.status).toBe('healthy');
  });

  it('supports single-record telemetry without inferring presence from connectivity', () => {
    const { result } = renderHook(() => useSystemHealth());
    act(() => useTelemetryStore.getState().updateTelemetry({ ...frame, is_armed: false }, 0));
    expect(result.current.pipeline.activeDrones).toBe(0);
    expect(result.current.pipeline.total).toBe(1);
    act(() => useTelemetryStore.getState().updateTelemetry({ ...frame, is_armed: true }, 0));
    expect(result.current.pipeline.activeDrones).toBe(1);
  });
});
