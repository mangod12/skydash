import { describe, it, expect } from 'vitest';
import { formatAge } from './formatAge';

describe('formatAge', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatAge(4000)).toBe('4s');
    expect(formatAge(185000)).toBe('3m 05s');
    expect(formatAge(7800000)).toBe('2h 10m');
  });
  it('returns a placeholder for missing or negative values', () => {
    expect(formatAge(null)).toBe('--');
    expect(formatAge(-1)).toBe('--');
  });
});
