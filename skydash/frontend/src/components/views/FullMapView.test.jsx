// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('framer-motion', () => ({ AnimatePresence: ({ children }) => <>{children}</> }));
vi.mock('../map/MapView', () => ({ default: () => <div data-testid="map" /> }));
vi.mock('../map/SplitMapView', () => ({ default: () => <div data-testid="split" /> }));
vi.mock('../telemetry/AlertBar', () => ({ default: () => <div data-testid="alerts" /> }));
vi.mock('../common/BookmarkBar', () => ({
  default: ({ onApply }) => (
    <div>
      <button onClick={() => onApply('save', 'My view')}>save-bm</button>
      <button onClick={() => onApply('apply', { config: { center: [1, 2], zoom: 7, layers: { heat: true, fleet: false } } })}>apply-bm</button>
    </div>
  ),
}));

import FullMapView from './FullMapView';
import { useMapStore } from '../../stores/mapStore';
import { useBookmarkStore } from '../../stores/bookmarkStore';

afterEach(cleanup);
beforeEach(() => vi.restoreAllMocks());

describe('FullMapView', () => {
  it('toggles split view', () => {
    render(<FullMapView />);
    expect(screen.queryByTestId('split')).toBeNull();
    fireEvent.click(screen.getByTitle('Split view'));
    expect(screen.getByTestId('split')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Close split view'));
    expect(screen.queryByTestId('split')).toBeNull();
  });

  it('saves the current map view as a bookmark', () => {
    const add = vi.fn();
    useBookmarkStore.setState({ addBookmark: add });
    render(<FullMapView />);
    fireEvent.click(screen.getByText('save-bm'));
    const arg = add.mock.calls[0][0];
    expect(arg.name).toBe('My view');
    expect(arg.type).toBe('mapview');
    expect(arg.config).toHaveProperty('zoom');
    expect(arg.config).toHaveProperty('layers');
  });

  it('applies a bookmark: flies there and toggles only differing layers', () => {
    const flyTo = vi.fn(), toggleLayer = vi.fn();
    useMapStore.setState({ flyTo, toggleLayer, layers: { heat: false, fleet: false } });
    render(<FullMapView />);
    fireEvent.click(screen.getByText('apply-bm'));
    expect(flyTo).toHaveBeenCalledWith([1, 2], 7);
    expect(toggleLayer).toHaveBeenCalledTimes(1);
    expect(toggleLayer).toHaveBeenCalledWith('heat');
  });
});
