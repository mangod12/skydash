// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

let handlers = {};
const markers = [];
vi.mock('react-leaflet', () => ({
  useMapEvents: (h) => { handlers = h; return null; },
  CircleMarker: (p) => { markers.push(p); return null; },
  Polyline: () => null,
  Polygon: () => null,
}));
vi.mock('../common/Toast', () => ({ toast: vi.fn() }));

import GeofenceDraw from './GeofenceDraw';
import { useMapStore } from '../../stores/mapStore';

const click = (lat, lng) => act(() => handlers.click({ latlng: { lat, lng } }));

beforeEach(() => { handlers = {}; markers.length = 0; useMapStore.setState({ geofences: [] }); });
afterEach(cleanup);

describe('GeofenceDraw', () => {
  it('ignores clicks when inactive', () => {
    render(<GeofenceDraw active={false} mode="circle" />);
    click(1, 1);
    expect(useMapStore.getState().geofences).toHaveLength(0);
  });

  it('circle: first click sets centre, second click creates a geofence with the measured radius', () => {
    const done = vi.fn();
    render(<GeofenceDraw active mode="circle" onComplete={done} />);
    click(0, 0);
    expect(useMapStore.getState().geofences).toHaveLength(0);
    click(0, 0.01);
    const [g] = useMapStore.getState().geofences;
    expect(g.type).toBe('circle');
    expect(g.center).toEqual({ lat: 0, lng: 0 });
    expect(g.radius).toBeGreaterThan(1100);
    expect(g.radius).toBeLessThan(1120);
    expect(g.alertOnEntry).toBe(true);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('polygon: needs 3 points before double click creates a geofence', () => {
    const done = vi.fn();
    const ev = { originalEvent: { preventDefault: vi.fn() } };
    render(<GeofenceDraw active mode="polygon" onComplete={done} />);
    click(0, 0); click(0, 1);
    act(() => handlers.dblclick(ev));
    expect(useMapStore.getState().geofences).toHaveLength(0);
    click(1, 1);
    act(() => handlers.dblclick(ev));
    const [g] = useMapStore.getState().geofences;
    expect(g.type).toBe('polygon');
    expect(g.points).toHaveLength(3);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('draws vertex markers while drafting a polygon', () => {
    render(<GeofenceDraw active mode="polygon" />);
    click(0, 0); click(0, 1);
    expect(markers.length).toBeGreaterThanOrEqual(2);
  });
});
