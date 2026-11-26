// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const marker = vi.fn();
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, dragging, scrollWheelZoom }) => (
    <div data-testid="map" data-center={JSON.stringify(center)} data-drag={String(dragging)} data-wheel={String(scrollWheelZoom)}>{children}</div>
  ),
  TileLayer: () => <div data-testid="tiles" />,
  CircleMarker: (props) => { marker(props); return <div data-testid="marker" />; },
}));

import EntityMiniMap from './EntityMiniMap';

afterEach(() => { cleanup(); marker.mockClear(); });

describe('EntityMiniMap', () => {
  it('renders nothing without coordinates', () => {
    const { container } = render(<EntityMiniMap coordinates={null} threatLevel="high" />);
    expect(container.firstChild).toBeNull();
  });

  it('centers a non-interactive map on the coordinates', () => {
    const { getByTestId } = render(<EntityMiniMap coordinates={[12.9, 77.5]} threatLevel="low" />);
    const map = getByTestId('map');
    expect(JSON.parse(map.dataset.center)).toEqual([12.9, 77.5]);
    expect(map.dataset.drag).toBe('false');
    expect(map.dataset.wheel).toBe('false');
  });

  it('colors the marker by threat level with a cyan fallback', () => {
    const color = (level) => {
      marker.mockClear();
      render(<EntityMiniMap coordinates={[1, 2]} threatLevel={level} />);
      const c = marker.mock.calls[0][0].pathOptions.color;
      cleanup();
      return c;
    };
    expect(color('critical')).toBe('#dc2626');
    expect(color('low')).toBe('#10b981');
    expect(color('none')).toBe('#71717a');
    expect(color('unknown')).toBe('#22d3ee');
  });
});
