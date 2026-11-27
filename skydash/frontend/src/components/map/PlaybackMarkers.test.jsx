// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const markers = [];
vi.mock('react-leaflet', () => ({
  Marker: (p) => { markers.push(p); return <div data-testid="marker">{p.children}</div>; },
  Tooltip: ({ children }) => <div>{children}</div>,
}));
vi.mock('leaflet', () => ({ default: { divIcon: (o) => o } }));

import PlaybackMarkers from './PlaybackMarkers';
import { usePlaybackStore } from '../../stores/playbackStore';

const setup = (active, positions) =>
  usePlaybackStore.setState({ active, currentTime: 1, getCurrentSnapshot: () => (positions ? { positions } : null) });

beforeEach(() => { markers.length = 0; });
afterEach(cleanup);

describe('PlaybackMarkers', () => {
  it('renders nothing when playback is inactive', () => {
    setup(false, [{ droneId: 'DRONE-01', lat: 1, lng: 2 }]);
    const { container } = render(<PlaybackMarkers />);
    expect(container.textContent).toBe('');
    expect(markers).toHaveLength(0);
  });

  it('renders nothing without a snapshot', () => {
    setup(true, null);
    render(<PlaybackMarkers />);
    expect(markers).toHaveLength(0);
  });

  it('draws a marker per drone with readings and a PLAYBACK tag', () => {
    setup(true, [{ droneId: 'DRONE-01', lat: 1, lng: 2, alt: 50.4, battery: 11.84, speed: 3.26, heading: 90 }]);
    const { container } = render(<PlaybackMarkers />);
    expect(markers[0].position).toEqual([1, 2]);
    expect(container.textContent).toContain('DRONE-01');
    expect(container.textContent).toContain('(PLAYBACK)');
    expect(container.textContent).toContain('50m | 11.8V | 3.3m/s');
  });

  it('shows -- for missing readings, never undefined or NaN', () => {
    setup(true, [{ droneId: 'DRONE-02', lat: 1, lng: 2, alt: null, battery: NaN }]);
    const { container } = render(<PlaybackMarkers />);
    expect(container.textContent).toContain('-- | -- | --m/s');
    expect(container.textContent).not.toMatch(/undefined|NaN/);
  });

  it('skips drones with non-finite coordinates instead of crashing Leaflet', () => {
    setup(true, [
      { droneId: 'DRONE-01', lat: NaN, lng: 2 },
      { droneId: 'DRONE-02', lat: 3, lng: 4 },
    ]);
    render(<PlaybackMarkers />);
    expect(markers).toHaveLength(1);
    expect(markers[0].position).toEqual([3, 4]);
  });
});
