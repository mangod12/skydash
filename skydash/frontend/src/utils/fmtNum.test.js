import { describe, it, expect } from 'vitest';
import { fmtNum } from './fmtNum';

describe('fmtNum', () => {
  it('formats finite numbers including zero', () => {
    expect(fmtNum(0, 0)).toBe('0');
    expect(fmtNum(12.345, 1)).toBe('12.3');
  });
  it('shows a dash for missing or non-finite values', () => {
    for (const v of [undefined, null, NaN, Infinity, '5']) expect(fmtNum(v, 1)).toBe('—');
  });
});
