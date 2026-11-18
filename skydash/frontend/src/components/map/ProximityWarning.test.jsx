// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('framer-motion', () => ({ AnimatePresence: ({ children }) => children,
  motion: { div: ({ children }) => <div>{children}</div> } }));
import ProximityWarning from './ProximityWarning';
import { useIntelStore } from '../../stores/intelStore';
import { useMapStore } from '../../stores/mapStore';

beforeEach(() => {
  useMapStore.setState({ dronePosition: { lat: 0, lng: 0 } });
  useIntelStore.setState({ entities: [] });
});
afterEach(cleanup);
const entity = (id, coordinates, threatLevel = 'critical') => ({ id, name: id, coordinates, threatLevel });

describe('proximity position evidence', () => {
  it.each([[null, null], [false, false], ['', ''], ['0', '0'], [360, 0], [0, 360], [], '00'].map(value => [value]))(
    'does not coerce malformed entity coordinates into nearby threats: %j', (coordinates) => {
      useIntelStore.setState({ entities: [entity('invalid', coordinates)] });
      render(<ProximityWarning />);
      expect(screen.queryByText('PROXIMITY ALERT')).toBeNull();
    },
  );
  it.each([{ lat: null, lng: null }, { lat: '0', lng: '0' }, { lat: 360, lng: 0 }])(
    'requires a real current drone position: %j', (dronePosition) => {
      useMapStore.setState({ dronePosition });
      useIntelStore.setState({ entities: [entity('at-origin', [0, 0])] });
      render(<ProximityWarning />);
      expect(screen.queryByText('PROXIMITY ALERT')).toBeNull();
    },
  );
  it('isolates malformed records, preserves real zero and sorts nearby high threats', () => {
    useIntelStore.setState({ entities: [null, entity('nulls', [null, null]), entity('further', [0.004, 0]),
      entity('zero', [0, 0]), entity('near-high', [0.001, 0], 'high'),
      entity('far', [0.01, 0]), entity('low', [0, 0], 'low')] });
    render(<ProximityWarning />);
    expect(screen.getByText('PROXIMITY ALERT')).toBeTruthy();
    expect(screen.getByText('0m')).toBeTruthy();
    expect(screen.queryByText('nulls')).toBeNull();
    expect(screen.queryByText('far')).toBeNull();
    expect(screen.queryByText('low')).toBeNull();
    const names = [...document.querySelectorAll('.text-red-200')].map(node => node.textContent);
    expect(names).toEqual(['zero', 'near-high', 'further']);
  });
});
