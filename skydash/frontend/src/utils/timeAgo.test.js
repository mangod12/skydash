import { describe, it, expect } from 'vitest';
import { timeAgo } from './timeAgo';

describe('timeAgo', () => {
  it('formats numbers, dates and ISO strings', () => {
    const t = Date.now() - 5 * 60000;
    expect(timeAgo(t)).toBe('5 minutes ago');
    expect(timeAgo(new Date(t))).toBe('5 minutes ago');
    expect(timeAgo(new Date(t).toISOString())).toBe('5 minutes ago');
  });
  it('returns the fallback instead of throwing for bad input', () => {
    for (const bad of [null, undefined, '', 'garbage', NaN, new Date('x')]) {
      expect(timeAgo(bad)).toBe('unknown');
    }
    expect(timeAgo('garbage', '')).toBe('');
  });
});
