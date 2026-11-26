// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import MiniTimeline from './MiniTimeline';

afterEach(cleanup);

const evt = (id, severity, description) => ({
  id, severity, description, time: new Date('2026-01-01T09:05:00'),
});

describe('MiniTimeline', () => {
  it('renders nothing without events', () => {
    const { container } = render(<MiniTimeline events={[]} totalCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders each event with time and description', () => {
    render(<MiniTimeline events={[evt(1, 'info', 'Link up'), evt(2, 'critical', 'Link lost')]} totalCount={2} />);
    expect(screen.getByText('Link up')).toBeTruthy();
    expect(screen.getByText('Link lost')).toBeTruthy();
    expect(screen.getAllByText('09:05Z').length).toBe(2);
  });

  it('colors dots by severity with a neutral fallback', () => {
    const { container } = render(
      <MiniTimeline events={[evt(1, 'warning', 'a'), evt(2, 'critical', 'b'), evt(3, 'weird', 'c')]} totalCount={3} />
    );
    const dots = [...container.querySelectorAll('.rounded-full')];
    expect(dots[0].className).toContain('bg-amber-400');
    expect(dots[1].className).toContain('bg-red-500');
    expect(dots[2].className).toContain('bg-zinc-500');
  });

  it('shows VIEW ALL only above five events and calls back', () => {
    const onViewAll = vi.fn();
    const { rerender } = render(<MiniTimeline events={[evt(1, 'info', 'a')]} totalCount={5} onViewAll={onViewAll} />);
    expect(screen.queryByText(/VIEW ALL/)).toBeNull();
    rerender(<MiniTimeline events={[evt(1, 'info', 'a')]} totalCount={8} onViewAll={onViewAll} />);
    fireEvent.click(screen.getByText('VIEW ALL (8)'));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });
});
