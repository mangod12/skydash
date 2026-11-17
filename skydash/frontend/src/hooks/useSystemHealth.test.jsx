// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSystemHealth } from './useSystemHealth';
import { useTelemetryStore } from '../stores/telemetryStore';

vi.mock('../utils/runtimeConfig', () => ({ API_BASE: '', API_CONFIGURED: false }));
const frame = { drone_id: 'one', timestamp: 123, battery_voltage: 16, altitude: 20 };

beforeEach(() => {
  vi.useFakeTimers();
  useTelemetryStore.setState({ data: null, history: [], fleet: [], isConnected: false });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
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
