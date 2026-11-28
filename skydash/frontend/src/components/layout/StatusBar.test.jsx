// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

const { cfg } = vi.hoisted(() => ({ cfg: { v: true } }));
vi.mock('../../utils/runtimeConfig', async (orig) => ({
  ...(await orig()),
  get BACKEND_CONFIGURED() { return cfg.v; },
}));
vi.mock('../common/StatusBadge', () => ({ default: ({ label }) => <span data-testid="badge">{label}</span> }));
vi.mock('../common/SystemHealth', () => ({ default: () => <div data-testid="health" /> }));
vi.mock('../common/SystemPulse', () => ({ default: () => null }));
vi.mock('../common/FreshnessIndicator', () => ({ default: () => null }));

import StatusBar from './StatusBar';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useUIStore } from '../../stores/uiStore';
import { useMissionStore } from '../../stores/missionStore';

const set = (t = {}, ui = {}, m = {}) => {
  useTelemetryStore.setState({ data: null, isConnected: false, latency: 0, lastUpdate: null, hasEverConnected: false, ...t });
  useUIStore.setState({ isMobile: false, ...ui });
  useMissionStore.setState({ missions: [], activeMissionId: null, ...m });
};

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-03-01T10:00:00Z')); cfg.v = true; set(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('StatusBar', () => {
  it('reads WAKING UP during the first minute, then OFFLINE', () => {
    render(<StatusBar />);
    expect(screen.getByTestId('badge').textContent).toBe('WAKING UP');
    expect(screen.getByText('BACKEND STARTING')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(65000); });
    expect(screen.getByTestId('badge').textContent).toBe('OFFLINE');
  });

  it('after a prior connection a drop is OFFLINE straight away', () => {
    set({ hasEverConnected: true });
    render(<StatusBar />);
    expect(screen.getByTestId('badge').textContent).toBe('OFFLINE');
  });

  it('shows latency, signal bars, coordinates and satellites when connected', () => {
    set({ isConnected: true, hasEverConnected: true, latency: 75, data: { gps: { latitude: 12.3456789, longitude: 77.1, satellites: 9 } } });
    render(<StatusBar />);
    expect(screen.getByTestId('badge').textContent).toBe('CONNECTED');
    expect(screen.getByText('75ms')).toBeTruthy();
    expect(screen.getByLabelText('Signal quality: 4 of 5 bars')).toBeTruthy();
    expect(screen.getByText('12.345679, 77.100000')).toBeTruthy();
    expect(screen.getByText('9 SATS')).toBeTruthy();
  });

  it('placeholders when no GPS data', () => {
    render(<StatusBar />);
    expect(screen.getByText('--, --')).toBeTruthy();
    expect(screen.getByText('-- SATS')).toBeTruthy();
  });

  it('static demo mode has no backend wording and a disabled link button', () => {
    cfg.v = false;
    render(<StatusBar />);
    expect(screen.getByTestId('badge').textContent).toBe('STATIC DEMO');
    expect(screen.getByText('NO BACKEND')).toBeTruthy();
    expect(screen.getByText('NO WS')).toBeTruthy();
    expect(screen.getByTestId('badge').closest('button').disabled).toBe(true);
  });

  it('toggles the health popover and closes it on outside click', () => {
    render(<StatusBar />);
    fireEvent.click(screen.getByTestId('badge').closest('button'));
    expect(screen.getByTestId('health')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('health')).toBeNull();
  });

  it('shows the active mission with an elapsed timer', () => {
    set({}, {}, {
      missions: [{ id: 'm1', name: 'Op Mesa', created_at: '2026-03-01T08:58:55Z' }],
      activeMissionId: 'm1',
    });
    render(<StatusBar />);
    expect(screen.getByText('Op Mesa')).toBeTruthy();
    expect(screen.getByText('01:01:05')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('01:01:06')).toBeTruthy();
    expect(screen.queryByText('NO ACTIVE MISSION')).toBeNull();
  });

  it('says NO ACTIVE MISSION without one, and mobile shows only the connection', () => {
    render(<StatusBar />);
    expect(screen.getByText('NO ACTIVE MISSION')).toBeTruthy();
    cleanup();
    set({}, { isMobile: true });
    render(<StatusBar />);
    expect(screen.queryByText('NO ACTIVE MISSION')).toBeNull();
    expect(screen.getByTestId('badge')).toBeTruthy();
  });
});
