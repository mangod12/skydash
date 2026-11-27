// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const markers = [];
vi.mock('react-leaflet', () => ({
  Marker: (p) => { markers.push(p); return <div data-testid="marker">{p.children}</div>; },
  Tooltip: ({ children }) => <div>{children}</div>,
}));

import FleetMarkers from './FleetMarkers';
import { useTelemetryStore } from '../../stores/telemetryStore';

beforeEach(() => { markers.length = 0; });
afterEach(cleanup);

const drone = (id, o = {}) => ({
  drone_id: id, gps: { latitude: 12.5, longitude: 77.5 }, pattern: 'grid',
  altitude: 49.6, battery_voltage: 15.44, attitude: { yaw: 90 }, ...o,
});
const draw = (fleet, activeDroneId = 'A') => {
  useTelemetryStore.setState({ fleet, activeDroneId });
  return render(<FleetMarkers />);
};

describe('FleetMarkers', () => {
  it('skips the active drone', () => {
    draw([drone('A'), drone('B')]);
    expect(markers.map((m) => m.position)).toEqual([[12.5, 77.5]]);
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.queryByText('A')).toBeNull();
  });

  it('skips drones without a usable position', () => {
    draw([drone('B', { gps: null }), drone('C', { gps: { latitude: NaN, longitude: 1 } }), drone('D', { gps: { latitude: '1', longitude: 2 } })]);
    expect(markers.length).toBe(0);
  });

  it('shows pattern, rounded altitude and voltage in the tooltip', () => {
    draw([drone('B')]);
    expect(screen.getByText('GRID | 50m | 15.4V')).toBeTruthy();
  });

  it('falls back to orbit and dashes for missing readings', () => {
    draw([drone('B', { pattern: 'mystery', altitude: undefined, battery_voltage: 'bad' })]);
    expect(screen.getByText('ORBIT | --m | --V')).toBeTruthy();
  });

  it('builds a rotated icon from yaw', () => {
    draw([drone('B', { attitude: { yaw: 135 } })]);
    expect(markers[0].icon.options.html).toContain('rotate(135deg)');
  });
});
