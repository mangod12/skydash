import { describe, it, expect } from 'vitest';
import { toDMS, toUTM, toMGRS, formatDecimal, distanceBetween } from './coordinates';

describe('formatDecimal', () => {
  it('formats lat/lng to 6 decimal places', () => {
    expect(formatDecimal(37.7749, -122.4194)).toBe('37.774900, -122.419400');
  });

  it('handles zero', () => {
    expect(formatDecimal(0, 0)).toBe('0.000000, 0.000000');
  });
});

describe('toDMS', () => {
  it('converts San Francisco coordinates', () => {
    const result = toDMS(37.7749, -122.4194);
    expect(result).toContain('N');
    expect(result).toContain('W');
    expect(result).toContain('37');
    expect(result).toContain('122');
  });

  it('handles southern hemisphere', () => {
    const result = toDMS(-33.8688, 151.2093);
    expect(result).toContain('S');
    expect(result).toContain('E');
  });
});

describe('toUTM', () => {
  it('returns correct zone for San Francisco', () => {
    const result = toUTM(37.7749, -122.4194);
    expect(result.zone).toBe(10);
    expect(result.letter).toBe('N');
    expect(result.easting).toBeGreaterThan(500000);
    expect(result.northing).toBeGreaterThan(4000000);
  });

  it('returns formatted string', () => {
    const result = toUTM(37.7749, -122.4194);
    expect(result.formatted).toMatch(/^10N \d+ \d+$/);
  });

  it('handles southern hemisphere', () => {
    const result = toUTM(-33.8688, 151.2093);
    expect(result.letter).toBe('S');
  });
});

describe('toMGRS', () => {
  it('returns string with zone and grid letters', () => {
    const result = toMGRS(37.7749, -122.4194);
    expect(result).toMatch(/^10S/);
    expect(result.length).toBeGreaterThan(10);
  });
});

describe('distanceBetween', () => {
  it('returns 0 for same point', () => {
    expect(distanceBetween(37.7749, -122.4194, 37.7749, -122.4194)).toBe(0);
  });

  it('calculates ~1km for known points', () => {
    // ~0.009 degrees latitude ≈ 1km
    const dist = distanceBetween(37.7749, -122.4194, 37.7839, -122.4194);
    expect(dist).toBeGreaterThan(900);
    expect(dist).toBeLessThan(1100);
  });

  it('calculates San Francisco to Oakland (~13km)', () => {
    const dist = distanceBetween(37.7749, -122.4194, 37.8044, -122.2712);
    expect(dist).toBeGreaterThan(12000);
    expect(dist).toBeLessThan(15000);
  });
});
