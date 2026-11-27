// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import GlassCard from './GlassCard';

afterEach(cleanup);

describe('GlassCard', () => {
  it('renders children', () => {
    render(<GlassCard>hello</GlassCard>);
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('passes role and aria-label through', () => {
    render(<GlassCard role="region" aria-label="Status" animate={false}>x</GlassCard>);
    expect(screen.getByRole('region', { name: 'Status' })).toBeTruthy();
  });

  it('uses the elevated style instead of the default glass border', () => {
    const { container, rerender } = render(<GlassCard animate={false}>x</GlassCard>);
    expect(container.firstChild.className).toContain('backdrop-blur');
    rerender(<GlassCard elevated animate={false}>x</GlassCard>);
    expect(container.firstChild.className).toContain('glass-elevated');
    expect(container.firstChild.className).not.toContain('backdrop-blur');
  });

  it('adds glow and custom classes, forwards extra props', () => {
    const { container } = render(<GlassCard glow className="extra" data-testid="g" animate={false}>x</GlassCard>);
    expect(container.firstChild.className).toContain('--glow-primary');
    expect(container.firstChild.className).toContain('extra');
    expect(screen.getByTestId('g')).toBeTruthy();
  });
});
