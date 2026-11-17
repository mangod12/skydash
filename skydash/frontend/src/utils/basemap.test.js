import { describe, it, expect } from 'vitest';
import { resolveStandardBasemap } from './basemap';

describe('resolveStandardBasemap', () => {
  it('uses OpenStreetMap by default', () => {
    const b = resolveStandardBasemap({});
    expect(b.url).toContain('tile.openstreetmap.org');
    expect(b.attribution).toContain('OpenStreetMap');
  });
  it('uses an internal tile server when VITE_TILE_URL is set', () => {
    const b = resolveStandardBasemap({ VITE_TILE_URL: ' http://tiles.local/{z}/{x}/{y}.png ' });
    expect(b.url).toBe('http://tiles.local/{z}/{x}/{y}.png');
    expect(b.attribution).toBe('');
  });
});
