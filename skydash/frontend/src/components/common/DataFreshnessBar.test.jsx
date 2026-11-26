// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

const state = vi.hoisted(() => ({
  cfg: { ADSB_CONFIGURED: false, BACKEND_CONFIGURED: false },
  telemetry: { isConnected: false },
  intel: { entities: [], events: [] },
  map: { layers: { adsb: false } },
}));

vi.mock('../../utils/runtimeConfig', () => ({
  get ADSB_CONFIGURED() { return state.cfg.ADSB_CONFIGURED; },
  get BACKEND_CONFIGURED() { return state.cfg.BACKEND_CONFIGURED; },
}));
vi.mock('../../stores/telemetryStore', () => ({ useTelemetryStore: (sel) => sel(state.telemetry) }));
vi.mock('../../stores/intelStore', () => ({ useIntelStore: (sel) => sel(state.intel) }));
vi.mock('../../stores/mapStore', () => ({ useMapStore: (sel) => sel(state.map) }));

import DataFreshnessBar from './DataFreshnessBar';

const NOW = new Date('2026-01-01T00:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state.cfg = { ADSB_CONFIGURED: false, BACKEND_CONFIGURED: false };
  state.telemetry = { isConnected: false };
  state.intel = { entities: [], events: [] };
  state.map = { layers: { adsb: false } };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

// Expanded and collapsed lists both render; the expanded one carries text labels.
const tier = (name) => screen.getAllByTitle((t) => t.startsWith(name + ':'))[0].title.split(': ')[1];

describe('DataFreshnessBar', () => {
  it('shows the local demo as STATIC when no backend is configured', () => {
    render(<DataFreshnessBar />);
    expect(screen.getAllByText('LOCAL DEMO').length).toBeGreaterThan(0);
    expect(tier('LOCAL DEMO')).toBe('STATIC');
  });

  it('shows OFFLINE for sources with no data', () => {
    render(<DataFreshnessBar />);
    expect(tier('ENTITY DB')).toBe('OFFLINE');
    expect(tier('INTEL FEED')).toBe('OFFLINE');
  });

  it('grades entity age into LIVE, RECENT, STALE and OFFLINE', () => {
    const cases = [[1000, 'LIVE'], [30000, 'RECENT'], [120000, 'STALE'], [900000, 'OFFLINE']];
    for (const [age, label] of cases) {
      state.intel = { entities: [{ lastSeen: NOW - age }], events: [] };
      const { unmount } = render(<DataFreshnessBar />);
      expect(tier('ENTITY DB')).toBe(label);
      unmount();
    }
  });

  it('uses the newest entity and event timestamps', () => {
    state.intel = {
      entities: [{ lastSeen: NOW - 900000 }, { lastSeen: NOW - 2000 }],
      events: [{ time: NOW - 900000 }, { time: NOW - 20000 }],
    };
    render(<DataFreshnessBar />);
    expect(tier('ENTITY DB')).toBe('LIVE');
    expect(tier('INTEL FEED')).toBe('RECENT');
  });

  it('ages a source as time passes', () => {
    state.intel = { entities: [{ lastSeen: NOW }], events: [] };
    render(<DataFreshnessBar />);
    expect(tier('ENTITY DB')).toBe('LIVE');
    act(() => { vi.advanceTimersByTime(70000); });
    expect(tier('ENTITY DB')).toBe('STALE');
  });

  it('reports the telemetry socket by connection state when a backend is configured', () => {
    state.cfg.BACKEND_CONFIGURED = true;
    const { unmount } = render(<DataFreshnessBar />);
    expect(tier('TELEMETRY WS')).toBe('OFFLINE');
    unmount();
    state.telemetry = { isConnected: true };
    render(<DataFreshnessBar />);
    expect(tier('TELEMETRY WS')).toBe('LIVE');
  });

  it('labels ADS-B as simulated unless configured, and OFFLINE when the layer is off', () => {
    const { unmount } = render(<DataFreshnessBar />);
    expect(screen.getAllByText('ADS-B SIM').length).toBeGreaterThan(0);
    expect(tier('ADS-B SIM')).toBe('OFFLINE');
    unmount();
    state.cfg.ADSB_CONFIGURED = true;
    state.map = { layers: { adsb: true } };
    render(<DataFreshnessBar />);
    expect(tier('ADS-B')).toBe('RECENT');
  });
});
