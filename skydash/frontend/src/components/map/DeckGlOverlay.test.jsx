// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const decks = [];
vi.mock('@deck.gl/core', () => ({
  MapView: class { constructor(o) { this.opts = o; } },
  Deck: class {
    constructor(props) { this.props = props; this.setProps = vi.fn(); this.finalize = vi.fn(); decks.push(this); }
  },
}));

const handlers = {};
const container = document.createElement('div');
const map = {
  getContainer: () => container,
  getCenter: () => ({ lat: 12, lng: 34 }),
  getZoom: () => 10,
  on: vi.fn((ev, fn) => { handlers[ev] = fn; }),
  off: vi.fn(),
};
vi.mock('react-leaflet', () => ({ useMap: () => map }));

import DeckGlOverlay from './DeckGlOverlay';

beforeEach(() => { decks.length = 0; container.innerHTML = ''; map.on.mockClear(); map.off.mockClear(); });
afterEach(cleanup);

describe('DeckGlOverlay', () => {
  it('mounts a non-interactive layer over the map and creates a deck synced to it', () => {
    render(<DeckGlOverlay />);
    const el = container.firstChild;
    expect(el.style.pointerEvents).toBe('none');
    expect(el.style.zIndex).toBe('350');
    expect(decks).toHaveLength(1);
    expect(decks[0].props.viewState).toEqual({ longitude: 34, latitude: 12, zoom: 9, bearing: 0, pitch: 0 });
    expect(decks[0].props.controller).toBe(false);
  });

  it('follows map move and zoom', () => {
    render(<DeckGlOverlay />);
    handlers.move();
    expect(decks[0].setProps).toHaveBeenCalledWith({ viewState: expect.objectContaining({ zoom: 9 }) });
    expect(map.on).toHaveBeenCalledWith('zoom', expect.any(Function));
  });

  it('passes layers through and updates them', () => {
    const { rerender } = render(<DeckGlOverlay layers={[{ id: 'a' }]} />);
    expect(decks[0].setProps).toHaveBeenCalledWith({ layers: [{ id: 'a' }] });
    rerender(<DeckGlOverlay layers={[{ id: 'b' }]} />);
    expect(decks[0].setProps).toHaveBeenLastCalledWith({ layers: [{ id: 'b' }] });
  });

  it('cleans up the deck, listeners and element on unmount', () => {
    const { unmount } = render(<DeckGlOverlay />);
    unmount();
    expect(decks[0].finalize).toHaveBeenCalled();
    expect(map.off).toHaveBeenCalledWith('move', expect.any(Function));
    expect(map.off).toHaveBeenCalledWith('zoom', expect.any(Function));
    expect(container.children).toHaveLength(0);
  });
});
