// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('react-leaflet', () => ({ Polygon: ({ positions }) => <div data-testid="footprint" data-positions={JSON.stringify(positions)} /> }));
import DroneFootprint from './DroneFootprint';
import { useMapStore } from '../../stores/mapStore';
afterEach(cleanup);
const position = { lat: 20, lng: 30, alt: 50, heading: 0 };
describe('camera footprint reading evidence', () => {
  it.each([undefined, null, NaN, Infinity, '0', false])('does not invent north heading from %j', heading => {
    useMapStore.setState({ dronePosition: { ...position, heading } });
    render(<DroneFootprint />);
    expect(screen.queryAllByTestId('footprint')).toHaveLength(0);
  });
  it.each([{ alt: '50' }, { alt: Infinity }, { alt: 0 }, { lat: null },
    { lat: 91 }, { lng: 181 }, { lat: 90, heading: 90 }])('skips invalid readings or unrepresentable corners: %j', patch => {
    useMapStore.setState({ dronePosition: { ...position, ...patch } });
    render(<DroneFootprint />);
    expect(screen.queryAllByTestId('footprint')).toHaveLength(0);
  });
  it('keeps a genuine zero heading and origin with finite footprint corners', () => {
    useMapStore.setState({ dronePosition: { ...position, lat: 0, lng: 0 } });
    render(<DroneFootprint />);
    expect(screen.getAllByTestId('footprint')).toHaveLength(2);
    const corners = JSON.parse(screen.getAllByTestId('footprint')[0].getAttribute('data-positions'));
    expect(corners).toHaveLength(4);
    expect(corners.flat().every(Number.isFinite)).toBe(true);
    expect(corners[0][0]).toBeLessThan(0);
    expect(corners[2][0]).toBeGreaterThan(0);
  });
});
