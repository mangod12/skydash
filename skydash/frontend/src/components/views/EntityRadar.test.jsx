// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import EntityRadar from './EntityRadar';
import { useIntelStore } from '../../stores/intelStore';
import { useMapStore } from '../../stores/mapStore';

const drone = { lat: 28.6, lng: 77.2 };
const ent = (id, coordinates, threatLevel = 'low') => ({ id, name: id, coordinates, threatLevel });

beforeEach(() => useMapStore.setState({ dronePosition: drone }));
afterEach(cleanup);

describe('EntityRadar', () => {
  it('shows zero in range with no drone position', () => {
    useMapStore.setState({ dronePosition: null });
    useIntelStore.setState({ entities: [ent('a', [28.6, 77.2])] });
    render(<EntityRadar />);
    expect(screen.getByText(/0 IN RANGE/)).toBeTruthy();
  });

  it('counts only entities within 2 km', () => {
    useIntelStore.setState({ entities: [ent('near', [28.601, 77.201]), ent('far', [29.6, 77.2])] });
    render(<EntityRadar />);
    expect(screen.getByText(/1 IN RANGE/)).toBeTruthy();
  });

  it('ignores missing, malformed and non-finite coordinates without throwing', () => {
    useIntelStore.setState({
      entities: [ent('n', null), ent('o', { lat: 1 }), ent('x', [NaN, 77.2]), ent('s', ['28.6', '77.2']), ent('ok', [28.6, 77.2])],
    });
    render(<EntityRadar />);
    expect(screen.getByText(/1 IN RANGE/)).toBeTruthy();
  });

  it('exposes an accessible summary', () => {
    useIntelStore.setState({ entities: [ent('ok', [28.6, 77.2])] });
    render(<EntityRadar />);
    expect(screen.getByRole('img', { name: /1 entity within 2 km/ })).toBeTruthy();
  });
});
