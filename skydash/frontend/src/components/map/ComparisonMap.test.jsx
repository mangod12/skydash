// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: (p) => <div data-testid="tile" data-url={p.url} />,
  useMap: () => ({ setView: () => {}, getCenter: () => ({}), getZoom: () => 1 }),
  useMapEvents: () => null,
}));
vi.mock('./EntityMarkers', () => ({ default: () => <div data-testid="entities" /> }));
vi.mock('./FleetMarkers', () => ({ default: () => <div data-testid="fleet" /> }));
vi.mock('./DroneMarker', () => ({ default: () => <div data-testid="drone" /> }));
vi.mock('./MapView', () => ({
  TILE_LAYERS: { satellite: { url: 'sat-url' }, dark: { url: 'dark-url' } },
}));

import ComparisonMap from './ComparisonMap';

afterEach(cleanup);

describe('ComparisonMap', () => {
  it('shows the sync state', () => {
    const { rerender } = render(<ComparisonMap syncEnabled />);
    expect(screen.getByText('SYNCED')).toBeTruthy();
    rerender(<ComparisonMap syncEnabled={false} />);
    expect(screen.getByText('INDEPENDENT')).toBeTruthy();
  });

  it('starts with satellite tiles, entities and fleet on, and exposes toggle state', () => {
    render(<ComparisonMap />);
    expect(screen.getByTestId('tile').getAttribute('data-url')).toBe('sat-url');
    expect(screen.getByTestId('entities')).toBeTruthy();
    expect(screen.getByTestId('fleet')).toBeTruthy();
    for (const l of ['SAT', 'ENT', 'FLEET']) {
      expect(screen.getByText(l).getAttribute('aria-pressed')).toBe('true');
    }
  });

  it('toggles layers off and back on', () => {
    render(<ComparisonMap />);
    fireEvent.click(screen.getByText('ENT'));
    expect(screen.queryByTestId('entities')).toBeNull();
    expect(screen.getByText('ENT').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByText('FLEET'));
    expect(screen.queryByTestId('fleet')).toBeNull();
    fireEvent.click(screen.getByText('SAT'));
    expect(screen.getByTestId('tile').getAttribute('data-url')).toBe('dark-url');
    fireEvent.click(screen.getByText('ENT'));
    expect(screen.getByTestId('entities')).toBeTruthy();
  });
});
