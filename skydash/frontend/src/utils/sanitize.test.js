import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeLabel } from './sanitize';

describe('escapeHtml', () => {
  it('escapes <script> tags', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes attribute injection with double quotes', () => {
    expect(escapeHtml('" onload="alert(1)')).toBe(
      '&quot; onload=&quot;alert(1)',
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('returns empty string for null input', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('returns empty string for number input', () => {
    expect(escapeHtml(42)).toBe('');
  });

  it('preserves unicode characters', () => {
    expect(escapeHtml('Cafe\u0301 \u2603 \u00FC')).toBe('Cafe\u0301 \u2603 \u00FC');
  });

  it('returns normal text unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('sanitizeLabel', () => {
  it('strips nested HTML tags and escapes remaining content', () => {
    expect(sanitizeLabel('<div>hello<b>world</b></div>')).toBe('helloworld');
  });

  it('strips self-closing tags with dangerous attributes', () => {
    expect(sanitizeLabel('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('strips script tags and escapes content', () => {
    expect(sanitizeLabel('<script>alert("xss")</script>')).toBe(
      'alert(&quot;xss&quot;)',
    );
  });

  it('returns empty string for null input', () => {
    expect(sanitizeLabel(null)).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(sanitizeLabel(undefined)).toBe('');
  });

  it('preserves unicode characters', () => {
    expect(sanitizeLabel('\u00E9\u00E8\u00EA')).toBe('\u00E9\u00E8\u00EA');
  });

  it('leaves plain text unchanged', () => {
    expect(sanitizeLabel('Drone Alpha-1')).toBe('Drone Alpha-1');
  });
});
