// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const circles = [];
const lines = [];
const dots = [];
vi.mock('react-leaflet', () => ({
  Circle: (p) => { circles.push(p); return null; },
  Polyline: (p) => { lines.push(p); return null; },
  CircleMarker: (p) => { dots.push(p); return <div>{p.children}</div>; },
  Tooltip: ({ children }) => <span>{children}</span>,
}));

import DroneRangeRings from './DroneRangeRings';
import { useMapStore } from '../../stores/mapStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { RANGE_RING_RADII_M } from '../../utils/prediction';

beforeEach(() => { circles.length = 0; lines.length = 0; dots.length = 0; });
afterEach(cleanup);

const setup = (pos, speed) => {
  useMapStore.setState({ dronePosition: pos });
  useTelemetryStore.setState({ data: { ground_speed: speed } });
};

describe('DroneRangeRings', () => {
  it('draws nothing without a drone position', () => {
    setup(null, 5);
    render(<DroneRangeRings />);
    expect(circles).toHaveLength(0);
  });

  it('draws nothing for a non-finite position instead of crashing Leaflet', () => {
    setup({ lat: NaN, lng: 2, heading: 0 }, 5);
    render(<DroneRangeRings />);
    expect(circles).toHaveLength(0);
  });

  it('draws one ring per radius around the drone', () => {
    setup({ lat: 10, lng: 20, heading: 90 }, 5);
    render(<DroneRangeRings />);
    expect(circles.map((c) => c.radius)).toEqual(RANGE_RING_RADII_M);
    expect(circles.every((c) => c.center[0] === 10 && c.center[1] === 20)).toBe(true);
  });

  it('draws a predicted track with a time label when the drone is moving', () => {
    setup({ lat: 10, lng: 20, heading: 90 }, 5);
    const { container } = render(<DroneRangeRings />);
    expect(lines).toHaveLength(1);
    expect(dots.length).toBe(lines[0].positions.length - 1);
    expect(container.textContent).toContain('+120s');
  });

  it('draws no track when the drone is stationary', () => {
    setup({ lat: 10, lng: 20, heading: 90 }, 0);
    render(<DroneRangeRings />);
    expect(circles).toHaveLength(3);
    expect(lines).toHaveLength(0);
  });
});
