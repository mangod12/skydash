// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

const state = vi.hoisted(() => ({
  cfg: { ADSB_CONFIGURED: false },
  telemetry: { isConnected: false, fleet: [], latency: 0 },
  intel: { entities: [], events: [] },
  map: { layers: { adsb: false } },
}));

vi.mock('../../utils/runtimeConfig', () => ({
  get ADSB_CONFIGURED() { return state.cfg.ADSB_CONFIGURED; },
}));
vi.mock('../../stores/telemetryStore', () => ({ useTelemetryStore: () => state.telemetry }));
vi.mock('../../stores/intelStore', () => ({ useIntelStore: () => state.intel }));
vi.mock('../../stores/mapStore', () => ({ useMapStore: () => state.map }));

import DataSources from './DataSources';

const NOW = new Date('2026-01-01T12:34:56Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state.cfg = { ADSB_CONFIGURED: false };
  state.telemetry = { isConnected: false, fleet: [], latency: 0 };
  state.intel = { entities: [], events: [] };
  state.map = { layers: { adsb: false } };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

// The card is the closest ancestor holding the name and its status label.
const card = (name) => screen.getByText(name).closest('.border-b');

describe('DataSources', () => {
  it('lists all six sources', () => {
    render(<DataSources />);
    for (const n of ['FLEET SIMULATOR', 'ADS-B (OPENSKY)', 'MAVLINK', 'DJI SDK', 'OSINT FEEDS', 'ENTITY DATABASE']) {
      expect(screen.getByText(n)).toBeTruthy();
    }
  });

  it('marks the fleet disconnected with no fetch time', () => {
    render(<DataSources />);
    const c = within(card('FLEET SIMULATOR'));
    expect(c.getByText('DISCONNECTED')).toBeTruthy();
    expect(c.queryByText(/Last fetch/)).toBeNull();
  });

  it('shows the fleet connected with drone count, latency and a UTC fetch time', () => {
    state.telemetry = { isConnected: true, fleet: [{}, {}, {}], latency: 18 };
    render(<DataSources />);
    const c = within(card('FLEET SIMULATOR'));
    expect(c.getByText('CONNECTED')).toBeTruthy();
    expect(c.getByText('3 drones - 10 Hz - 18ms latency')).toBeTruthy();
    expect(c.getByText('100%')).toBeTruthy();
    expect(c.getByText('Last fetch: 12:34:56Z')).toBeTruthy();
  });

  it('distinguishes ADS-B available, simulated and connected', () => {
    const { unmount } = render(<DataSources />);
    expect(within(card('ADS-B (OPENSKY)')).getByText('AVAILABLE')).toBeTruthy();
    unmount();
    state.map = { layers: { adsb: true } };
    const second = render(<DataSources />);
    expect(within(card('ADS-B (OPENSKY)')).getByText('SIMULATED')).toBeTruthy();
    expect(within(card('ADS-B (OPENSKY)')).getByText('40%')).toBeTruthy();
    second.unmount();
    state.cfg.ADSB_CONFIGURED = true;
    render(<DataSources />);
    expect(within(card('ADS-B (OPENSKY)')).getByText('CONNECTED')).toBeTruthy();
    expect(within(card('ADS-B (OPENSKY)')).getByText('85%')).toBeTruthy();
  });

  it('keeps MAVLink and DJI as not configured', () => {
    render(<DataSources />);
    expect(within(card('MAVLINK')).getByText('Not configured')).toBeTruthy();
    expect(within(card('DJI SDK')).getByText('Not configured')).toBeTruthy();
  });

  it('detects OSINT entities by source or tag and reports the count', () => {
    state.intel = {
      entities: [
        { id: 1, source: 'Shodan scan', lastSeen: NOW - 1000 },
        { id: 2, tags: ['VirusTotal'], lastSeen: NOW - 5000 },
        { id: 3, tags: ['other'], lastSeen: NOW },
      ],
      events: [],
    };
    render(<DataSources />);
    const c = within(card('OSINT FEEDS'));
    expect(c.getByText('Connector imports - 2 entities')).toBeTruthy();
    expect(c.getByText('80%')).toBeTruthy();
    expect(c.getByText('Last fetch: 12:34:55Z')).toBeTruthy();
  });

  it('shows OSINT as ready when no entity came from a connector', () => {
    state.intel = { entities: [{ id: 1, tags: ['x'], lastSeen: NOW }], events: [] };
    render(<DataSources />);
    const c = within(card('OSINT FEEDS'));
    expect(c.getByText('AVAILABLE')).toBeTruthy();
    expect(c.getByText('Ready')).toBeTruthy();
  });

  it('summarises the entity database with its newest lastSeen', () => {
    state.intel = {
      entities: [{ id: 1, lastSeen: NOW - 60000 }, { id: 2, lastSeen: NOW - 2000 }],
      events: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    };
    render(<DataSources />);
    const c = within(card('ENTITY DATABASE'));
    expect(c.getByText('SQLite - 2 entities - 3 events')).toBeTruthy();
    expect(c.getByText('Last fetch: 12:34:54Z')).toBeTruthy();
  });
});
