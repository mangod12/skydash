import { describe, it, expect } from 'vitest';
import { shortLabel } from './sanitize';

describe('shortLabel', () => {
  it('escapes markup in entity names', () => {
    const out = shortLabel('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<');
    expect(out).not.toContain('onerror=alert(1)>');
  });
  it('truncates long names and tolerates missing ones', () => {
    expect(shortLabel('A'.repeat(20))).toBe('A'.repeat(14) + '\u2026');
    expect(shortLabel(undefined)).toBe('');
  });
});
