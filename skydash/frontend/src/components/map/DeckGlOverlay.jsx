import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { Deck, MapView } from '@deck.gl/core';

function getViewState(map) {
  const { lat, lng } = map.getCenter();
  return {
    longitude: lng,
    latitude: lat,
    zoom: map.getZoom() - 1,
    bearing: 0,
    pitch: 0,
  };
}

/**
 * Renders deck.gl layers on a canvas synced to the Leaflet viewport.
 * Placed between tile pane (z200) and overlay pane (z400) so
 * Leaflet markers/tooltips remain interactive on top.
 */
export default function DeckGlOverlay({ layers = [] }) {
  const map = useMap();
  const deckRef = useRef(null);
  const elRef = useRef(null);

  useEffect(() => {
    const container = map.getContainer();
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:350;';
    container.appendChild(el);
    elRef.current = el;

    const deck = new Deck({
      parent: el,
      views: new MapView({ repeat: true }),
      viewState: getViewState(map),
      layers: [],
      controller: false,
      getCursor: () => 'inherit',
      useDevicePixels: true,
    });
    deckRef.current = deck;

    const sync = () => {
      deck.setProps({ viewState: getViewState(map) });
    };

    map.on('move', sync);
    map.on('zoom', sync);

    return () => {
      map.off('move', sync);
      map.off('zoom', sync);
      deck.finalize();
      el.remove();
      deckRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    deckRef.current?.setProps({ layers });
  }, [layers]);

  return null;
}
