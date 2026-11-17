import { describe, it, expect } from 'vitest';
import { csvCell } from './csvSafe';

describe('csvCell', () => {
  it('quotes and escapes', () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell(null)).toBe('""');
  });
  it('defuses formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('-2+3')).toBe(`"'-2+3"`);
  });
});
