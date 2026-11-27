// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import BrandMark from './BrandMark';
import { BRAND } from '../../brand';

afterEach(cleanup);

describe('BrandMark', () => {
  it('shows the wordmark and category by default', () => {
    render(<BrandMark />);
    expect(screen.getByText(BRAND.wordmark)).toBeTruthy();
    expect(screen.getByText(BRAND.category)).toBeTruthy();
  });

  it('compact shows only the short name', () => {
    render(<BrandMark compact />);
    expect(screen.getByText(BRAND.shortName)).toBeTruthy();
    expect(screen.queryByText(BRAND.wordmark)).toBeNull();
    expect(screen.queryByText(BRAND.category)).toBeNull();
  });

  it('centres and accepts extra classes', () => {
    const { container } = render(<BrandMark centered className="mb-2" />);
    expect(container.firstChild.className).toContain('text-center');
    expect(container.firstChild.className).toContain('mb-2');
  });
});
