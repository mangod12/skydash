// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const seen = { center: null, markers: [] };
vi.mock('react-leaflet', () => ({
  MapContainer: ({ center, children }) => { seen.center = center; return <div>{children}</div>; },
  TileLayer: () => null,
  CircleMarker: ({ center }) => { seen.markers.push(center); return null; },
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import DashboardMiniMap from './DashboardMiniMap';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useIntelStore } from '../../stores/intelStore';

beforeEach(() => { seen.center = null; seen.markers = []; });
afterEach(cleanup);

describe('DashboardMiniMap', () => {
  it('uses the default centre with no points', () => {
    useTelemetryStore.setState({ fleet: [] });
    useIntelStore.setState({ entities: [] });
    render(<DashboardMiniMap />);
    expect(seen.center).toEqual([37.7755, -122.4180]);
    expect(seen.markers).toEqual([]);
  });

  it('centres on the mean of valid drone and entity points', () => {
    useTelemetryStore.setState({ fleet: [{ drone_id: 'd1', gps: { latitude: 10, longitude: 20 } }] });
    useIntelStore.setState({ entities: [{ id: 'e1', coordinates: [20, 40], threatLevel: 'low' }] });
    render(<DashboardMiniMap />);
    expect(seen.center).toEqual([15, 30]);
    expect(seen.markers).toHaveLength(2);
  });

  it('skips non-finite and malformed points, and keeps zero coordinates', () => {
    useTelemetryStore.setState({ fleet: [
      { drone_id: 'a', gps: { latitude: NaN, longitude: 5 } },
      { drone_id: 'b', gps: { latitude: 0, longitude: 0 } },
      { drone_id: 'c' },
    ] });
    useIntelStore.setState({ entities: [
      { id: 'x', coordinates: ['1', '2'] }, { id: 'y', coordinates: { lat: 1 } }, { id: 'z', coordinates: [Infinity, 1] },
    ] });
    render(<DashboardMiniMap />);
    expect(seen.markers).toEqual([[0, 0]]);
    expect(seen.center).toEqual([0, 0]);
  });
});
