// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const circles = [];
const polys = [];
vi.mock('react-leaflet', () => ({
  Circle: (p) => { circles.push(p); return <div data-testid="circle">{p.children}</div>; },
  Polygon: (p) => { polys.push(p); return <div data-testid="polygon">{p.children}</div>; },
  Tooltip: ({ children }) => <div>{children}</div>,
}));

import GeofenceOverlay from './GeofenceOverlay';
import { useMapStore } from '../../stores/mapStore';

beforeEach(() => { circles.length = 0; polys.length = 0; });
afterEach(cleanup);

const draw = (geofences) => { useMapStore.setState({ geofences }); return render(<GeofenceOverlay />); };
const circle = (o = {}) => ({ id: 'c1', type: 'circle', center: { lat: 1, lng: 2 }, radius: 500, name: 'Zone C', ...o });
const poly = (o = {}) => ({ id: 'p1', type: 'polygon', points: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }], name: 'Zone P', ...o });

describe('GeofenceOverlay', () => {
  it('draws circles and polygons with names', () => {
    draw([circle(), poly()]);
    expect(circles[0].center).toEqual([1, 2]);
    expect(circles[0].radius).toBe(500);
    expect(polys[0].positions).toEqual([[0, 0], [0, 1], [1, 1]]);
    expect(screen.getByText('Zone C')).toBeTruthy();
    expect(screen.getByText('Zone P')).toBeTruthy();
  });

  it('skips fences that are explicitly inactive but not those without the flag', () => {
    draw([circle({ id: 'a', active: false }), circle({ id: 'b' }), circle({ id: 'c', active: true })]);
    expect(circles.length).toBe(2);
  });

  it('uses the fence color or the default', () => {
    draw([circle({ color: '#ff0000' }), circle({ id: 'x' })]);
    expect(circles[0].pathOptions.color).toBe('#ff0000');
    expect(circles[1].pathOptions.color).toBe('#6366f1');
  });

  it('skips polygons with fewer than three points and unknown types', () => {
    draw([poly({ points: [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }] }), { id: 'z', type: 'line' }]);
    expect(polys.length).toBe(0);
    expect(circles.length).toBe(0);
  });

  it('skips malformed circles instead of crashing', () => {
    draw([circle({ center: null }), circle({ id: 'n', center: { lat: NaN, lng: 1 } }), circle({ id: 'r', radius: 0 })]);
    expect(circles.length).toBe(0);
  });

  it('omits the tooltip for unnamed fences', () => {
    draw([circle({ name: undefined })]);
    expect(screen.queryByText('Zone C')).toBeNull();
  });
});
