import { describe, it, expect } from 'vitest';
import { roleAllows } from './roles';

describe('roleAllows', () => {
  it('allows everything when auth is off', () => {
    expect(roleAllows(false, undefined, 'commander')).toBe(true);
    expect(roleAllows(null, undefined, 'operator')).toBe(true);
  });
  it('follows the ladder viewer < analyst < operator < commander', () => {
    expect(roleAllows(true, 'viewer', 'analyst')).toBe(false);
    expect(roleAllows(true, 'analyst', 'analyst')).toBe(true);
    expect(roleAllows(true, 'analyst', 'operator')).toBe(false);
    expect(roleAllows(true, 'operator', 'operator')).toBe(true);
    expect(roleAllows(true, 'commander', 'operator')).toBe(true);
  });
  it('denies unknown roles when auth is on', () => {
    expect(roleAllows(true, 'intern', 'analyst')).toBe(false);
    expect(roleAllows(true, undefined, 'analyst')).toBe(false);
  });
});
