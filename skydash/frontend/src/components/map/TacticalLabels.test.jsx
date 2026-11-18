// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('react-leaflet', () => ({ Marker: ({ position, icon }) => <div data-testid="label" data-position={JSON.stringify(position)}>{icon.options.html}</div> }));
import TacticalLabels from './TacticalLabels';
import { useIntelStore } from '../../stores/intelStore';
import { useMapStore } from '../../stores/mapStore';
const entity = coordinates => ({ id: 'one', name: 'Test', coordinates, type: 'person', threatLevel: 'high' });
beforeEach(() => {
  useMapStore.setState({ dronePosition: { lat: 0, lng: 0 } });
  useIntelStore.setState({ entities: [] });
});
afterEach(cleanup);
describe('tactical label positions', () => {
  it('isolates malformed rows and positions while preserving real zero', () => {
    useIntelStore.setState({ entities: [null, {}, ...[null, [], [null, null], [true, false], ['0', '0'], [91, 0], [0, -181], [NaN, 0], '00'].map(entity), entity([0, 0])] });
    render(<TacticalLabels />);
    expect(screen.getAllByTestId('label')).toHaveLength(1);
    expect(screen.getByTestId('label').getAttribute('data-position')).toBe('[0,0]');
    expect(screen.getByTestId('label').textContent).toContain('0m');
  });
  it.each([null, { lat: null, lng: null }, { lat: '0', lng: '0' }, { lat: 91, lng: 0 }])(
    'shows unknown distance instead of coercing an invalid drone position: %j', dronePosition => {
      useMapStore.setState({ dronePosition });
      useIntelStore.setState({ entities: [entity([0, 0])] });
      render(<TacticalLabels />);
      expect(screen.getByTestId('label').textContent).toContain('--');
      expect(screen.getByTestId('label').textContent).not.toContain('0m');
    },
  );
  it('preserves distance units for a valid nearby position', () => {
    useIntelStore.setState({ entities: [entity([0.001, 0])] });
    render(<TacticalLabels />);
    expect(screen.getByTestId('label').textContent).toContain('111m');
  });
});
