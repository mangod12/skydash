// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const rects = [];
const marks = [];
vi.mock('react-leaflet', () => ({
  Rectangle: (p) => { rects.push(p); return null; },
  Marker: (p) => { marks.push(p); return null; },
}));
vi.mock('leaflet', () => ({ default: { divIcon: (o) => o } }));

import SectorGrid from './SectorGrid';
import { useMapStore } from '../../stores/mapStore';

beforeEach(() => { rects.length = 0; marks.length = 0; });
afterEach(cleanup);

describe('SectorGrid', () => {
  it('draws four named sectors around the map centre', () => {
    useMapStore.setState({ center: [10, 20] });
    render(<SectorGrid />);
    expect(rects).toHaveLength(4);
    expect(marks.map((m) => m.icon.html.match(/>(\w+)<\/div>/)[1])).toEqual(['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA']);
    expect(rects[0].bounds).toEqual([[10, 19.988], [10.012, 20]]);
    expect(rects[3].bounds[1][0]).toBeCloseTo(10);
  });

  it('places each label at the middle of its sector, not interactive', () => {
    useMapStore.setState({ center: [10, 20] });
    render(<SectorGrid />);
    expect(marks[1].position[0]).toBeCloseTo(10.006);
    expect(marks[1].position[1]).toBeCloseTo(20.006);
    expect(marks.every((m) => m.interactive === false)).toBe(true);
  });

  it('draws nothing when the centre is not finite', () => {
    useMapStore.setState({ center: [NaN, 20] });
    render(<SectorGrid />);
    expect(rects).toHaveLength(0);
  });
});
