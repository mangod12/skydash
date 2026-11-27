import { describe, it, expect } from 'vitest';
import { upperLabel } from './upperLabel';

describe('upperLabel', () => {
  it('upper-cases strings', () => expect(upperLabel('drone')).toBe('DRONE'));
  it('falls back for missing or non-string values', () => {
    for (const v of [undefined, null, '', 5, {}]) expect(upperLabel(v)).toBe('UNKNOWN');
    expect(upperLabel(null, '--')).toBe('--');
  });
});
