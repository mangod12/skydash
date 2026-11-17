import { beforeEach, describe, expect, it } from 'vitest';
import { useMapStore } from './mapStore';

beforeEach(() => useMapStore.setState({ dronePosition: null, flightPath: [] }));

describe('map telemetry positions', () => {
  it.each([
    [null, 1], [1, null], [undefined, 1], [1, undefined],
    ['20', 1], [1, '30'], [true, 1], [1, false],
    [NaN, 1], [1, Infinity], [-Infinity, 1],
    [91, 1], [-91, 1], [1, 181], [1, -181],
  ])('keeps the last valid position when coordinates are invalid: %j %j', (lat, lng) => {
    const store = useMapStore.getState();
    store.updateDronePosition(20, 30, 50, 90);
    const previous = useMapStore.getState();
    store.updateDronePosition(lat, lng, 100, 0);
    expect(useMapStore.getState().dronePosition).toBe(previous.dronePosition);
    expect(useMapStore.getState().flightPath).toBe(previous.flightPath);
  });

  it('keeps genuine zero positions and geographic boundary values', () => {
    const store = useMapStore.getState();
    for (const [lat, lng] of [[0, 0], [90, 180], [-90, -180]]) {
      store.updateDronePosition(lat, lng, 0, 0);
      expect(useMapStore.getState().dronePosition).toEqual({ lat, lng, alt: 0, heading: 0 });
    }
    expect(useMapStore.getState().flightPath).toHaveLength(3);
  });
});
