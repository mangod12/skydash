// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAlertEngine } from './useAlertEngine';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useAlertRulesStore } from '../stores/alertRulesStore';
import { evaluateRule } from '../utils/alertEvaluator';
import { notify } from '../stores/notificationStore';

vi.mock('../utils/alertEvaluator', () => ({ evaluateRule: vi.fn() }));
vi.mock('../stores/notificationStore', () => ({ notify: vi.fn() }));
const originalRules = useAlertRulesStore.getState().rules;

beforeEach(() => {
  vi.resetAllMocks();
  useTelemetryStore.setState({ data: null, fleet: [] });
  useAlertRulesStore.setState({ rules: [{
    id: 'test', name: 'Battery alert', enabled: true, severity: 'critical',
    cooldownMs: 0, lastTriggered: 0,
  }] });
  evaluateRule.mockReturnValue({ triggered: false });
});
afterEach(() => { cleanup(); useAlertRulesStore.setState({ rules: originalRules }); });

describe('alert frame detection', () => {
  it('evaluates fresh fleet snapshots without selected-drone telemetry', () => {
    renderHook(() => useAlertEngine());
    const drone = { drone_id: 'one', battery_percentage: 10 };
    evaluateRule.mockReturnValue({ triggered: true, message: 'Low battery' });
    act(() => useTelemetryStore.getState().updateFleet([drone]));
    expect(evaluateRule).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'Low battery' }));
    act(() => useTelemetryStore.getState().setLatency(20));
    act(() => useTelemetryStore.getState().setDisconnected());
    expect(evaluateRule).toHaveBeenCalledOnce();
    act(() => useTelemetryStore.getState().updateFleet([{ ...drone, battery_percentage: 5 }]));
    expect(evaluateRule).toHaveBeenCalledTimes(2);
  });

  it('evaluates changed telemetry even when timestamps repeat', () => {
    renderHook(() => useAlertEngine());
    act(() => useTelemetryStore.getState().updateTelemetry({ drone_id: 'one', timestamp: 123, battery_percentage: 90 }, 0));
    act(() => useTelemetryStore.getState().updateTelemetry({ drone_id: 'one', timestamp: 123, battery_percentage: 10 }, 0));
    expect(evaluateRule).toHaveBeenCalledTimes(2);
    expect(evaluateRule.mock.calls[1][1].battery_percentage).toBe(10);
  });

  it('keeps rule cooldowns and unsubscribes on unmount', () => {
    useAlertRulesStore.setState({ rules: [{ ...useAlertRulesStore.getState().rules[0], cooldownMs: 60000 }] });
    evaluateRule.mockReturnValue({ triggered: true, message: 'Low battery' });
    const { unmount } = renderHook(() => useAlertEngine());
    act(() => useTelemetryStore.getState().updateFleet([{ drone_id: 'one' }]));
    act(() => useTelemetryStore.getState().updateFleet([{ drone_id: 'one' }]));
    expect(notify).toHaveBeenCalledOnce();
    unmount();
    act(() => useTelemetryStore.getState().updateFleet([{ drone_id: 'two' }]));
    expect(notify).toHaveBeenCalledOnce();
  });
});
