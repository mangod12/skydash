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


describe('map telemetry identity', () => {
  it('starts a new trail when the selected drone changes', () => {
    const update = useMapStore.getState().updateDronePosition;
    update(20, 30, 50, 0, 'one');
    update(20.1, 30.1, 50, 0, 'one');
    expect(useMapStore.getState().flightPath).toHaveLength(2);
    update(40, 50, 50, undefined, 'two');
    expect(useMapStore.getState().flightPath).toHaveLength(1);
    expect(useMapStore.getState().dronePosition.droneId).toBe('two');
    expect(useMapStore.getState().dronePosition.heading).toBeUndefined();
  });

  it('clears the map reading and trail when no drone is present', () => {
    const store = useMapStore.getState();
    store.updateDronePosition(20, 30, 50, 0, 'one');
    store.clearDronePosition();
    expect(useMapStore.getState().dronePosition).toBeNull();
    expect(useMapStore.getState().flightPath).toEqual([]);
  });
});
