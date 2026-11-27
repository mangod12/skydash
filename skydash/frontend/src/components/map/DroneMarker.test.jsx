// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const markers = [];
vi.mock('react-leaflet', () => ({
  Marker: (p) => { markers.push(p); return <i data-testid="marker" />; },
}));

import DroneMarker from './DroneMarker';
import { useMapStore } from '../../stores/mapStore';

beforeEach(() => { markers.length = 0; });
afterEach(cleanup);

const draw = (dronePosition) => { useMapStore.setState({ dronePosition }); return render(<DroneMarker />); };

describe('DroneMarker', () => {
  it('renders nothing without a position', () => {
    const { container } = draw(null);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for a non-finite position', () => {
    draw({ lat: NaN, lng: 77 });
    draw({ lat: 12, lng: undefined });
    expect(markers.length).toBe(0);
  });

  it('places the marker and rotates the icon by heading', () => {
    draw({ lat: 12.5, lng: 77.5, heading: 45 });
    expect(markers[0].position).toEqual([12.5, 77.5]);
    expect(markers[0].icon.options.html).toContain('rotate(45deg)');
  });

  it('defaults heading to zero', () => {
    draw({ lat: 1, lng: 2 });
    expect(markers[0].icon.options.html).toContain('rotate(0deg)');
  });
});
