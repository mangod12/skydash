// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ ADSB_CONFIGURED: true, ADSB_URL: 'http://feed.test/adsb', API_BASE: 'http://backend.test', API_CONFIGURED: true }));
vi.mock('../../utils/runtimeConfig', () => config);
vi.mock('react-leaflet', () => ({
  CircleMarker: ({ center, children }) => <div data-testid="aircraft" data-position={JSON.stringify(center)}>{children}</div>,
  Tooltip: ({ children }) => <div>{children}</div>,
}));
import AdsbLayer from './AdsbLayer';
import { useMapStore } from '../../stores/mapStore';
import { useAuthStore } from '../../stores/authStore';

const plane = { icao24: 'a123', callsign: 'ZERO', latitude: 0, longitude: 0, altitude: 0, velocity: 0, heading: 0, on_ground: false };
const reply = data => ({ ok: true, json: async () => data });
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  vi.useFakeTimers();
  config.ADSB_CONFIGURED = true;
  config.ADSB_URL = 'http://feed.test/adsb';
  config.API_BASE = 'http://backend.test';
  config.API_CONFIGURED = true;
  useAuthStore.setState({ token: 'test-session', user: { username: 'test' } });
  useMapStore.setState({ layers: { adsb: true } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('ADS-B source truth', () => {
  it('authenticates configured backend requests and preserves feed query parameters', async () => {
    config.ADSB_URL = 'http://backend.test/api/connectors/adsb?region=test&lat_min=90#map';
    const fetch = vi.fn().mockResolvedValue(reply({ data: [] }));
    vi.stubGlobal('fetch', fetch);
    render(<AdsbLayer />); await settle();
    expect(screen.getByText('ADS-B LIVE')).toBeTruthy();
    const [target, options] = fetch.mock.calls[0];
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer test-session');
    const url = new URL(target);
    expect(url.searchParams.get('region')).toBe('test');
    expect(url.searchParams.getAll('lat_min')).toEqual(['37.6']);
    expect(url.searchParams.get('lon_max')).toBe('-122.2');
  });
  it('never discloses the session token to a third-party feed or logs out on its 401', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetch);
    render(<AdsbLayer />); await settle();
    expect(screen.getByText('ADS-B UNAVAILABLE')).toBeTruthy();
    expect(new Headers(fetch.mock.calls[0][1].headers).has('authorization')).toBe(false);
    expect(useAuthStore.getState().token).toBe('test-session');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not authenticate a different backend port', async () => {
    config.ADSB_URL = 'http://backend.test:9000/adsb';
    const fetch = vi.fn().mockResolvedValue(reply({ data: [] }));
    vi.stubGlobal('fetch', fetch);
    render(<AdsbLayer />); await settle();
    expect(new Headers(fetch.mock.calls[0][1].headers).has('authorization')).toBe(false);
  });
  it('authenticates a same-origin relative backend without leaking on standalone feeds', async () => {
    config.API_BASE = '';
    config.ADSB_URL = '/api/connectors/adsb';
    const fetch = vi.fn().mockResolvedValue(reply({ data: [] }));
    vi.stubGlobal('fetch', fetch);
    const view = render(<AdsbLayer />); await settle();
    expect(new Headers(fetch.mock.calls[0][1].headers).get('authorization')).toBe('Bearer test-session');
    view.unmount();
    config.API_CONFIGURED = false;
    render(<AdsbLayer />); await settle();
    expect(new Headers(fetch.mock.calls[1][1].headers).has('authorization')).toBe(false);
  });
  it('keeps valid empty live results empty rather than adding simulated aircraft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ data: [] })));
    render(<AdsbLayer />); await settle();
    expect(screen.getByText('ADS-B LIVE')).toBeTruthy();
    expect(screen.queryAllByTestId('aircraft')).toHaveLength(0);
  });
  it('shows unavailable without simulated aircraft for errors and malformed feeds', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    for (const value of [{ success: false }, { data: {} }, { data: [null, 4, {}] }]) {
      fetch.mockResolvedValue(reply(value));
      const view = render(<AdsbLayer />); await settle();
      expect(screen.getByText('ADS-B UNAVAILABLE')).toBeTruthy();
      expect(screen.queryAllByTestId('aircraft')).toHaveLength(0);
      view.unmount();
    }
    fetch.mockRejectedValue(new Error('down'));
    render(<AdsbLayer />); await settle();
    expect(screen.getByText('ADS-B UNAVAILABLE')).toBeTruthy();
    expect(screen.queryAllByTestId('aircraft')).toHaveLength(0);
  });
  it('preserves zero values, isolates bad records, deduplicates IDs and skips grounded aircraft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ data: [
      null, { ...plane, latitude: true }, { ...plane, latitude: 91 },
      { ...plane, icao24: 'ground', on_ground: true },
      plane, { ...plane }, { ...plane, icao24: 'nan', longitude: NaN },
    ] })));
    render(<AdsbLayer />); await settle();
    expect(screen.getByText('ADS-B LIVE')).toBeTruthy();
    expect(screen.getAllByTestId('aircraft')).toHaveLength(1);
    expect(screen.getByTestId('aircraft').getAttribute('data-position')).toBe('[0,0]');
    expect(screen.getByText(/0m \| 0m\/s \| HDG 0/)).toBeTruthy();
  });
  it('only shows simulation when no live source is configured', async () => {
    config.ADSB_CONFIGURED = false;
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<AdsbLayer />); await settle();
    expect(screen.getByText('ADS-B SIM')).toBeTruthy();
    expect(screen.getAllByTestId('aircraft')).toHaveLength(5);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('clears previous markers when a later live refresh fails', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ data: [plane] })).mockRejectedValue(new Error('down'));
    vi.stubGlobal('fetch', fetch);
    render(<AdsbLayer />); await settle();
    expect(screen.getAllByTestId('aircraft')).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(screen.getByText('ADS-B UNAVAILABLE')).toBeTruthy();
    expect(screen.queryAllByTestId('aircraft')).toHaveLength(0);
  });
  it('aborts stalled requests and ignores results from disabled sessions', async () => {
    let resolve;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; }))
      .mockResolvedValue(reply({ data: [] }));
    vi.stubGlobal('fetch', fetch);
    render(<AdsbLayer />); await settle();
    const signal = fetch.mock.calls[0][1].signal;
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(signal.aborted).toBe(true);
    act(() => useMapStore.setState({ layers: { adsb: false } }));
    act(() => useMapStore.setState({ layers: { adsb: true } }));
    await settle();
    await act(async () => { resolve(reply({ data: [plane] })); });
    expect(screen.getByText('ADS-B LIVE')).toBeTruthy();
    expect(screen.queryAllByTestId('aircraft')).toHaveLength(0);
  });
});
