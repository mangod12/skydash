import { describe, it, expect } from 'vitest';
import { buildSatelliteBasemap, DARK_BASEMAP } from './basemap';

describe('buildSatelliteBasemap', () => {
  it('falls back to the standard basemap without a key', () => {
    expect(buildSatelliteBasemap('')).toBe(DARK_BASEMAP);
  });

  it('uses Esri World Imagery with the key and attribution', () => {
    const layer = buildSatelliteBasemap('abc 123');
    expect(layer.url).toContain('World_Imagery/MapServer/tile/{z}/{y}/{x}');
    expect(layer.url).toContain('token=abc%20123');
    expect(layer.attribution).toContain('Esri');
  });
});
