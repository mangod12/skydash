import { describe, it, expect } from 'vitest';
import {
  calculateBearing, calculateDistance, estimateTravelTime, midpoint, formatBearing, formatDistance,
} from './bearing';

describe('calculateBearing', () => {
  it('returns cardinal directions', () => {
    expect(calculateBearing(0, 0, 1, 0)).toBeCloseTo(0, 5);
    expect(calculateBearing(0, 0, 0, 1)).toBeCloseTo(90, 5);
    expect(calculateBearing(1, 0, 0, 0)).toBeCloseTo(180, 5);
    expect(calculateBearing(0, 1, 0, 0)).toBeCloseTo(270, 5);
  });
});

describe('calculateDistance', () => {
  it('is about 111.2 km per degree of latitude', () => {
    expect(calculateDistance(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });

  it('converts units and is zero for the same point', () => {
    const km = calculateDistance(0, 0, 1, 0);
    expect(calculateDistance(0, 0, 1, 0, 'nm')).toBeCloseTo(km / 1.852, 6);
    expect(calculateDistance(0, 0, 1, 0, 'mi')).toBeCloseTo(km / 1.60934, 6);
    expect(calculateDistance(5, 5, 5, 5)).toBe(0);
  });
});

describe('estimateTravelTime', () => {
  it('formats seconds, minutes and hours', () => {
    expect(estimateTravelTime(1, 360)).toBe('10s');
    expect(estimateTravelTime(1, 60)).toBe('1m 0s');
    expect(estimateTravelTime(135, 60)).toBe('2h 15m');
  });

  it('returns -- without a usable speed', () => {
    expect(estimateTravelTime(10, 0)).toBe('--');
    expect(estimateTravelTime(10, undefined)).toBe('--');
  });
});

describe('midpoint', () => {
  it('finds the midpoint on the equator', () => {
    const m = midpoint(0, 0, 0, 10);
    expect(m.lat).toBeCloseTo(0, 6);
    expect(m.lng).toBeCloseTo(5, 6);
  });
});

describe('formatters', () => {
  it('formats bearing and distance', () => {
    expect(formatBearing(45.123)).toBe('45.1\u00B0');
    expect(formatDistance(0.005, 'km')).toBe('5 m');
    expect(formatDistance(2.345, 'km')).toBe('2.35 km');
  });
});
