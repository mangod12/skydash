import { describe, it, expect } from 'vitest';
import { csvCell } from './csvSafe';

describe('csvCell', () => {
  it('quotes and escapes', () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell(null)).toBe('""');
  });
  it.each([NaN, Infinity, -Infinity])('omits nonfinite numeric readings %s', (value) => {
    expect(csvCell(value)).toBe('""');
  });
  it('keeps finite readings and descriptive text', () => {
    expect(csvCell(0)).toBe('"0"');
    expect(csvCell(2.5)).toBe('"2.5"');
    expect(csvCell('Infinity label')).toBe('"Infinity label"');
  });
  it('defuses formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('-2+3')).toBe(`"'-2+3"`);
  });
});
