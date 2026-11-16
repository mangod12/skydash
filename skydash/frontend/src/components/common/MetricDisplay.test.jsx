// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MetricDisplay from './MetricDisplay';

afterEach(cleanup);

describe('MetricDisplay', () => {
  it('renders label, value and unit', () => {
    render(<MetricDisplay label="Altitude" value={80} unit="m" />);
    expect(screen.getByText('Altitude')).toBeTruthy();
    expect(screen.getByText('m')).toBeTruthy();
    expect(screen.getByText((_, el) => el.className.includes('font-bold') && el.textContent === '80m')).toBeTruthy();
  });

  it('shows -- when the value is missing and honours size', () => {
    const { container } = render(<MetricDisplay label="Speed" size="lg" />);
    expect(container.textContent).toContain('--');
    expect(container.querySelector('.text-5xl')).not.toBeNull();
  });
});
