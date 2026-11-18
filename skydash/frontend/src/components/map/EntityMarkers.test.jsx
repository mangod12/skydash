// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('react-leaflet', () => ({
  CircleMarker: ({ center, eventHandlers, children }) => <div data-testid="entity-marker" data-position={JSON.stringify(center)} onClick={eventHandlers.click}>{children}</div>,
  Circle: ({ center }) => <div data-testid="ring" data-position={JSON.stringify(center)} />,
  Tooltip: ({ children }) => <div>{children}</div>, Popup: ({ children }) => <div>{children}</div>,
}));
vi.mock('../../hooks/useEntityNavigation', () => ({ useEntityNavigation: () => ({ showEntityDetail: vi.fn() }) }));
import EntityMarkers from './EntityMarkers';
import { useIntelStore } from '../../stores/intelStore';
const entity = coordinates => ({ id: 'one', name: 'Test', coordinates, type: 'person', threatLevel: 'high', confidence: 90 });
beforeEach(() => useIntelStore.setState({ entities: [], selectedEntityId: null }));
afterEach(cleanup);
describe('entity marker positions', () => {
  it('isolates invalid records and geometry while keeping valid zero markers and rings', () => {
    useIntelStore.setState({ entities: [null, {}, ...[null, [], [null, null], [true, false], ['0', '0'], [91, 0], [0, -181], [NaN, 0], '00'].map(entity), entity([0, 0])] });
    render(<EntityMarkers />);
    expect(screen.getAllByTestId('entity-marker')).toHaveLength(1);
    expect(screen.getByTestId('entity-marker').getAttribute('data-position')).toBe('[0,0]');
    expect(screen.getAllByTestId('ring')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('entity-marker'));
    expect(useIntelStore.getState().selectedEntityId).toBe('one');
    expect(screen.getAllByTestId('ring')).toHaveLength(2);
  });
  it('does not crash valid-position markers with malformed type or threat text', () => {
    useIntelStore.setState({ entities: [{ ...entity([0, 0]), type: null, threatLevel: null }] });
    render(<EntityMarkers />);
    expect(screen.getByTestId('entity-marker')).toBeTruthy();
    expect(screen.getAllByText(/UNKNOWN/)).toHaveLength(2);
  });
});
